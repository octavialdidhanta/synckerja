import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Folder, Loader2 } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { cn } from "@/shared/lib/utils";
import {
  useMetaAdsInterestListDetail,
  useMetaAdsInterestLists,
  type MetaInterestListItem,
  type MetaTargetingItem,
} from "@/meta-ads/hooks/useMetaAdsTargeting";

function typeLabel(
  type: MetaTargetingItem["type"],
  t: (key: string, fallback: string) => string,
): string {
  if (type === "interest") return t("digitalMarketing.metaAds.interestFilterInterests", "Interests");
  if (type === "behavior") return t("digitalMarketing.metaAds.interestFilterBehaviors", "Behaviours");
  if (
    type === "demographic" ||
    type === "life_event" ||
    type === "industry" ||
    type === "income" ||
    type === "family_status"
  ) {
    return t("digitalMarketing.metaAds.interestFilterDemographics", "Demographics");
  }
  return t("digitalMarketing.metaAds.interestFilterOther", "Other");
}

function listItemToTargeting(item: MetaInterestListItem): MetaTargetingItem {
  return {
    id: item.meta_targeting_id,
    name: item.name,
    type: (item.type as MetaTargetingItem["type"]) || "interest",
    path: Array.isArray(item.path) ? (item.path as string[]) : [],
    audience_size_lower: item.audience_size_lower,
    audience_size_upper: item.audience_size_upper,
    description: null,
  };
}

function SavedListBranch({
  organizationId,
  adAccountId,
  listId,
  listName,
  itemCount,
  open,
  onToggle,
  folderFilter,
  blockedIds,
  onPick,
  onPickMany,
  onClose,
}: {
  organizationId: string;
  adAccountId?: string;
  listId: string;
  listName: string;
  itemCount: number;
  open: boolean;
  onToggle: () => void;
  folderFilter: string;
  blockedIds: Set<string>;
  onPick: (item: MetaTargetingItem) => void;
  onPickMany?: (items: MetaTargetingItem[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const detailQuery = useMetaAdsInterestListDetail(organizationId, listId, adAccountId, open);
  const needle = folderFilter.trim().toLowerCase();
  const items = useMemo(() => {
    return (detailQuery.data?.items ?? [])
      .map(listItemToTargeting)
      .filter((item) => !blockedIds.has(item.id))
      .filter((item) => !needle || item.name.toLowerCase().includes(needle));
  }, [blockedIds, detailQuery.data?.items, needle]);

  return (
    <li>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1 px-1 py-1 text-left text-[12px] font-medium text-slate-800 hover:bg-muted"
          onClick={onToggle}
        >
          <ChevronRight className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-90")} />
          <span className="truncate">{listName}</span>
          <span className="shrink-0 text-[10px] font-normal text-slate-400">{itemCount}</span>
        </button>
        {open && items.length > 0 ? (
          <button
            type="button"
            className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-sky-700 hover:bg-sky-50"
            onClick={() => {
              if (onPickMany) onPickMany(items);
              else items.forEach((item) => onPick(item));
              onClose();
            }}
          >
            {t("digitalMarketing.metaAds.interestLoadList", "Load")}
          </button>
        ) : null}
      </div>
      {open ? (
        detailQuery.isFetching ? (
          <div className="flex justify-center py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="mb-1 ml-4 px-1 py-1 text-[11px] text-muted-foreground">
            {t("digitalMarketing.metaAds.interestOverlapSavedListEmpty", "No unused items in this list")}
          </p>
        ) : (
          <ul className="mb-1 ml-4">
            {items.slice(0, 60).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left hover:bg-muted"
                  onClick={() => {
                    onPick(item);
                    onClose();
                  }}
                >
                  <span className="truncate text-[12px] text-slate-700">{item.name}</span>
                  <span className="shrink-0 text-[10px] text-slate-400">{typeLabel(item.type, t)}</span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </li>
  );
}

export function InterestResearchOverlapSearchField({
  organizationId,
  adAccountId,
  query,
  onQueryChange,
  hits,
  searching,
  onPick,
  onPickMany,
  blockedIds,
}: {
  organizationId: string;
  adAccountId?: string;
  query: string;
  onQueryChange: (value: string) => void;
  hits: MetaTargetingItem[];
  searching: boolean;
  onPick: (item: MetaTargetingItem) => void;
  onPickMany?: (items: MetaTargetingItem[]) => void;
  blockedIds: Set<string>;
}) {
  const { t } = useTranslation();
  const [folderOpen, setFolderOpen] = useState(false);
  const [expandedListId, setExpandedListId] = useState<string | null>(null);
  const [folderFilter, setFolderFilter] = useState("");
  const listsQuery = useMetaAdsInterestLists(organizationId, adAccountId, folderOpen);

  const lists = useMemo(() => {
    const needle = folderFilter.trim().toLowerCase();
    return (listsQuery.data?.lists ?? []).filter((list) =>
      !needle || list.name.toLowerCase().includes(needle),
    );
  }, [folderFilter, listsQuery.data?.lists]);

  const showHits = query.trim().length >= 2 && (hits.length > 0 || searching);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <Popover open={showHits} modal={false}>
        <PopoverTrigger asChild>
          <div className="relative min-w-0 flex-1">
            <Input
              className="h-8 border-slate-200 bg-white pr-8 text-xs shadow-none"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={t(
                "digitalMarketing.metaAds.interestOverlapComparePlaceholder",
                "Interest, behavior, and more...",
              )}
            />
            {searching ? (
              <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : null}
          </div>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="top"
          className="w-[var(--radix-popover-trigger-width)] p-0"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          {hits.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {t(
                "digitalMarketing.metaAds.interestOverlapCompareEmpty",
                "No related interests, demographics, or behaviours",
              )}
            </p>
          ) : (
            <ul className="max-h-56 overflow-y-auto py-1">
              {hits.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left hover:bg-muted"
                    onClick={() => onPick(item)}
                  >
                    <span className="truncate text-[13px] text-slate-900">{item.name}</span>
                    <span className="shrink-0 text-[12px] text-slate-400">{typeLabel(item.type, t)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>

      <Popover
        open={folderOpen}
        onOpenChange={(open) => {
          setFolderOpen(open);
          if (!open) {
            setExpandedListId(null);
            setFolderFilter("");
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            title={t("digitalMarketing.metaAds.interestOverlapBrowseSaved", "Load saved interests")}
          >
            <Folder className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" side="top" className="w-[280px] p-2" onOpenAutoFocus={(event) => event.preventDefault()}>
          <Input
            className="mb-2 h-7 text-xs"
            value={folderFilter}
            onChange={(e) => setFolderFilter(e.target.value)}
            placeholder={t("digitalMarketing.metaAds.interestOverlapBrowseSavedFilter", "Filter saved lists")}
          />
          {listsQuery.isFetching ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : lists.length === 0 ? (
            <p className="px-1 py-3 text-xs text-muted-foreground">
              {t("digitalMarketing.metaAds.interestNoLists", "No saved lists yet.")}
            </p>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {lists.map((list) => {
                const countRaw = list.meta_ads_interest_list_items;
                const count = Array.isArray(countRaw)
                  ? Number(countRaw[0]?.count ?? 0)
                  : Number((countRaw as { count?: number } | undefined)?.count ?? 0);
                return (
                  <SavedListBranch
                    key={list.id}
                    organizationId={organizationId}
                    adAccountId={adAccountId}
                    listId={list.id}
                    listName={list.name}
                    itemCount={count}
                    open={expandedListId === list.id}
                    onToggle={() => setExpandedListId((prev) => (prev === list.id ? null : list.id))}
                    folderFilter={folderFilter}
                    blockedIds={blockedIds}
                    onPick={onPick}
                    onPickMany={onPickMany}
                    onClose={() => setFolderOpen(false)}
                  />
                );
              })}
            </ul>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
