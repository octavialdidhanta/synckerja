import { memo } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

interface OverviewFooterProps {
  totalMetrics: number;
  lastUpdated: Date;
  onRefresh: () => void | Promise<void>;
  isRefreshing: boolean;
}

export const OverviewFooter = memo(function OverviewFooter({
  totalMetrics,
  lastUpdated,
  onRefresh,
  isRefreshing,
}: OverviewFooterProps) {
  const { t, i18n } = useTranslation();

  return (
    <div className="flex min-h-10 flex-shrink-0 items-center border-t border-border bg-muted/40 px-4 py-2">
      <div className="flex min-h-7 w-full items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{t("subscription.overview.footerTotalMetrics", { count: totalMetrics })}</span>
          <span>
            {t("subscription.overview.footerLastUpdated")}{" "}
            {lastUpdated.toLocaleTimeString(i18n.language === "id" ? "id-ID" : "en-US")}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => void onRefresh()}
          disabled={isRefreshing}
          className="-my-1 h-7 px-2 text-xs"
        >
          <RefreshCw className={`mr-1 h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
          {t("subscription.overview.footerRefresh")}
        </Button>
      </div>
    </div>
  );
});
