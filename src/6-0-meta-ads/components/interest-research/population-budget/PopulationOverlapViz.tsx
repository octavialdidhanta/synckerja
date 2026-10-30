import { useId, type ReactNode } from "react";
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

function twoCircleLensCenter(
  a: { cx: number; cy: number; r: number },
  b: { cx: number; cy: number; r: number },
): { x: number; y: number } {
  const vx = b.cx - a.cx;
  const vy = b.cy - a.cy;
  const dist = Math.hypot(vx, vy);
  if (dist < 0.5) return { x: (a.cx + b.cx) / 2, y: (a.cy + b.cy) / 2 };
  const tMin = Math.max(0, dist - b.r);
  const tMax = Math.min(dist, a.r);
  const t = (tMin + tMax) / 2;
  return { x: a.cx + (t * vx) / dist, y: a.cy + (t * vy) / dist };
}

function NestedClip({ ids, children }: { ids: string[]; children: ReactNode }) {
  if (!ids.length) return <>{children}</>;
  const [first, ...rest] = ids;
  return (
    <g clipPath={`url(#${first})`}>
      <NestedClip ids={rest}>{children}</NestedClip>
    </g>
  );
}

function overlapShareLabel(reach: number, unique: number, overlapPct?: number | null): string {
  const pct =
    overlapPct != null && Number.isFinite(overlapPct)
      ? overlapPct
      : unique <= 0 || reach <= 0
        ? 0
        : unique >= reach
          ? (reach / unique) * 100
          : (unique / reach) * 100;
  if (pct < 1) return "< 1%";
  if (pct > 100) return "100%";
  return `${Math.round(pct)}%`;
}

function MultiOverlapCircles({
  rows,
  unique,
  overlap,
  overlapBadge,
  size = "default",
  outlineMode = "union",
}: {
  rows: Array<{ id: string; name: string; reach: number; color: string }>;
  unique: number;
  overlap: number;
  overlapBadge?: string;
  size?: "default" | "lg";
  outlineMode?: "union" | "intersection";
}) {
  const clipId = useId().replace(/:/g, "");
  const n = rows.length;
  const large = size === "lg";
  const maxR = large ? (n >= 5 ? 88 : 128) : n >= 5 ? 58 : 86;
  const minR = large ? 22 : 14;
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
  const pad = 10;
  const width = maxX - minX + pad * 2;
  const height = maxY - minY + pad * 2;
  const dx = pad - minX;
  const dy = pad - minY;
  const a = placed[0]
    ? { cx: placed[0].cx + dx, cy: placed[0].cy + dy, r: placed[0].r }
    : null;
  const b = placed[1]
    ? { cx: placed[1].cx + dx, cy: placed[1].cy + dy, r: placed[1].r }
    : null;
  const showOutline = placed.length >= 2;
  const lensWidth =
    a && b ? Math.max(0, a.r + b.r - Math.hypot(b.cx - a.cx, b.cy - a.cy)) : 0;
  const largestPlaced = placed.reduce(
    (best, row) => (row.r > best.r ? row : best),
    placed[0] ?? { cx: 0, cy: 0, r: 0, id: "", name: "", reach: 0, color: "" },
  );
  const badgePos =
    outlineMode === "intersection" && a && b
      ? twoCircleLensCenter(a, b)
      : {
          x: largestPlaced.cx + dx,
          y: largestPlaced.cy + dy,
        };
  const showInSvgBadge = Boolean(
    overlapBadge && (outlineMode === "union" || lensWidth >= 36 || placed.length === 1),
  );

  return (
    <div className="flex flex-col items-center gap-1">
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={
        large
          ? "h-auto max-h-[380px] w-auto max-w-[520px]"
          : "h-auto max-h-[240px] w-auto max-w-[300px]"
      }
      aria-hidden
    >
      {showOutline ? (
        <defs>
          {placed.map((row, index) =>
            outlineMode === "union" ? (
              <mask
                key={`out-${row.id}`}
                id={`${clipId}-out-${index}`}
                maskUnits="userSpaceOnUse"
              >
                <rect width={width} height={height} fill="white" />
                {placed
                  .filter((_, other) => other !== index)
                  .map((other) => (
                    <circle
                      key={`hide-${other.id}`}
                      cx={other.cx + dx}
                      cy={other.cy + dy}
                      r={other.r}
                      fill="black"
                    />
                  ))}
              </mask>
            ) : (
              <clipPath key={row.id} id={`${clipId}-${index}`}>
                <circle cx={row.cx + dx} cy={row.cy + dy} r={row.r} />
              </clipPath>
            ),
          )}
        </defs>
      ) : null}
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
      {showOutline
        ? placed.map((row, index) =>
            outlineMode === "union" ? (
              <g key={`dash-${row.id}`} mask={`url(#${clipId}-out-${index})`}>
                <circle
                  cx={row.cx + dx}
                  cy={row.cy + dy}
                  r={row.r}
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="1.75"
                  strokeDasharray="5 3.5"
                  strokeLinecap="round"
                />
              </g>
            ) : (
              <NestedClip
                key={`dash-${row.id}`}
                ids={placed.map((_, other) => `${clipId}-${other}`).filter((id) => id !== `${clipId}-${index}`)}
              >
                <circle
                  cx={row.cx + dx}
                  cy={row.cy + dy}
                  r={row.r}
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="1.75"
                  strokeDasharray="5 3.5"
                  strokeLinecap="round"
                />
              </NestedClip>
            ),
          )
        : null}
      {showInSvgBadge && badgePos ? (
        <text
          x={badgePos.x}
          y={badgePos.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#1e293b"
          fontSize={large ? 14 : 12}
          fontWeight="700"
        >
          {overlapBadge}
        </text>
      ) : null}
    </svg>
    {overlapBadge && !showInSvgBadge ? (
      <p className="text-center text-xs font-semibold text-foreground">{overlapBadge}</p>
    ) : null}
    </div>
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
  size?: "default" | "lg";
  /** Union (Include OR) outlines the whole Unique. Intersection (Narrow AND) outlines the middle only. */
  outlineMode?: "union" | "intersection";
};

export function PopulationOverlapViz({
  sources,
  union,
  overlap,
  uniqueLabel,
  uniqueHint,
  overlapBadge,
  footerNote,
  size = "default",
  outlineMode,
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
  const resolvedOutline: "union" | "intersection" =
    outlineMode ?? (unique > overlap * 1.12 ? "union" : "intersection");

  const spacious = size === "lg";

  return (
    <div className={spacious ? "w-full" : undefined}>
    <div
      className={
        spacious
          ? "grid w-full grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-x-6"
          : "grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] items-start gap-x-4"
      }
    >
      <div className={spacious ? "flex justify-center sm:justify-end" : "col-start-1 row-span-2 self-start"}>
        <MultiOverlapCircles
          rows={withReach}
          unique={unique}
          overlap={overlap}
          overlapBadge={overlapBadge}
          size={size}
          outlineMode={resolvedOutline}
        />
      </div>
      <div className={spacious ? "flex items-center justify-center" : "col-start-2 row-span-2 self-center"}>
        <span className="text-2xl font-semibold text-muted-foreground">=</span>
      </div>
      <div className={spacious ? "min-w-0 space-y-5 sm:justify-self-start" : "contents"}>
        <div className={spacious ? "min-w-0" : "col-start-3 row-start-1 min-w-0 self-start"}>
          <UniqueMetaLabel value={unique} label={uniqueLabel} hint={uniqueHint} />
        </div>
        <div className={spacious ? "min-w-0 space-y-2 text-sm" : "col-start-3 row-start-2 mt-3 min-w-0 self-start space-y-1 text-xs"}>
        {withReach.map((row) => {
          const pctLabel = overlapShareLabel(row.reach, unique, row.overlapPct);
          return (
            <div key={row.id} className="flex min-w-0 items-start gap-2 text-muted-foreground">
              <span
                className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              <div className="min-w-0 flex-1">
                <p className="leading-snug">{row.name}</p>
                <p className="tabular-nums leading-snug">
                  {formatNumber(row.reach)} · {pctLabel}
                </p>
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
      {footerNote ? (
        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">{footerNote}</p>
      ) : null}
    </div>
  );
}
