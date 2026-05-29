import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";

export const GOOGLE_ADS_TABLE_PAGE_SIZES = [25, 50, 100] as const;

type GoogleAdsMetricsTableFooterProps = {
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  rangeFrom: number;
  rangeTo: number;
  totalCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  hasLastPage: boolean;
  isLoading?: boolean;
  onFirstPage: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onLastPage: () => void;
  className?: string;
};

export function GoogleAdsMetricsTableFooter({
  pageSize,
  onPageSizeChange,
  rangeFrom,
  rangeTo,
  totalCount,
  hasPreviousPage,
  hasNextPage,
  hasLastPage,
  isLoading,
  onFirstPage,
  onPreviousPage,
  onNextPage,
  onLastPage,
  className,
}: GoogleAdsMetricsTableFooterProps) {
  const { t } = useTranslation();

  const isEmpty = rangeTo === 0;

  const rangeDisplay = isEmpty ? (
      <span className="tabular-nums text-sm text-gray-600">
        {t("digitalMarketing.googleAds.tableRangeEmpty", "0 - 0 of 0")}
      </span>
    ) : (
      <span className="flex flex-wrap items-baseline justify-end gap-x-1.5 tabular-nums text-sm text-gray-700">
        <span className="font-medium text-gray-800">
          {rangeFrom} - {rangeTo}
        </span>
        <span className="text-gray-500">
          {t("digitalMarketing.googleAds.tableRangeOf", "of")}
        </span>
        <span className="font-semibold text-gray-900">
          {totalCount > 0 ? totalCount : rangeTo}
        </span>
      </span>
    );

  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50/95 px-4 py-2.5",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span className="whitespace-nowrap">
          {t("digitalMarketing.googleAds.tableShowRows", "Show rows")}
        </span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => onPageSizeChange(Number(v))}
          disabled={isLoading}
        >
          <SelectTrigger className="h-8 w-[4.5rem] border-gray-300 bg-white px-2 text-sm font-normal text-gray-900 shadow-none focus:ring-brand-blue/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            {GOOGLE_ADS_TABLE_PAGE_SIZES.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-3">
          {rangeDisplay}
          <div className="flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-400 hover:text-gray-900 disabled:opacity-35"
          disabled={!hasPreviousPage || isLoading}
          title={t("common.firstPage", "First page")}
          aria-label={t("common.firstPage", "First page")}
          onClick={onFirstPage}
        >
          <ChevronsLeft className="h-4 w-4" strokeWidth={2} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-400 hover:text-gray-900 disabled:opacity-35"
          disabled={!hasPreviousPage || isLoading}
          title={t("common.previous", "Previous")}
          aria-label={t("common.previous", "Previous")}
          onClick={onPreviousPage}
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-700 hover:text-gray-900 disabled:opacity-35"
          disabled={!hasNextPage || isLoading}
          title={t("common.next", "Next")}
          aria-label={t("common.next", "Next")}
          onClick={onNextPage}
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-700 hover:text-gray-900 disabled:opacity-35"
          disabled={!hasLastPage || isLoading}
          title={t("common.lastPage", "Last page")}
          aria-label={t("common.lastPage", "Last page")}
          onClick={onLastPage}
        >
          <ChevronsRight className="h-4 w-4" strokeWidth={2} />
        </Button>
          </div>
      </div>
    </div>
  );
}
