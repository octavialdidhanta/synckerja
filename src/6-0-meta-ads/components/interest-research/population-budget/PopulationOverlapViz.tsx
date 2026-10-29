import type { PopulationSourceRow } from "./useInterestResearchPopulationReach";

const formatNumber = (num: number) => new Intl.NumberFormat("id-ID").format(Math.round(num));

const CIRCLE_COLORS = [
  "#90CAF9",
  "#F08080",
  "#80CBC4",
  "#F6C945",
  "#A78BFA",
  "#FB7185",
  "#38BDF8",
  "#F97316",
];

/** Area of the circle scales with its share of the largest value (radius ∝ √share). */
export function circleRadiusFromPercent(pct: number, maxR: number, minR = 10): number {
  const p = Math.max(0, pct);
  return Math.max(minR, maxR * Math.sqrt(p));
}

function circleIntersectionArea(r1: number, r2: number, d: number): number {
  if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) * Math.min(r1, r2);
  if (d >= r1 + r2) return 0;
  const r1sq = r1 * r1;
  const r2sq = r2 * r2;
  const alpha = Math.acos(Math.min(1, Math.max(-1, (d * d + r1sq - r2sq) / (2 * d * r1))));
  const beta = Math.acos(Math.min(1, Math.max(-1, (d * d + r2sq - r1sq) / (2 * d * r2))));
  const under = (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2);
  return r1sq * alpha + r2sq * beta - 0.5 * Math.sqrt(Math.max(0, under));
}

function distanceForOverlapArea(r1: number, r2: number, targetArea: number): number {
  const minD = Math.abs(r1 - r2);
  const maxD = r1 + r2;
  const full = Math.PI * Math.min(r1, r2) * Math.min(r1, r2);
  const clamped = Math.min(full, Math.max(0, targetArea));
  if (clamped >= full * 0.995) return minD + 0.8;
  if (clamped <= full * 0.01) return maxD - 0.8;
  let lo = minD;
  let hi = maxD;
  for (let i = 0; i < 42; i++) {
    const mid = (lo + hi) / 2;
    if (circleIntersectionArea(r1, r2, mid) > clamped) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function vennOffsets(n: number, spread: number): Array<{ x: number; y: number }> {
  if (n <= 1) {
    return [{ x: 0, y: 0 }];
  }
  if (n === 3) {
    return [
      { x: 0, y: -spread * 0.72 },
      { x: -spread * 0.72, y: spread * 0.48 },
      { x: spread * 0.72, y: spread * 0.48 },
    ];
  }
  if (n === 4) {
    return [
      { x: 0, y: -spread * 0.78 },
      { x: -spread * 0.78, y: 0.08 * spread },
      { x: spread * 0.78, y: 0.08 * spread },
      { x: 0, y: spread * 0.82 },
    ];
  }
  return Array.from({ length: n }, (_, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return { x: spread * Math.cos(angle), y: spread * Math.sin(angle) };
  });
}

/** SVG path of the lens (intersection) of two circles. */
function twoCircleLensPath(
  c1x: number,
  c1y: number,
  r1: number,
  c2x: number,
  c2y: number,
  r2: number,
): string | null {
  const dx = c2x - c1x;
  const dy = c2y - c1y;
  const d = Math.hypot(dx, dy);
  if (d < 0.5 || d >= r1 + r2 - 0.5 || d <= Math.abs(r1 - r2) + 0.5) return null;
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const hSq = r1 * r1 - a * a;
  if (hSq <= 0) return null;
  const h = Math.sqrt(hSq);
  const mx = c1x + (a * dx) / d;
  const my = c1y + (a * dy) / d;
  const px = (-dy * h) / d;
  const py = (dx * h) / d;
  const i1x = mx + px;
  const i1y = my + py;
  const i2x = mx - px;
  const i2y = my - py;
  const cross = dx * (i1y - c1y) - dy * (i1x - c1x);
  const sweep = cross > 0 ? 0 : 1;
  return `M ${i1x} ${i1y} A ${r1} ${r1} 0 0 ${sweep} ${i2x} ${i2y} A ${r2} ${r2} 0 0 ${sweep} ${i1x} ${i1y} Z`;
}

function MultiOverlapCircles({
  rows,
  unique,
  overlap,
  overlapBadge,
}: {
  rows: Array<{ id: string; name: string; reach: number; color: string }>;
  unique: number;
  overlap: number;
  overlapBadge?: string;
}) {
  const n = rows.length;
  const maxR = n >= 5 ? 58 : 86;
  const minR = 14;
  const maxReach = Math.max(...rows.map((row) => row.reach), unique, overlap, 1);
  const sized = rows.map((row) => ({
    ...row,
    r: circleRadiusFromPercent(row.reach / maxReach, maxR, minR),
  }));
  const largestR = Math.max(...sized.map((row) => row.r));
  const spread = largestR * (n === 3 ? 0.62 : n === 4 ? 0.58 : 0.7);
  const cx0 = 120;
  const cy0 = n === 4 ? 96 : 90;
  const offsets =
    n === 2
      ? (() => {
          const iLarge = sized[0].r >= sized[1].r ? 0 : 1;
          const iSmall = 1 - iLarge;
          const rLarge = sized[iLarge].r;
          const rSmall = sized[iSmall].r;
          const k = rLarge / Math.sqrt(sized[iLarge].reach);
          const targetArea = Math.PI * k * k * Math.min(overlap, sized[0].reach, sized[1].reach);
          const d = distanceForOverlapArea(rLarge, rSmall, targetArea);
          const pair = [
            { x: 0, y: 0 },
            { x: 0, y: 0 },
          ];
          pair[iLarge] = { x: 0, y: 0 };
          pair[iSmall] = { x: -d, y: 0 };
          return pair;
        })()
      : vennOffsets(n, spread);
  const placed = sized.map((row, i) => ({
    ...row,
    cx: cx0 + (offsets[i]?.x ?? 0),
    cy: cy0 + (offsets[i]?.y ?? 0),
  }));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const row of placed) {
    minX = Math.min(minX, row.cx - row.r);
    minY = Math.min(minY, row.cy - row.r);
    maxX = Math.max(maxX, row.cx + row.r);
    maxY = Math.max(maxY, row.cy + row.r);
  }
  const pad = 8;
  const width = maxX - minX + pad * 2;
  const height = maxY - minY + pad * 2;
  const dx = pad - minX;
  const dy = pad - minY;
  const lensPath =
    placed.length === 2
      ? twoCircleLensPath(
          placed[0].cx + dx,
          placed[0].cy + dy,
          placed[0].r,
          placed[1].cx + dx,
          placed[1].cy + dy,
          placed[1].r,
        )
      : null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto max-h-[240px] w-auto max-w-[300px]"
      aria-hidden
    >
      {placed.map((row) => (
        <circle
          key={row.id}
          cx={row.cx + dx}
          cy={row.cy + dy}
          r={row.r}
          fill={row.color}
          fillOpacity="0.55"
        />
      ))}
      {lensPath ? (
        <path
          d={lensPath}
          fill="none"
          stroke="#1e293b"
          strokeWidth="1.75"
          strokeDasharray="5 3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {overlapBadge && placed.length === 2 ? (
        <text
          x={(placed[0].cx + placed[1].cx) / 2 + dx}
          y={(placed[0].cy + placed[1].cy) / 2 + dy + 4}
          textAnchor="middle"
          fill="#1e293b"
          fontSize="12"
          fontWeight="700"
        >
          {overlapBadge}
        </text>
      ) : null}
    </svg>
  );
}

function UniqueMetaLabel({
  value,
  label = "Unique Meta",
  hint,
}: {
  value: number;
  label?: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold leading-tight">{label}</p>
      <p className="break-words text-xl font-bold tabular-nums leading-tight text-foreground [overflow-wrap:anywhere]">
        {formatNumber(value)}
      </p>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

type PopulationOverlapVizProps = {
  sources: PopulationSourceRow[];
  union: number | null;
  overlap: number | null;
  uniqueLabel?: string;
  uniqueHint?: string;
  overlapBadge?: string;
  footerNote?: string;
};

export function PopulationOverlapViz({
  sources,
  union,
  overlap,
  uniqueLabel,
  uniqueHint,
  overlapBadge,
  footerNote,
}: PopulationOverlapVizProps) {
  const withReach = sources
    .filter((row): row is PopulationSourceRow & { reach: number } => row.reach != null && row.reach > 0)
    .map((row, index) => ({
      ...row,
      reach: row.reach,
      color: CIRCLE_COLORS[index % CIRCLE_COLORS.length],
    }));

  if (!withReach.length || union == null || overlap == null) {
    return (
      <p className="px-2 text-center text-xs text-muted-foreground">
        Visual overlap tersedia setelah reach Meta siap.
      </p>
    );
  }

  const unique = union;

  return (
    <div>
    <div className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-x-5">
      <div className="col-start-1 row-span-3 self-center pl-6">
        <MultiOverlapCircles
          rows={withReach}
          unique={unique}
          overlap={overlap}
          overlapBadge={overlapBadge}
        />
      </div>
      <div className="col-start-2 row-start-2 self-center">
        <span className="text-2xl font-semibold text-muted-foreground">=</span>
      </div>
      <div className="col-start-3 row-start-2 min-w-0 self-center">
        <UniqueMetaLabel value={unique} label={uniqueLabel} hint={uniqueHint} />
      </div>
      <div className="col-start-3 row-start-3 mt-7 min-w-0 self-start space-y-1 text-xs">
        {withReach.map((row) => {
          const pct =
            row.overlapPct != null && Number.isFinite(row.overlapPct)
              ? row.overlapPct
              : unique > 0
                ? (row.reach / unique) * 100
                : 0;
          const pctLabel = pct < 1 ? "< 1%" : `${Math.round(pct)}%`;
          return (
            <p key={row.id} className="flex items-start gap-1.5 text-muted-foreground">
              <span
                className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              <span className="min-w-0 flex-1 leading-snug">{row.name}</span>
              <span className="shrink-0 tabular-nums">
                {formatNumber(row.reach)} · {pctLabel}
              </span>
            </p>
          );
        })}
      </div>
    </div>
      {footerNote ? (
        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">{footerNote}</p>
      ) : null}
    </div>
  );
}
