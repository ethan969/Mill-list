import { prisma } from "@/lib/db";
import FxRatesClient from "@/components/admin/FxRatesClient";
import type { AdminFxRate } from "@/components/admin/types";

// Same per-visit reasoning as the project/slate dashboards — an admin adds
// a new rate and expects to see it immediately, not a cached snapshot.
export const dynamic = "force-dynamic";

export default async function FxRatesPage() {
  const rates = await prisma.fxRate.findMany({
    orderBy: [{ from: "asc" }, { to: "asc" }, { asOfDate: "desc" }],
  });

  const initialRates: AdminFxRate[] = rates.map((r) => ({
    id: r.id,
    from: r.from,
    to: r.to,
    rate: r.rate.toString(),
    asOfDate: r.asOfDate.toISOString(),
  }));

  return <FxRatesClient initialRates={initialRates} />;
}
