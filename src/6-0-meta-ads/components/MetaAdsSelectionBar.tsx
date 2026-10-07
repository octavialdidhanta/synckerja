import { X } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import type { MetaAdsParentOption } from "@/meta-ads/metrics/metaAdsParentFilters";

type Props = {
  campaigns: MetaAdsParentOption[];
  adsets: MetaAdsParentOption[];
  ads: MetaAdsParentOption[];
  onRemoveCampaign: (id: string) => void;
  onRemoveAdset: (id: string) => void;
  onRemoveAd: (id: string) => void;
  onClearCampaigns: () => void;
  onClearAdsets: () => void;
  onClearAds: () => void;
};

type Group = {
  id: string;
  label: string;
  items: MetaAdsParentOption[];
  onRemove: (id: string) => void;
  onClear: () => void;
};

const INLINE_LIMIT = [3, 2, 1] as const;

export function MetaAdsSelectionBar({
  campaigns,
  adsets,
  ads,
  onRemoveCampaign,
  onRemoveAdset,
  onRemoveAd,
  onClearCampaigns,
  onClearAdsets,
  onClearAds,
}: Props) {
  const { t } = useAppTranslation();
  const groups: Group[] = [];
  if (campaigns.length > 0) {
    groups.push({
      id: "campaign",
      label: t("digitalMarketing.metaAds.campaigns", "Campaigns"),
      items: campaigns,
      onRemove: onRemoveCampaign,
      onClear: onClearCampaigns,
    });
  }
  if (adsets.length > 0) {
    groups.push({
      id: "adset",
      label: t("digitalMarketing.metaAds.adsets", "Ad sets"),
      items: adsets,
      onRemove: onRemoveAdset,
      onClear: onClearAdsets,
    });
  }
  if (ads.length > 0) {
    groups.push({
      id: "ad",
      label: t("digitalMarketing.metaAds.ads", "Ads"),
      items: ads,
      onRemove: onRemoveAd,
      onClear: onClearAds,
    });
  }
  if (groups.length === 0) return null;

  const inlineLimit = INLINE_LIMIT[groups.length - 1] ?? 1;
  const clearLabel = t("digitalMarketing.metaAds.selectionClear", "Clear");

  return (
    <div className="flex h-9 min-w-0 flex-1 items-center overflow-hidden rounded-md bg-[#e7f3ff]">
      {groups.map((group, index) => (
        <FilterGroup
          key={group.id}
          group={group}
          inlineLimit={inlineLimit}
          showDivider={index > 0}
          clearLabel={clearLabel}
          moreAria={(count) =>
            t("digitalMarketing.metaAds.selectionMoreAria", "{{count}} more", { count })
          }
          removeLabel={(name) =>
            t("digitalMarketing.metaAds.removeFilter", "Remove {{name}}", { name })
          }
        />
      ))}
    </div>
  );
}

function FilterGroup({
  group,
  inlineLimit,
  showDivider,
  clearLabel,
  moreAria,
  removeLabel,
}: {
  group: Group;
  inlineLimit: number;
  showDivider: boolean;
  clearLabel: string;
  moreAria: (count: number) => string;
  removeLabel: (name: string) => string;
}) {
  const visible = group.items.slice(0, inlineLimit);
  const hiddenCount = group.items.length - visible.length;
  const fullTitle = group.items.map((item) => item.name).join(", ");

  return (
    <div className="flex h-full min-w-0 flex-1 items-center overflow-hidden">
      {showDivider ? <span className="mx-0.5 h-4 w-px shrink-0 bg-[#b9d7f5]" aria-hidden /> : null}
      <span className="shrink-0 pl-2 pr-1.5 text-[11px] font-semibold text-[#0064e0]">{group.label}</span>
      <div className="flex min-w-0 items-center gap-1 overflow-hidden" title={fullTitle}>
        {visible.map((item) => (
          <span
            key={item.id}
            className="inline-flex h-6 min-w-0 flex-1 items-center gap-0.5 rounded bg-white/80 pl-1.5 pr-0.5 text-xs text-[#1c1e21]"
          >
            <span className="min-w-0 truncate">{item.name}</span>
            <button
              type="button"
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#0064e0] hover:bg-[#d7ebff]"
              aria-label={removeLabel(item.name)}
              title={removeLabel(item.name)}
              onClick={() => group.onRemove(item.id)}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {hiddenCount > 0 ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex h-6 shrink-0 items-center rounded bg-white/80 px-1.5 text-xs font-medium text-[#0064e0] hover:bg-white"
                aria-label={moreAria(hiddenCount)}
              >
                +{hiddenCount}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-1">
              <p className="px-2 py-1 text-xs font-semibold text-[#0064e0]">{group.label}</p>
              <ul className="max-h-56 overflow-y-auto">
                {group.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-1 rounded px-2 py-1 hover:bg-[#f0f6ff]">
                    <span className="min-w-0 flex-1 truncate text-sm text-[#1c1e21]" title={item.name}>
                      {item.name}
                    </span>
                    <button
                      type="button"
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#0064e0] hover:bg-[#d7ebff]"
                      aria-label={removeLabel(item.name)}
                      title={removeLabel(item.name)}
                      onClick={() => group.onRemove(item.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
      {hiddenCount > 0 ? (
        <button
          type="button"
          className="mx-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#0064e0] hover:bg-[#d7ebff]"
          aria-label={`${clearLabel} ${group.label}`}
          title={`${clearLabel} ${group.label}`}
          onClick={group.onClear}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : (
        <span className="w-1.5 shrink-0" aria-hidden />
      )}
    </div>
  );
}
