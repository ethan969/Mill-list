import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  withCompanyContext,
  currentCompanyId,
  resolveCompanyId,
  TenantContextError,
  AmbiguousCompanyError,
  NoCompanyMembershipError,
  CompanyAccessDeniedError,
} from "@/lib/tenant-context";

describe("currentCompanyId / withCompanyContext", () => {
  it("throws TenantContextError when no context is active", () => {
    expect(() => currentCompanyId()).toThrow(TenantContextError);
  });

  it("returns the companyId set by withCompanyContext for the duration of the call", async () => {
    const seen = await withCompanyContext("company-a", async () => currentCompanyId());
    expect(seen).toBe("company-a");
  });

  it("keeps two concurrent contexts isolated from each other", async () => {
    const [a, b] = await Promise.all([
      withCompanyContext("company-a", async () => {
        await new Promise((r) => setTimeout(r, 20));
        return currentCompanyId();
      }),
      withCompanyContext("company-b", async () => {
        return currentCompanyId();
      }),
    ]);
    expect(a).toBe("company-a");
    expect(b).toBe("company-b");
  });

  it("has no leftover context once withCompanyContext returns", async () => {
    await withCompanyContext("company-a", async () => currentCompanyId());
    expect(() => currentCompanyId()).toThrow(TenantContextError);
  });
});

describe("resolveCompanyId", () => {
  const ids: { companies: string[]; users: string[] } = { companies: [], users: [] };

  async function makeCompany(name: string) {
    const company = await prisma.company.create({ data: { name } });
    ids.companies.push(company.id);
    return company;
  }

  async function makeUser(isPlatformAdmin = false) {
    const user = await prisma.user.create({
      data: {
        email: `tenant-ctx-test-${crypto.randomUUID()}@example.com`,
        passwordHash: "unused-in-this-test",
        isPlatformAdmin,
      },
    });
    ids.users.push(user.id);
    return user;
  }

  afterEach(async () => {
    await prisma.companyMembership.deleteMany({ where: { userId: { in: ids.users } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: ids.users } } });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
    await prisma.company.deleteMany({ where: { id: { in: ids.companies } } });
    ids.companies = [];
    ids.users = [];
  });

  it("resolves the single membership when a user belongs to exactly one company", async () => {
    const company = await makeCompany("Solo Co");
    const user = await makeUser();
    await prisma.companyMembership.create({
      data: { userId: user.id, companyId: company.id, role: "OWNER" },
    });

    await expect(resolveCompanyId(user)).resolves.toBe(company.id);
  });

  it("throws NoCompanyMembershipError for a user with no membership", async () => {
    const user = await makeUser();
    await expect(resolveCompanyId(user)).rejects.toThrow(NoCompanyMembershipError);
  });

  it("throws AmbiguousCompanyError for a user with multiple memberships and no explicit selection", async () => {
    const companyA = await makeCompany("Multi A");
    const companyB = await makeCompany("Multi B");
    const user = await makeUser();
    await prisma.companyMembership.createMany({
      data: [
        { userId: user.id, companyId: companyA.id, role: "OWNER" },
        { userId: user.id, companyId: companyB.id, role: "EDITOR" },
      ],
    });

    await expect(resolveCompanyId(user)).rejects.toThrow(AmbiguousCompanyError);
  });

  it("honors an explicit selection for one of the user's actual memberships", async () => {
    const companyA = await makeCompany("Multi A");
    const companyB = await makeCompany("Multi B");
    const user = await makeUser();
    await prisma.companyMembership.createMany({
      data: [
        { userId: user.id, companyId: companyA.id, role: "OWNER" },
        { userId: user.id, companyId: companyB.id, role: "EDITOR" },
      ],
    });

    await expect(resolveCompanyId(user, companyB.id)).resolves.toBe(companyB.id);
  });

  it("rejects an explicit selection for a company the user isn't a member of, even though the request is well-formed", async () => {
    const memberCompany = await makeCompany("Member Co");
    const otherCompany = await makeCompany("Other Co");
    const user = await makeUser();
    await prisma.companyMembership.create({
      data: { userId: user.id, companyId: memberCompany.id, role: "OWNER" },
    });

    await expect(resolveCompanyId(user, otherCompany.id)).rejects.toThrow(
      CompanyAccessDeniedError
    );
  });

  it("rejects a non-platform-admin's explicit selection even with zero memberships at all", async () => {
    const company = await makeCompany("Someone Else's Co");
    const user = await makeUser();
    await expect(resolveCompanyId(user, company.id)).rejects.toThrow(CompanyAccessDeniedError);
  });

  it("allows a platform admin to select a company they're not a member of, and logs the bypass", async () => {
    const company = await makeCompany("Bypassed Co");
    const admin = await makeUser(true);

    const resolved = await resolveCompanyId(admin, company.id, { reason: "support" });
    expect(resolved).toBe(company.id);

    const logs = await prisma.auditLog.findMany({ where: { userId: admin.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0]!.action).toBe("platform_admin_bypass");
    expect(logs[0]!.companyId).toBe(company.id);
    expect(logs[0]!.metadata).toEqual({ reason: "support" });
  });

  it("rejects a platform admin's selection of a company that doesn't exist", async () => {
    const admin = await makeUser(true);
    await expect(resolveCompanyId(admin, "does-not-exist")).rejects.toThrow(
      CompanyAccessDeniedError
    );
  });

  it("does not write an audit log for a platform admin using their own real membership (not a bypass)", async () => {
    const company = await makeCompany("Own Co");
    const admin = await makeUser(true);
    await prisma.companyMembership.create({
      data: { userId: admin.id, companyId: company.id, role: "OWNER" },
    });

    await resolveCompanyId(admin, company.id);

    const logs = await prisma.auditLog.findMany({ where: { userId: admin.id } });
    expect(logs).toHaveLength(0);
  });
});
