import { formatMoneyMinorToMajor } from "@/lib/money";

/**
 * A server-rendered (no client JS, no charting library) horizontal
 * stacked bar showing one film's capital stack by status. Scales via the
 * SVG viewBox rather than a fixed pixel width, so it reflows correctly
 * down to a 380px viewport; the real accessible content is the legend
 * list below the bar (plain DOM text, read by any screen reader) and the
 * <title> inside the SVG, not color alone.
 */
export default function CapitalStackChart({
  currencySymbol,
  committed,
  inNegotiation,
  sought,
  budget,
}: {
  currencySymbol: string;
  committed: number;
  inNegotiation: number;
  sought: number;
  budget: number | null;
}) {
  const totalSources = committed + inNegotiation + sought;
  const hasBudget = budget !== null && budget > 0;
  const exceedsBudget = hasBudget && totalSources > budget;
  const scale = hasBudget ? Math.max(budget, totalSources) : totalSources || 1;
  const gap = hasBudget && !exceedsBudget ? budget - totalSources : 0;

  const pct = (minor: number) => (minor / scale) * 100;
  const fmt = (minor: number) => `${currencySymbol}${formatMoneyMinorToMajor(minor)}`;

  const segments = [
    { label: "Committed", minor: committed, opacity: 1 },
    { label: "In negotiation", minor: inNegotiation, opacity: 0.6 },
    { label: "Sought", minor: sought, opacity: 0.3 },
  ].filter((s) => s.minor > 0);

  const summary =
    totalSources === 0
      ? "No finance sources recorded yet."
      : `${segments.map((s) => `${s.label.toLowerCase()} ${fmt(s.minor)}`).join(", ")}` +
        (hasBudget ? ` against a ${fmt(budget)} budget` : "") +
        (exceedsBudget ? " (sources exceed budget)" : "");

  let cursor = 0;

  return (
    <div className="flex flex-col gap-2">
      <svg
        role="img"
        aria-label={summary}
        viewBox="0 0 400 24"
        preserveAspectRatio="none"
        className="h-6 w-full overflow-visible rounded-sm"
      >
        <title>{summary}</title>
        <rect x={0} y={0} width={400} height={24} fill="var(--border)" opacity={0.3} />
        {segments.map((s) => {
          const width = (pct(s.minor) / 100) * 400;
          const x = cursor;
          cursor += width;
          return (
            <rect
              key={s.label}
              x={x}
              y={0}
              width={Math.max(width, 0)}
              height={24}
              fill="var(--accent)"
              opacity={s.opacity}
            />
          );
        })}
        {hasBudget && exceedsBudget && (
          <line
            x1={(pct(budget) / 100) * 400}
            x2={(pct(budget) / 100) * 400}
            y1={-2}
            y2={26}
            stroke="var(--danger)"
            strokeWidth={2}
          />
        )}
      </svg>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: "var(--accent)", opacity: s.opacity }}
              aria-hidden="true"
            />
            {s.label}: <span className="tabular-nums">{fmt(s.minor)}</span>
          </li>
        ))}
        {gap > 0 && (
          <li className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full border border-border"
              aria-hidden="true"
            />
            Remaining to raise: <span className="tabular-nums">{fmt(gap)}</span>
          </li>
        )}
        {exceedsBudget && (
          <li className="flex items-center gap-1.5 text-danger">
            Sources exceed the <span className="tabular-nums">{fmt(budget as number)}</span> budget
          </li>
        )}
      </ul>
    </div>
  );
}
