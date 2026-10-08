import { AsyncLocalStorage } from "node:async_hooks";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Per-request company context, propagated via AsyncLocalStorage rather than
 * threaded through every function signature — see withCompanyContext below.
 * tenant-db.ts reads this via currentCompanyId() to scope every tenant-
 * model query; nothing in this module talks to tenant-db.ts directly.
 */
type CompanyContext = { companyId: string };
const companyContext = new AsyncLocalStorage<CompanyContext>();

/** Thrown by currentCompanyId() when no withCompanyContext() is active. */
export class TenantContextError extends Error {}

/**
 * Thrown by resolveCompanyId() when a user belongs to more than one
 * company and no explicit selection was passed — it must never silently
 * pick one.
 */
export class AmbiguousCompanyError extends Error {}

/** Thrown by resolveCompanyId() when a user has no CompanyMembership at all. */
export class NoCompanyMembershipError extends Error {}

/**
 * Thrown by resolveCompanyId() when an explicit company selection is
 * rejected — a non-platform-admin naming a company they're not a member
 * of, or a platform admin naming a company that doesn't exist.
 */
export class CompanyAccessDeniedError extends Error {}

/**
 * Runs fn with companyId active for the duration of the call. Awaits fn's
 * result *inside* companyContext.run()'s own callback, deliberately — a
 * Prisma query promise is lazy (its actual query doesn't start until
 * something awaits/thens it), so if this just returned fn()'s promise for
 * the caller to await later, that later await would trigger Prisma's real
 * execution outside of run()'s synchronous span, and AsyncLocalStorage
 * would have already lost the context by then. Awaiting here instead
 * means the triggering `.then()` happens while run()'s context is still
 * active, so every continuation inherits it correctly. Confirmed this
 * mattered empirically — the naive `return companyContext.run(store, fn)`
 * version failed every tenantDb test with "no context active" even
 * though the call site looked correct.
 */
export function withCompanyContext<T>(
  companyId: string,
  fn: () => Promise<T>
): Promise<T> {
  return companyContext.run({ companyId }, async () => {
    return await fn();
  });
}

/** The active company context, or throws TenantContextError if none is set. */
export function currentCompanyId(): string {
  const ctx = companyContext.getStore();
  if (!ctx) {
    throw new TenantContextError(
      "No company context is active — every tenant-scoped query must run inside withCompanyContext()."
    );
  }
  return ctx.companyId;
}

type MinimalUser = { id: string; isPlatformAdmin: boolean };

/**
 * Resolves which company a request should run against. Never caches this
 * in a session token — same "never trust a cached authorization decision"
 * discipline this codebase already uses for room/slate sessionVersion
 * checks (src/lib/auth.ts) — every call re-checks CompanyMembership fresh.
 *
 * - No explicit selection, exactly one membership: use it.
 * - No explicit selection, zero or multiple memberships: refuse (throws
 *   NoCompanyMembershipError / AmbiguousCompanyError) rather than guess.
 * - Explicit selection, user is a member of that company: use it.
 * - Explicit selection, user is isPlatformAdmin and not a member: allowed,
 *   but only after confirming the company exists, and only with an
 *   AuditLog row written for the bypass (every use, not just failures).
 * - Explicit selection, user is neither a member nor a platform admin:
 *   refuse (CompanyAccessDeniedError), even for a well-formed request —
 *   this is the specific case the plan's cross-tenant test matrix checks.
 */
export async function resolveCompanyId(
  user: MinimalUser,
  explicitCompanyId?: string | null,
  auditMetadata?: Prisma.InputJsonValue
): Promise<string> {
  if (explicitCompanyId) {
    const membership = await prisma.companyMembership.findUnique({
      where: { userId_companyId: { userId: user.id, companyId: explicitCompanyId } },
    });
    if (membership) {
      return explicitCompanyId;
    }

    if (!user.isPlatformAdmin) {
      throw new CompanyAccessDeniedError(
        `User ${user.id} is not a member of company ${explicitCompanyId}.`
      );
    }

    const company = await prisma.company.findUnique({ where: { id: explicitCompanyId } });
    if (!company) {
      throw new CompanyAccessDeniedError(`Company ${explicitCompanyId} does not exist.`);
    }

    await prisma.auditLog.create({
      data: {
        companyId: explicitCompanyId,
        userId: user.id,
        action: "platform_admin_bypass",
        metadata: auditMetadata,
      },
    });
    return explicitCompanyId;
  }

  const memberships = await prisma.companyMembership.findMany({ where: { userId: user.id } });

  if (memberships.length === 1) {
    return memberships[0]!.companyId;
  }
  if (memberships.length > 1) {
    throw new AmbiguousCompanyError(
      `User ${user.id} belongs to ${memberships.length} companies — an explicit company selection is required.`
    );
  }
  throw new NoCompanyMembershipError(`User ${user.id} has no company membership.`);
}
