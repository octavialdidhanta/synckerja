import { useTranslation } from "react-i18next";
import { Skeleton } from "@/shared/components/ui/skeleton";
import type { TikTokShopPeriodSummary } from "@/tiktok-shop/hooks/useTikTokShopPeriodSummaryQuery";
import { formatTikTokShopMoney } from "@/tiktok-shop/lib/formatTikTokShopMoney";

type Props = {
  summary: TikTokShopPeriodSummary | null | undefined;
  isLoading?: boolean;
};

function formatCount(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function KpiCard({
  label,
  value,
  isLoading,
}: {
  label: string;
  value: string;
  isLoading?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {isLoading ? (
        <Skeleton className="mt-2 h-7 w-28" />
      ) : (
        <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
      )}
    </div>
  );
}

export function TikTokShopDashboardSummaryBar({ summary, isLoading = false }: Props) {
  const { t } = useTranslation();
  const currency = summary?.currency ?? "IDR";

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <KpiCard
          label={t("digitalMarketing.tiktokShop.dashboard.kpiGmv", "GMV")}
          value={formatTikTokShopMoney(summary?.gmv ?? 0, currency)}
          isLoading={isLoading}
        />
        <KpiCard
          label={t("digitalMarketing.tiktokShop.dashboard.kpiOrders", "Orders")}
          value={formatCount(summary?.order_count ?? 0)}
          isLoading={isLoading}
        />
        <KpiCard
          label={t("digitalMarketing.tiktokShop.dashboard.kpiUnits", "Units sold")}
          value={formatCount(summary?.units_sold ?? 0)}
          isLoading={isLoading}
        />
      </div>
      {summary?.truncated ? (
        <p className="text-[11px] text-muted-foreground">
          {t(
            "digitalMarketing.tiktokShop.dashboard.summaryTruncated",
            "Summary capped at {{count}} orders for this date range.",
            { count: (summary.pages_fetched ?? 0) * 50 },
          )}
        </p>
      ) : null}
    </div>
  );
}
