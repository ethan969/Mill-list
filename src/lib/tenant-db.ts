import { prisma } from "@/lib/db";
import { currentCompanyId } from "@/lib/tenant-context";

/**
 * Thrown for any Prisma operation this extension doesn't have an explicit
 * scoping rule for — fails loudly rather than ever passing an unscoped
 * query through by accident. Every operation Prisma 6 exposes on a model
 * delegate is listed below; this only fires if a future Prisma version
 * adds one we haven't reviewed yet.
 */
export class UnsupportedOperationError extends Error {}

/**
 * Prisma model names (as $allOperations reports them — PascalCase) that
 * carry a companyId and must never be queried without a company context.
 * Everything else (User, CompanyMembership, AuditLog, AdminRecoveryCode,
 * RateLimitAttempt) passes through untouched — they either have their own
 * access logic that runs before any company is known (auth), or are
 * deliberately global (RateLimitAttempt — see docs/multi-tenancy-plan.md §1).
 */
const TENANT_MODELS = new Set([
  "Project",
  "Slate",
  "SlateProject",
  "Document",
  "GalleryItem",
  "ReferenceLink",
  "FinanceSource",
  "FxRate",
  "DocumentDownload",
]);

function scopedWhere(where: Record<string, unknown> | undefined, companyId: string) {
  return { AND: [{ companyId }, where ?? {}] };
}

function modelDelegate(model: string) {
  const key = model.charAt(0).toLowerCase() + model.slice(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- delegate name is only known at runtime
  return (prisma as any)[key];
}

/**
 * A Prisma client where every tenant-model query is scoped to whichever
 * companyId is active via withCompanyContext() (tenant-context.ts) — and
 * throws if none is. This is the only safe way to query a tenant model;
 * nothing wires admin routes onto this yet (that's a later commit) — this
 * commit builds and unit-tests the mechanism in isolation.
 *
 * Not yet wired into any admin route. See docs/multi-tenancy-plan.md §4.
 */
export const tenantDb = prisma.$extends({
  name: "tenant-scoping",
  query: {
    $allModels: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- args/return shape varies per model+operation; see per-case handling below
      async $allOperations({ model, operation, args, query }: any) {
        if (!model || !TENANT_MODELS.has(model)) {
          return query(args);
        }

        const companyId = currentCompanyId();
        const delegate = modelDelegate(model);

        switch (operation) {
          case "findMany":
          case "findFirst":
          case "findFirstOrThrow":
          case "count":
          case "aggregate":
          case "groupBy":
          case "updateMany":
          case "updateManyAndReturn":
          case "deleteMany": {
            return query({ ...args, where: scopedWhere(args.where, companyId) });
          }

          case "findUnique":
          case "findUniqueOrThrow": {
            const result = await delegate.findFirst({
              where: scopedWhere(args.where, companyId),
              select: args.select,
              include: args.include,
            });
            if (!result && operation === "findUniqueOrThrow") {
              throw new Error(`${model} not found in this company's scope.`);
            }
            return result;
          }

          case "create": {
            return query({ ...args, data: { ...args.data, companyId } });
          }

          case "createMany":
          case "createManyAndReturn": {
            const data = Array.isArray(args.data) ? args.data : [args.data];
            return query({
              ...args,
              data: data.map((row: Record<string, unknown>) => ({ ...row, companyId })),
            });
          }

          case "update": {
            const scoped = scopedWhere(args.where, companyId);
            const result = await delegate.updateMany({ where: scoped, data: args.data });
            if (result.count === 0) {
              throw new Error(`${model} not found in this company's scope.`);
            }
            return delegate.findFirst({
              where: scoped,
              select: args.select,
              include: args.include,
            });
          }

          case "delete": {
            const scoped = scopedWhere(args.where, companyId);
            const existing = await delegate.findFirst({
              where: scoped,
              select: args.select,
              include: args.include,
            });
            if (!existing) {
              throw new Error(`${model} not found in this company's scope.`);
            }
            await delegate.deleteMany({ where: scoped });
            return existing;
          }

          case "upsert": {
            const scoped = scopedWhere(args.where, companyId);
            const existing = await delegate.findFirst({ where: scoped });
            if (existing) {
              await delegate.updateMany({ where: scoped, data: args.update });
            } else {
              // If args.where's unique key collides with a row that
              // exists in a DIFFERENT company, this intentionally falls
              // through to create() with that same key and lets Postgres
              // reject it with a unique-constraint violation — failing
              // loudly rather than ever updating another company's row.
              await delegate.create({ data: { ...args.create, companyId } });
            }
            return delegate.findFirst({
              where: scoped,
              select: args.select,
              include: args.include,
            });
          }

          default:
            throw new UnsupportedOperationError(
              `tenantDb has no scoping rule for Prisma operation "${operation}" on model "${model}" — add one before using it.`
            );
        }
      },
    },
  },
});
