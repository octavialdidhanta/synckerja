import { useTranslation } from "react-i18next";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";
import type { TikTokAdsMetricsSort, TikTokAdsSortColumnOption } from "@/tiktok-ads/metrics/tiktokAdsSortColumns";
import {
  getTikTokAdsSortColumnKind,
  sortDirectionLabelKeys,
} from "@/tiktok-ads/metrics/tiktokAdsSortColumns";

type Props = {
  totalCount: number;
  sort: TikTokAdsMetricsSort;
  sortColumnOptions: TikTokAdsSortColumnOption[];
  cached?: boolean;
  isLoading?: boolean;
  onSortFieldChange: (field: string) => void;
  onSortDirectionChange: (direction: "asc" | "desc") => void;
  className?: string;
};

export function TikTokAdsMetricsTableFooter({
  totalCount,
  sort,
  sortColumnOptions,
  cached,
  isLoading,
  onSortFieldChange,
  onSortDirectionChange,
  className,
}: Props) {
  const { t } = useTranslation();

  const sortFieldValue = sortColumnOptions.some((o) => o.key === sort.field)
    ? sort.field
    : (sortColumnOptions[0]?.key ?? "spend");

  const kind = getTikTokAdsSortColumnKind(sortFieldValue);
  const dirKeys = sortDirectionLabelKeys(kind);
  const sortDirectionLabels = {
    desc: t(dirKeys.descKey, dirKeys.descDefault),
    asc: t(dirKeys.ascKey, dirKeys.ascDefault),
  };

  const rangeFrom = totalCount === 0 ? 0 : 1;
  const rangeTo = totalCount;

  const rangeDisplay =
    totalCount === 0 ? (
      <span className="tabular-nums text-sm text-gray-600">
        {t("digitalMarketing.tiktokAds.tableRangeEmpty", "0 - 0 of 0")}
      </span>
    ) : (
      <span className="flex flex-wrap items-baseline justify-end gap-x-1.5 tabular-nums text-sm text-gray-700">
        <span className="font-medium text-gray-800">
          {rangeFrom} - {rangeTo}
        </span>
        <span className="text-gray-500">
          {t("digitalMarketing.tiktokAds.tableRangeOf", "of")} {totalCount}
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
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {rangeDisplay}
        {cached ? (
          <span className="text-xs text-muted-foreground">
            ({t("digitalMarketing.tiktokAds.cached", "cached")})
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Label className="sr-only">{t("digitalMarketing.tiktokAds.sortBy", "Sort by")}</Label>
        <Select
          value={sortFieldValue}
          onValueChange={onSortFieldChange}
          disabled={isLoading || sortColumnOptions.length === 0}
        >
          <SelectTrigger className="h-8 w-[min(140px,32vw)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortColumnOptions.map((o) => (
              <SelectItem key={o.key} value={o.key}>
                {t(o.labelKey, o.defaultLabel)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sort.direction}
          onValueChange={(v) => onSortDirectionChange(v as "asc" | "desc")}
          disabled={isLoading}
        >
          <SelectTrigger className="h-8 w-[116px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">{sortDirectionLabels.desc}</SelectItem>
            <SelectItem value="asc">{sortDirectionLabels.asc}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
