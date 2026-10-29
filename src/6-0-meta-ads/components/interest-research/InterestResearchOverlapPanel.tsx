import { useId } from "react";
import { useTranslation } from "react-i18next";
import { formatAudienceSize } from "@/meta-ads/hooks/useMetaAdsTargeting";
import { cn } from "@/shared/lib/utils";

export type OverlapUsersRange = {
  lower: number | null;
  upper: number | null;
  mid: number;
};

export type InterestResearchOverlapResult = {
  approximate: boolean;
  method?: "and_reachestimate";
  a_label: string;
  b_label: string;
  a_users: OverlapUsersRange;
  b_users: OverlapUsersRange;
  intersection_users: OverlapUsersRange;
  overlap_users: number;
  overlap_pct_of_smaller: number | null;
  note?: string;
  country_code?: string;
};

type InterestResearchOverlapPanelProps = {
  result: InterestResearchOverlapResult;
  /** full = main workspace card; rail = narrow right column */
  variant?: "full" | "rail";
};

function rangeLabel(r: OverlapUsersRange): string {
  return formatAudienceSize(r.lower, r.upper);
}

function overlapInsight(
  pct: number | null,
  t: (key: string, fallback: string, opts?: Record<string, unknown>) => string,
): { tone: "high" | "medium" | "low"; text: string } {
  if (pct == null) {
    return {
      tone: "medium",
      text: t(
        "digitalMarketing.metaAds.interestOverlapInsightUnknown",
        "Tidak cukup data untuk persen overlap (privacy floor Meta).",
      ),
    };
  }
  if (pct >= 50) {
    return {
      tone: "high",
      text: t(
        "digitalMarketing.metaAds.interestOverlapInsightHigh",
        "Overlap tinggi ({{pct}}%). Pertimbangkan gabungkan di satu ad set atau exclude salah satunya agar tidak saling kanibal.",
        { pct: pct.toFixed(0) },
      ),
    };
  }
  if (pct >= 25) {
    return {
      tone: "medium",
      text: t(
        "digitalMarketing.metaAds.interestOverlapInsightMedium",
        "Overlap sedang ({{pct}}%). Boleh dipisah ad set, pantau delivery agar tidak terlalu saling bersaing.",
        { pct: pct.toFixed(0) },
      ),
    };
  }
  return {
    tone: "low",
    text: t(
      "digitalMarketing.metaAds.interestOverlapInsightLow",
      "Overlap rendah ({{pct}}%). Relatif aman dipisah ke ad set berbeda.",
      { pct: pct.toFixed(0) },
    ),
  };
}

function rangeMid(r: OverlapUsersRange): number {
  if (Number.isFinite(r.mid) && r.mid > 0) return r.mid;
  if (r.lower != null && r.upper != null) return (r.lower + r.upper) / 2;
  return r.lower ?? r.upper ?? 0;
}

/** Intersection area of two circles (radii r, R, center distance d). */
function circleLensArea(r: number, R: number, d: number): number {
  if (d <= Math.abs(R - r)) return Math.PI * Math.min(r, R) ** 2;
  if (d >= r + R) return 0;
  const r2 = r * r;
  const R2 = R * R;
  const d2 = d * d;
  const alpha = Math.acos(Math.min(1, Math.max(-1, (d2 + r2 - R2) / (2 * d * r))));
  const beta = Math.acos(Math.min(1, Math.max(-1, (d2 + R2 - r2) / (2 * d * R))));
  return r2 * alpha + R2 * beta - 0.5 * Math.sqrt(Math.max(0, (-d + r + R) * (d + r - R) * (d - r + R) * (d + r + R)));
}

function distanceForLensArea(r: number, R: number, targetArea: number): number {
  const contained = Math.abs(R - r);
  const separate = r + R;
  const maxArea = Math.PI * Math.min(r, R) ** 2;
  if (targetArea >= maxArea * 0.995) return contained;
  if (targetArea <= 1e-6) return separate;
  let lo = contained;
  let hi = separate;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (circleLensArea(r, R, mid) > targetArea) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function layoutVenn(sizeA: number, sizeB: number, sizeAnd: number) {
  const a = Math.max(sizeA, 1);
  const b = Math.max(sizeB, 1);
  const and = Math.max(0, Math.min(sizeAnd, Math.min(a, b)));
  const maxUsers = Math.max(a, b);
  const maxR = 72;
  const minR = 26;
  const rA = Math.max(minR, maxR * Math.sqrt(a / maxUsers));
  const rB = Math.max(minR, maxR * Math.sqrt(b / maxUsers));
  const fracOfSmaller = and / Math.min(a, b);
  const targetArea = Math.PI * Math.min(rA, rB) ** 2 * fracOfSmaller;
  const d = distanceForLensArea(rA, rB, targetArea);
  const pad = 18;
  const cy = Math.max(rA, rB) + pad;
  const cxA = rA + pad;
  const cxB = cxA + d;
  const width = cxB + rB + pad;
  const height = Math.max(rA, rB) * 2 + pad * 2;
  const bboxCenterX = (cxA - rA + cxB + rB) / 2;
  const smallerCx = rB <= rA ? cxB : cxA;
  const smallerR = Math.min(rA, rB);
  const largerCx = rB <= rA ? cxA : cxB;
  let badgeX = bboxCenterX;
  if (Math.abs(badgeX - smallerCx) < smallerR * 0.62) {
    const dir = largerCx < smallerCx ? -1 : 1;
    badgeX = smallerCx + dir * (smallerR + 10);
  }
  return { rA, rB, cxA, cxB, cy, width, height, badgeX };
}

/** Area ∝ Potential Reach; jarak pusat mengikuti luas irisan AND. */
export function OverlapVenn({
  pctLabel,
  sizeA,
  sizeB,
  sizeAnd,
  size = 240,
  compact = false,
}: {
  pctLabel: string;
  sizeA: number;
  sizeB: number;
  sizeAnd: number;
  size?: number;
  compact?: boolean;
}) {
  const clipId = useId().replace(/:/g, "");
  const layout = layoutVenn(sizeA, sizeB, sizeAnd);
  const h = Math.round(size * (layout.height / layout.width));
  const aTagX = ((layout.cxA - layout.rA * 0.55) / layout.width) * 100;
  const bTagX = ((layout.cxB + layout.rB * 0.15) / layout.width) * 100;
  const badgeLeft = (layout.badgeX / layout.width) * 100;
  const badgeTop = (layout.cy / layout.height) * 100;
  const minH = compact ? 56 : 96;

  return (
    <div className={cn("relative", compact ? "mx-0" : "mx-auto")} style={{ width: size, height: Math.max(h, minH) }}>
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="h-full w-full"
        aria-hidden
      >
        <defs>
          <clipPath id={`${clipId}-a`}>
            <circle cx={layout.cxA} cy={layout.cy} r={layout.rA} />
          </clipPath>
        </defs>
        <circle
          cx={layout.cxA}
          cy={layout.cy}
          r={layout.rA}
          fill="#3B82F6"
          fillOpacity="0.28"
          stroke="#2563EB"
          strokeWidth="2"
        />
        <circle
          cx={layout.cxB}
          cy={layout.cy}
          r={layout.rB}
          fill="#10B981"
          fillOpacity="0.28"
          stroke="#059669"
          strokeWidth="2"
        />
        <circle
          cx={layout.cxB}
          cy={layout.cy}
          r={layout.rB}
          fill="#0F766E"
          fillOpacity="0.22"
          clipPath={`url(#${clipId}-a)`}
        />
      </svg>
      <div
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${badgeLeft}%`, top: `${badgeTop}%` }}
      >
        <div
          className={cn(
            "rounded-full bg-white/95 text-center shadow-sm ring-1 ring-black/5",
            compact ? "px-1.5 py-0.5" : "px-2.5 py-1",
          )}
        >
          {compact ? null : (
            <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Overlap</p>
          )}
          <p
            className={cn(
              "font-bold tabular-nums leading-none text-slate-900",
              compact ? "text-[11px]" : "text-lg",
            )}
          >
            {pctLabel}
          </p>
        </div>
      </div>
      {compact ? null : (
        <>
          <span
            className="absolute top-1 -translate-x-1/2 rounded bg-blue-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white"
            style={{ left: `${aTagX}%` }}
          >
            A
          </span>
          <span
            className="absolute top-1 -translate-x-1/2 rounded bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white"
            style={{ left: `${bTagX}%` }}
          >
            B
          </span>
        </>
      )}
    </div>
  );
}

export function InterestResearchOverlapPanel({
  result,
  variant = "full",
}: InterestResearchOverlapPanelProps) {
  const { t } = useTranslation();
  const pct = result.overlap_pct_of_smaller;
  const pctLabel = pct != null ? `${pct.toFixed(1)}%` : "—";
  const insight = overlapInsight(pct, t);
  const isRail = variant === "rail";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
        isRail ? "p-3" : "p-4",
      )}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-bold text-slate-900">
              {t("digitalMarketing.metaAds.interestOverlapTitle", "Audience Overlap")}
            </h4>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
              {t("digitalMarketing.metaAds.interestEstimateBadge", "Estimasi %")}
            </span>
            {result.country_code ? (
              <span className="text-[11px] text-slate-400">{result.country_code}</span>
            ) : null}
          </div>
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            {t(
              "digitalMarketing.metaAds.interestOverlapAdsumoHint",
              "Jumlah irisan = Potential Reach A AND B (resmi Meta). Persen turunan. Bukan overlap Ads Manager.",
            )}
          </p>
        </div>
      </div>

      <OverlapVenn
        pctLabel={pctLabel}
        sizeA={rangeMid(result.a_users)}
        sizeB={rangeMid(result.b_users)}
        sizeAnd={rangeMid(result.intersection_users) || result.overlap_users}
        size={isRail ? 180 : 260}
      />

      <div className={cn("mt-3 grid gap-2", isRail ? "grid-cols-1" : "sm:grid-cols-2")}>
        <AudienceCard
          tag="A"
          tagClass="bg-blue-600"
          name={result.a_label}
          size={rangeLabel(result.a_users)}
        />
        <AudienceCard
          tag="B"
          tagClass="bg-emerald-600"
          name={result.b_label}
          size={rangeLabel(result.b_users)}
        />
      </div>

      <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {t("digitalMarketing.metaAds.interestOverlapPeople", "Orang di kedua interest")}
          </p>
          <p className="text-lg font-bold tabular-nums text-slate-900">
            {formatAudienceSize(
              result.intersection_users.lower,
              result.intersection_users.upper,
            )}
          </p>
        </div>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {pct != null
            ? t(
                "digitalMarketing.metaAds.interestOverlapOfSmallerFull",
                "{{pct}} dari interest yang lebih kecil",
                { pct: pctLabel },
              )
            : t(
                "digitalMarketing.metaAds.interestOverlapPctUnavailable",
                "Persen tidak dihitung (privacy floor atau data tidak cukup).",
              )}
        </p>
      </div>

      <div
        className={cn(
          "mt-3 rounded-lg px-3 py-2 text-xs leading-relaxed",
          insight.tone === "high" && "bg-rose-50 text-rose-900 ring-1 ring-rose-100",
          insight.tone === "medium" && "bg-amber-50 text-amber-950 ring-1 ring-amber-100",
          insight.tone === "low" && "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100",
        )}
      >
        {insight.text}
      </div>
    </div>
  );
}

function AudienceCard({
  tag,
  tagClass,
  name,
  size,
}: {
  tag: string;
  tagClass: string;
  name: string;
  size: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="mb-1 flex items-center gap-1.5">
        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold text-white", tagClass)}>
          {tag}
        </span>
      </div>
      <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900" title={name}>
        {name}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Reach{" "}
        <span className="font-semibold tabular-nums text-slate-800">{size}</span>
      </p>
    </div>
  );
}
