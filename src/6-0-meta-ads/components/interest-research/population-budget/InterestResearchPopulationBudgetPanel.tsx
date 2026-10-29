import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { type InterestResearchFilters, type MetaTargetingItem } from "@/meta-ads/hooks/useMetaAdsTargeting";
import { computePopulationBudget } from "./populationBudgetMath";
import { useInterestResearchPopulationReach } from "./useInterestResearchPopulationReach";
import { PopulationOverlapViz } from "./PopulationOverlapViz";

const normalizeCurrencyValue = (value: string) => value.replace(/[^\d]/g, "");

const formatCurrencyDisplay = (value: string) => {
  if (!value) return "";
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return "";
  return new Intl.NumberFormat("id-ID").format(numericValue);
};

const currencyStringToNumber = (value: string) => {
  const numericValue = Number(value);
  return Number.isNaN(numericValue) ? 0 : numericValue;
};

const formatNumber = (num: number) => new Intl.NumberFormat("id-ID").format(Math.round(num));

const formatCurrency = (num: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);

export type PopulationBudgetSession = {
  listId?: string | null;
  listName: string;
  items: MetaTargetingItem[];
  targetingGroups?: MetaTargetingItem[][];
};

type InterestResearchPopulationBudgetPanelProps = {
  organizationId: string;
  adAccountId: string;
  filters: InterestResearchFilters | null;
  items: MetaTargetingItem[];
  targetingGroups?: MetaTargetingItem[][];
  onCalculatedDailyBudget?: (dailyBudget: number | null) => void;
};

export function InterestResearchPopulationBudgetPanel({
  organizationId,
  adAccountId,
  filters,
  items,
  targetingGroups,
  onCalculatedDailyBudget,
}: InterestResearchPopulationBudgetPanelProps) {
  const { t } = useTranslation();
  const [cpm, setCpm] = useState("");
  const [frequency, setFrequency] = useState("");
  const [days, setDays] = useState("");
  const { population, sources, officialOverlap, loading, error, truncated } =
    useInterestResearchPopulationReach({
    enabled: true,
    organizationId,
    adAccountId,
    filters,
    items,
    targetingGroups,
  });

  const results = useMemo(
    () =>
      computePopulationBudget({
        population: population ?? 0,
        cpm: currencyStringToNumber(cpm),
        frequency: Number(frequency) || 0,
        days: Number(days) || 0,
      }),
    [population, cpm, frequency, days],
  );

  useEffect(() => {
    const daily = results.dailyBudget;
    onCalculatedDailyBudget?.(Number.isFinite(daily) && daily > 0 ? daily : null);
  }, [onCalculatedDailyBudget, results.dailyBudget]);

  const populationLabel = population == null ? "—" : formatNumber(population);
  const rowSum = sources.reduce((sum, row) => sum + (row.reach ?? 0), 0);
  const hasRowReaches = sources.some((row) => row.reach != null);
  const impliedOverlap =
    officialOverlap != null
      ? officialOverlap
      : population != null && hasRowReaches && rowSum > 0
        ? Math.max(0, rowSum - population)
        : null;

  return (
    <div className="min-w-0 space-y-5 px-4 py-4">
      <div className="min-w-0 text-center">
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0 overflow-hidden rounded-lg border-2 border-dashed border-primary/25 bg-brand-blue-soft/80 px-3 py-4 sm:px-4">
            <h3 className="mb-2 text-sm font-semibold text-brand-blue-on-soft sm:text-base">
              {t("digitalMarketing.metaAds.populationBudgetPopulation", "Populasi")}
            </h3>
            <div className="break-words font-bold tabular-nums leading-tight text-primary [overflow-wrap:anywhere] text-[clamp(1.15rem,2.2vw,1.75rem)]">
              {loading ? <Loader2 className="mx-auto h-7 w-7 animate-spin" /> : populationLabel}
            </div>
          </div>
          <div className="min-w-0 overflow-hidden rounded-lg border-2 border-dashed border-primary/20 bg-success-muted px-3 py-4 sm:px-4">
            <h3 className="mb-2 text-sm font-semibold text-success-foreground sm:text-base">
              {t("digitalMarketing.metaAds.populationBudgetTotal", "Total budget")}
            </h3>
            <div className="break-words font-bold tabular-nums leading-tight text-primary [overflow-wrap:anywhere] text-[clamp(1.15rem,2.2vw,1.75rem)]">
              {formatCurrency(results.totalBudget)}
            </div>
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </div>

      <Card className="min-w-0 overflow-hidden text-left">
        <CardContent className="p-4">
          {loading && sources.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {t("digitalMarketing.metaAds.populationBudgetBreakdown", "Asal populasi")}
                </p>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {sources.map((row) => (
                    <li key={row.id} className="flex min-w-0 items-baseline justify-between gap-3">
                      <span className="truncate">{row.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {row.reach == null ? "—" : formatNumber(row.reach)}
                      </span>
                    </li>
                  ))}
                  {hasRowReaches ? (
                    <li className="flex min-w-0 items-baseline justify-between gap-3 border-t pt-1.5 text-muted-foreground">
                      <span>{t("digitalMarketing.metaAds.populationBudgetRowSum", "Jumlah reach")}</span>
                      <span className="shrink-0 tabular-nums">{formatNumber(rowSum)}</span>
                    </li>
                  ) : null}
                  {impliedOverlap != null ? (
                    <li className="flex min-w-0 items-baseline justify-between gap-3 text-muted-foreground">
                      <span>
                        {t("digitalMarketing.metaAds.populationBudgetImpliedOverlap", "Overlap")}
                      </span>
                      <span className="shrink-0 tabular-nums">{formatNumber(impliedOverlap)}</span>
                    </li>
                  ) : null}
                  <li className="flex min-w-0 items-baseline justify-between gap-3 font-semibold">
                    <span>{t("digitalMarketing.metaAds.populationBudgetUnionUsed", "Unique Meta")}</span>
                    <span className="shrink-0 tabular-nums">{populationLabel}</span>
                  </li>
                </ul>
                {hasRowReaches && impliedOverlap != null && population != null ? (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {t(
                      "digitalMarketing.metaAds.populationBudgetWhyUnion",
                      "Sama dengan Audience Overlap: ukuran minat, overlap, dan % overlap (overlap ÷ minat). Unique = jumlah reach − overlap.",
                      {
                        union: formatNumber(population),
                        sum: formatNumber(rowSum),
                        overlap: formatNumber(impliedOverlap),
                      },
                    )}
                  </p>
                ) : null}
                {truncated ? (
                  <p className="mt-2 text-xs text-muted-foreground">Max 8 interests</p>
                ) : null}
              </div>
              <div className="min-w-0 border-t pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                <p className="text-sm font-semibold">Overlap</p>
                <div className="mt-3">
                  <PopulationOverlapViz sources={sources} union={population} overlap={impliedOverlap} />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <MetricCard
          label={t("digitalMarketing.metaAds.populationBudgetImpressions", "Impressions")}
          value={formatNumber(results.impressions)}
        />
        <MetricCard
          label={t("digitalMarketing.metaAds.populationBudgetDaily", "Budget harian")}
          value={formatCurrency(results.dailyBudget)}
        />
        <MetricCard
          label="CPM"
          value={cpm ? formatCurrency(currencyStringToNumber(cpm)) : formatCurrency(0)}
        />
        <MetricCard label="Frequency" value={frequency || "—"} />
      </div>

      <div className="min-w-0">
        <p className="mb-3 text-sm font-medium">
          {t("pages.calculator.sales.tabs.basic", "Basic Settings")}
        </p>
        <Card className="min-w-0 border border-primary/15 bg-brand-blue-soft">
          <CardContent className="grid min-w-0 grid-cols-1 gap-4 pt-6 sm:grid-cols-2">
            <div className="min-w-0">
              <Label htmlFor="population-budget-cpm">
                {t("pages.calculator.sales.cpm", "CPM (Rp)")}
              </Label>
              <Input
                id="population-budget-cpm"
                type="text"
                inputMode="numeric"
                value={formatCurrencyDisplay(cpm)}
                onChange={(e) => setCpm(normalizeCurrencyValue(e.target.value))}
                className="mt-1 min-w-0"
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor="population-budget-frequency">
                {t("digitalMarketing.metaAds.populationBudgetFrequency", "Frequency")}
              </Label>
              <Input
                id="population-budget-frequency"
                type="number"
                min={0}
                step={0.1}
                value={frequency}
                disabled={!(Number(days) > 0)}
                onChange={(e) => setFrequency(e.target.value)}
                className="mt-1 min-w-0"
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor="population-budget-days">
                {t("digitalMarketing.metaAds.populationBudgetDays", "Hari")}
              </Label>
              <Input
                id="population-budget-days"
                type="number"
                min={0}
                step={1}
                value={days}
                onChange={(e) => {
                  const next = e.target.value;
                  setDays(next);
                  if (!(Number(next) > 0)) setFrequency("");
                }}
                className="mt-1 min-w-0"
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor="population-budget-pop">
                {t("digitalMarketing.metaAds.populationBudgetPopulation", "Populasi")}
              </Label>
              <div className="relative mt-1">
                <Input
                  id="population-budget-pop"
                  readOnly
                  value={loading ? "" : populationLabel}
                  className="min-w-0 bg-muted/60 tabular-nums"
                />
                {loading ? (
                  <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="space-y-0 p-3 pb-1">
        <CardTitle className="text-sm font-medium leading-snug text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div
          className="break-words font-semibold tabular-nums leading-snug text-foreground [overflow-wrap:anywhere] text-[clamp(1rem,1.8vw,1.25rem)]"
          title={value}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
