import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import type { MetaAdsMetricEntity } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import type { MetaAdsParentOption } from "@/meta-ads/metrics/metaAdsParentFilters";

const ALL_VALUE = "all";

type Props = {
  entity: MetaAdsMetricEntity;
  campaignId: string | null;
  onCampaignChange: (id: string | null) => void;
  campaignOptions: MetaAdsParentOption[];
  adsetId: string | null;
  onAdsetChange: (id: string | null) => void;
  adsetOptions: MetaAdsParentOption[];
  adsetOptionsLoading?: boolean;
  layout?: "inline" | "stacked";
  controlSize?: "sm" | "md";
};

export function MetaAdsParentFilterSelects({
  entity,
  campaignId,
  onCampaignChange,
  campaignOptions,
  adsetId,
  onAdsetChange,
  adsetOptions,
  adsetOptionsLoading = false,
  layout = "inline",
  controlSize = "sm",
}: Props) {
  const { t } = useAppTranslation();
  if (entity !== "adset" && entity !== "ad") return null;

  const stacked = layout === "stacked";
  const campaignLabel = t("digitalMarketing.metaAds.filterCampaign", "Campaign");
  const adsetLabel = t("digitalMarketing.metaAds.filterAdset", "Ad set");

  return (
    <>
      {entity === "adset" ? (
        <ParentSelect
          label={campaignLabel}
          value={campaignId ?? ALL_VALUE}
          allLabel={t("digitalMarketing.metaAds.filterAllCampaigns", "All campaigns")}
          options={campaignOptions}
          stacked={stacked}
          controlSize={controlSize}
          onChange={onCampaignChange}
        />
      ) : null}
      {entity === "ad" ? (
        <ParentSelect
          label={adsetLabel}
          value={campaignId ? (adsetId ?? ALL_VALUE) : "needs-campaign"}
          placeholder={t(
            "digitalMarketing.metaAds.filterAdsetNeedsCampaign",
            "Choose a campaign first",
          )}
          allLabel={t("digitalMarketing.metaAds.filterAllActiveAdsets", "All ad sets")}
          options={adsetOptions}
          stacked={stacked}
          controlSize={controlSize}
          disabled={!campaignId || adsetOptionsLoading}
          onChange={onAdsetChange}
        />
      ) : null}
    </>
  );
}

function ParentSelect({
  label,
  value,
  placeholder,
  allLabel,
  options,
  stacked,
  controlSize,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  allLabel: string;
  options: MetaAdsParentOption[];
  stacked: boolean;
  controlSize: "sm" | "md";
  disabled?: boolean;
  onChange: (id: string | null) => void;
}) {
  return (
    <div
      className={cn(
        "shrink-0",
        stacked
          ? "flex min-w-[11rem] max-w-[16rem] flex-col gap-0.5"
          : "flex items-center gap-2",
      )}
    >
      <span
        className={cn(
          "shrink-0 text-muted-foreground",
          stacked
            ? "text-[10px] font-medium uppercase tracking-wide"
            : "text-xs",
        )}
      >
        {label}
      </span>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          if (next === "needs-campaign") return;
          onChange(next === ALL_VALUE ? null : next);
        }}
      >
        <SelectTrigger
          className={cn(
            "border-gray-200 bg-white text-xs font-medium shadow-none",
            stacked
              ? "h-8 w-full"
              : controlSize === "md"
                ? "h-9 w-auto min-w-[10rem] max-w-[18rem] text-sm [&>span]:truncate"
                : "h-7 w-auto min-w-[10rem] max-w-[16rem] [&>span]:truncate",
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {value === "needs-campaign" ? (
            <SelectItem value="needs-campaign" className="text-xs">
              {placeholder}
            </SelectItem>
          ) : (
            <SelectItem value={ALL_VALUE} className="text-xs">
              {allLabel}
            </SelectItem>
          )}
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id} className="text-xs">
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
