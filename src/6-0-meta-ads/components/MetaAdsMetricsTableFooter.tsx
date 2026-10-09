import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";
import type { MetaAdsMetricsSort, MetaAdsSortColumnOption } from "@/meta-ads/metrics/metaAdsSortColumns";
import {
  getMetaAdsSortColumnKind,
  sortDirectionLabelKeys,
} from "@/meta-ads/metrics/metaAdsSortColumns";

type Props = {
  totalCount: number;
  sort: MetaAdsMetricsSort;
  sortColumnOptions: MetaAdsSortColumnOption[];
  cached?: boolean;
  isLoading?: boolean;
  onSortFieldChange: (field: string) => void;
  onSortDirectionChange: (direction: "asc" | "desc") => void;
  className?: string;
};

export function MetaAdsMetricsTableFooter({
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
  const [sortQuery, setSortQuery] = useState("");
  const sortSearchRef = useRef<HTMLInputElement>(null);

  const sortFieldValue = sortColumnOptions.some((o) => o.key === sort.field)
    ? sort.field
    : (sortColumnOptions[0]?.key ?? "spend");

  const kind = getMetaAdsSortColumnKind(sortFieldValue);
  const dirKeys = sortDirectionLabelKeys(kind);
  const sortDirectionLabels = {
    desc: t(dirKeys.descKey, dirKeys.descDefault),
    asc: t(dirKeys.ascKey, dirKeys.ascDefault),
  };

  const filteredSortOptions = useMemo(() => {
    const query = sortQuery.trim().toLowerCase();
    if (!query) return sortColumnOptions;
    return sortColumnOptions.filter((option) =>
      t(option.labelKey, option.defaultLabel).toLowerCase().includes(query),
    );
  }, [sortColumnOptions, sortQuery, t]);

  const rangeFrom = totalCount === 0 ? 0 : 1;
  const rangeTo = totalCount;

  const rangeDisplay =
    totalCount === 0 ? (
      <span className="tabular-nums text-sm text-gray-600">
        {t("digitalMarketing.metaAds.tableRangeEmpty", "0 - 0 of 0")}
      </span>
    ) : (
      <span className="flex flex-wrap items-baseline justify-end gap-x-1.5 tabular-nums text-sm text-gray-700">
        <span className="font-medium text-gray-800">
          {rangeFrom} - {rangeTo}
        </span>
        <span className="text-gray-500">
          {t("digitalMarketing.metaAds.tableRangeOf", "of")} {totalCount}
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
            ({t("digitalMarketing.metaAds.cached", "cached")})
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Label className="sr-only">{t("digitalMarketing.metaAds.sortBy", "Sort by")}</Label>
        <Select
          value={sortFieldValue}
          onValueChange={onSortFieldChange}
          onOpenChange={(open) => {
            if (!open) setSortQuery("");
          }}
          disabled={isLoading || sortColumnOptions.length === 0}
        >
          <SelectTrigger className="h-8 w-[min(140px,32vw)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            className="max-h-80"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              sortSearchRef.current?.focus();
            }}
          >
            <div
              className="sticky top-0 z-10 bg-popover px-1 pb-1"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={sortSearchRef}
                  value={sortQuery}
                  onChange={(event) => setSortQuery(event.target.value)}
                  onKeyDown={(event) => event.stopPropagation()}
                  placeholder={t("digitalMarketing.metaAds.sortSearch", "Search")}
                  aria-label={t("digitalMarketing.metaAds.sortSearch", "Search")}
                  className="h-8 pl-7 text-sm"
                />
              </div>
            </div>
            {filteredSortOptions.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                {t("digitalMarketing.metaAds.sortSearchEmpty", "No columns found")}
              </p>
            ) : (
              filteredSortOptions.map((o) => (
                <SelectItem key={o.key} value={o.key}>
                  {t(o.labelKey, o.defaultLabel)}
                </SelectItem>
              ))
            )}
            {sortQuery.trim() && !filteredSortOptions.some((o) => o.key === sortFieldValue) ? (
              <SelectItem value={sortFieldValue} className="hidden">
                {t(
                  sortColumnOptions.find((o) => o.key === sortFieldValue)?.labelKey ?? "",
                  sortColumnOptions.find((o) => o.key === sortFieldValue)?.defaultLabel ?? sortFieldValue,
                )}
              </SelectItem>
            ) : null}
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
