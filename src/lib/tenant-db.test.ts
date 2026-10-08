import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { withCompanyContext, TenantContextError } from "@/lib/tenant-context";
import { tenantDb } from "@/lib/tenant-db";

describe("tenantDb", () => {
  const ids: { companies: string[] } = { companies: [] };

  async function makeCompany(name: string) {
    const company = await prisma.company.create({ data: { name } });
    ids.companies.push(company.id);
    return company;
  }

  function makeProjectData(companyId: string, overrides: Record<string, unknown> = {}) {
    return {
      companyId,
      slug: `tenant-db-test-${crypto.randomUUID()}`,
      title: "Test Project",
      productionCompany: "Test Co",
      passwordHash: "unused-in-this-test",
      ...overrides,
    };
  }

  afterEach(async () => {
    // Cascades: Project's children (FinanceSource, GalleryItem,
    // ReferenceLink, Document, DocumentDownload, SlateProject) are all
    // onDelete: Cascade from Project — deleting the companies' projects is
    // enough cleanup, then the companies themselves (onDelete: Restrict,
    // so children must be gone first).
    await prisma.project.deleteMany({ where: { companyId: { in: ids.companies } } });
    await prisma.slate.deleteMany({ where: { companyId: { in: ids.companies } } });
    await prisma.company.deleteMany({ where: { id: { in: ids.companies } } });
    ids.companies = [];
  });

  it("throws TenantContextError for a tenant model with no active context", async () => {
    await expect(tenantDb.project.findMany()).rejects.toThrow(TenantContextError);
  });

  it("passes non-tenant models through untouched even with no context active", async () => {
    // User isn't in TENANT_MODELS — this must not throw, and must not
    // require withCompanyContext at all.
    await expect(tenantDb.user.findMany({ take: 1 })).resolves.toBeDefined();
  });

  it("findMany only returns rows from the active company", async () => {
    const companyA = await makeCompany("Tenant DB A");
    const companyB = await makeCompany("Tenant DB B");
    const projectA = await prisma.project.create({ data: makeProjectData(companyA.id) });
    await prisma.project.create({ data: makeProjectData(companyB.id) });

    const results = await withCompanyContext(companyA.id, () => tenantDb.project.findMany());
    expect(results.map((p) => p.id)).toEqual([projectA.id]);
  });

  it("findUnique by a real id from a different company returns null, not the row", async () => {
    const companyA = await makeCompany("Tenant DB A");
    const companyB = await makeCompany("Tenant DB B");
    const projectB = await prisma.project.create({ data: makeProjectData(companyB.id) });

    const result = await withCompanyContext(companyA.id, () =>
      tenantDb.project.findUnique({ where: { id: projectB.id } })
    );
    expect(result).toBeNull();

    // Confirm it's really there, just out of this context's scope — not
    // a false negative from a bug elsewhere.
    const unscoped = await prisma.project.findUnique({ where: { id: projectB.id } });
    expect(unscoped).not.toBeNull();
  });

  it("findUniqueOrThrow by a different company's id throws, not returns the row", async () => {
    const companyA = await makeCompany("Tenant DB A");
    const companyB = await makeCompany("Tenant DB B");
    const projectB = await prisma.project.create({ data: makeProjectData(companyB.id) });

    await expect(
      withCompanyContext(companyA.id, () =>
        tenantDb.project.findUniqueOrThrow({ where: { id: projectB.id } })
      )
    ).rejects.toThrow();
  });

  it("create always stamps the active company's id, ignoring any companyId the caller tries to set", async () => {
    const companyA = await makeCompany("Tenant DB A");
    const companyB = await makeCompany("Tenant DB B");

    const created = await withCompanyContext(companyA.id, () =>
      tenantDb.project.create({ data: makeProjectData(companyB.id) })
    );
    expect(created.companyId).toBe(companyA.id);
  });

  it("update on a different company's row throws rather than updating it", async () => {
    const companyA = await makeCompany("Tenant DB A");
    const companyB = await makeCompany("Tenant DB B");
    const projectB = await prisma.project.create({ data: makeProjectData(companyB.id) });

    await expect(
      withCompanyContext(companyA.id, () =>
        tenantDb.project.update({ where: { id: projectB.id }, data: { title: "Hijacked" } })
      )
    ).rejects.toThrow();

    const unchanged = await prisma.project.findUnique({ where: { id: projectB.id } });
    expect(unchanged?.title).toBe("Test Project");
  });

  it("update on the active company's own row succeeds and returns the updated row", async () => {
    const companyA = await makeCompany("Tenant DB A");
    const projectA = await prisma.project.create({ data: makeProjectData(companyA.id) });

    const updated = await withCompanyContext(companyA.id, () =>
      tenantDb.project.update({ where: { id: projectA.id }, data: { title: "Renamed" } })
    );
    expect(updated.title).toBe("Renamed");
  });

  it("delete on a different company's row throws and leaves it in place", async () => {
    const companyA = await makeCompany("Tenant DB A");
    const companyB = await makeCompany("Tenant DB B");
    const projectB = await prisma.project.create({ data: makeProjectData(companyB.id) });

    await expect(
      withCompanyContext(companyA.id, () => tenantDb.project.delete({ where: { id: projectB.id } }))
    ).rejects.toThrow();

    const stillThere = await prisma.project.findUnique({ where: { id: projectB.id } });
    expect(stillThere).not.toBeNull();
  });

  it("deleteMany scopes its where clause to the active company", async () => {
    const companyA = await makeCompany("Tenant DB A");
    const companyB = await makeCompany("Tenant DB B");
    await prisma.project.create({ data: makeProjectData(companyA.id) });
    const projectB = await prisma.project.create({ data: makeProjectData(companyB.id) });

    const result = await withCompanyContext(companyA.id, () =>
      tenantDb.project.deleteMany({ where: {} })
    );
    expect(result.count).toBe(1);

    const stillThere = await prisma.project.findUnique({ where: { id: projectB.id } });
    expect(stillThere).not.toBeNull();
  });

  it("upsert creates under the active company when the row doesn't exist there", async () => {
    const companyA = await makeCompany("Tenant DB A");
    const fakeId = `nonexistent-${crypto.randomUUID()}`;

    const result = await withCompanyContext(companyA.id, () =>
      tenantDb.project.upsert({
        where: { id: fakeId },
        create: makeProjectData(companyA.id, { id: fakeId }),
        update: { title: "Should not run" },
      })
    );
    expect(result.companyId).toBe(companyA.id);
    expect(result.title).toBe("Test Project");
  });

  it("upsert updates under the active company when the row already exists there", async () => {
    const companyA = await makeCompany("Tenant DB A");
    const projectA = await prisma.project.create({ data: makeProjectData(companyA.id) });

    const result = await withCompanyContext(companyA.id, () =>
      tenantDb.project.upsert({
        where: { id: projectA.id },
        create: makeProjectData(companyA.id),
        update: { title: "Updated via upsert" },
      })
    );
    expect(result.title).toBe("Updated via upsert");
  });

  it("count only counts the active company's rows", async () => {
    const companyA = await makeCompany("Tenant DB A");
    const companyB = await makeCompany("Tenant DB B");
    await prisma.project.create({ data: makeProjectData(companyA.id) });
    await prisma.project.create({ data: makeProjectData(companyB.id) });
    await prisma.project.create({ data: makeProjectData(companyB.id) });

    const count = await withCompanyContext(companyA.id, () => tenantDb.project.count());
    expect(count).toBe(1);
  });

  it("rejects a composite-FK cross-company link at the database level (not just via tenantDb)", async () => {
    const companyA = await makeCompany("Tenant DB A");
    const companyB = await makeCompany("Tenant DB B");
    const projectA = await prisma.project.create({ data: makeProjectData(companyA.id) });

    // A GalleryItem whose companyId doesn't match its own project's
    // companyId must be physically unrepresentable — this is revision 1's
    // core requirement, tested directly against raw Prisma (not tenantDb)
    // so it's clear the guarantee lives at the schema level.
    await expect(
      prisma.galleryItem.create({
        data: {
          projectId: projectA.id,
          companyId: companyB.id,
          type: "IMAGE",
          fileKey: "whatever.jpg",
        },
      })
    ).rejects.toThrow();
  });
});
