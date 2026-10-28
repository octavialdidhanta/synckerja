import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  formatAudienceSize,
  targetingItemsToCsv,
  useMetaAdsInterestListDetail,
  useMetaAdsInterestListMutations,
  useMetaAdsInterestLists,
  type MetaTargetingItem,
} from "@/meta-ads/hooks/useMetaAdsTargeting";

type InterestResearchSavedPanelProps = {
  organizationId: string;
  onLoadItems?: (items: MetaTargetingItem[]) => void;
  topContent?: ReactNode;
};

export function InterestResearchSavedPanel({
  organizationId,
  onLoadItems,
  topContent,
}: InterestResearchSavedPanelProps) {
  const { t } = useTranslation();
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const listsQuery = useMetaAdsInterestLists(organizationId, Boolean(organizationId));
  const detailQuery = useMetaAdsInterestListDetail(
    organizationId,
    selectedListId,
    Boolean(selectedListId),
  );
  const mutations = useMetaAdsInterestListMutations(organizationId);

  const lists = listsQuery.data?.lists ?? [];
  const items = detailQuery.data?.items ?? [];

  const exportSelected = () => {
    if (!items.length) return;
    const mapped: MetaTargetingItem[] = items.map((i) => ({
      id: i.meta_targeting_id,
      name: i.name,
      type: (i.type as MetaTargetingItem["type"]) || "interest",
      path: Array.isArray(i.path) ? (i.path as string[]) : [],
      audience_size_lower: i.audience_size_lower,
      audience_size_upper: i.audience_size_upper,
      description: null,
    }));
    const blob = new Blob([targetingItemsToCsv(mapped)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meta-interest-list-${selectedListId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-gray-200 px-4 py-3">
        <h3 className="text-base font-semibold leading-6 text-gray-900">
          {t("digitalMarketing.metaAds.interestSavedTitle", "Saved lists")}
        </h3>
      </div>

      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {topContent ? <div className="border-b border-gray-100 p-3">{topContent}</div> : null}
        <div className="p-3">
        {listsQuery.isPending ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : lists.length === 0 ? (
          <p className="px-1 py-4 text-xs text-muted-foreground">
            {t("digitalMarketing.metaAds.interestNoLists", "No saved lists yet.")}
          </p>
        ) : (
          <ul className="space-y-1">
            {lists.map((list) => {
              const countRaw = list.meta_ads_interest_list_items;
              const count = Array.isArray(countRaw)
                ? Number(countRaw[0]?.count ?? 0)
                : Number((countRaw as { count?: number } | undefined)?.count ?? 0);
              const active = selectedListId === list.id;
              return (
                <li key={list.id}>
                  <button
                    type="button"
                    className={
                      active
                        ? "w-full rounded-md bg-sky-50 px-2 py-1.5 text-left text-sm font-medium text-sky-900"
                        : "w-full rounded-md px-2 py-1.5 text-left text-sm text-gray-800 hover:bg-gray-50"
                    }
                    onClick={() => {
                      setSelectedListId(list.id);
                      setRenameValue(list.name);
                    }}
                  >
                    <span className="block truncate">{list.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {t("digitalMarketing.metaAds.interestListCount", "{{count}} items", {
                        count,
                      })}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {selectedListId ? (
          <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
            <div className="flex gap-1">
              <Input
                className="h-8 text-xs"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                disabled={!renameValue.trim() || mutations.renameList.isPending}
                onClick={async () => {
                  try {
                    await mutations.renameList.mutateAsync({
                      listId: selectedListId,
                      name: renameValue.trim(),
                    });
                    toast.success(t("digitalMarketing.metaAds.interestListRenamed", "List renamed"));
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Rename failed");
                  }
                }}
              >
                {t("digitalMarketing.metaAds.interestRename", "Rename")}
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button type="button" size="sm" variant="secondary" className="h-8" onClick={exportSelected}>
                CSV
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8"
                disabled={!items.length}
                onClick={() => {
                  const mapped: MetaTargetingItem[] = items.map((i) => ({
                    id: i.meta_targeting_id,
                    name: i.name,
                    type: (i.type as MetaTargetingItem["type"]) || "interest",
                    path: Array.isArray(i.path) ? (i.path as string[]) : [],
                    audience_size_lower: i.audience_size_lower,
                    audience_size_upper: i.audience_size_upper,
                    description: null,
                  }));
                  onLoadItems?.(mapped);
                }}
              >
                {t("digitalMarketing.metaAds.interestLoadList", "Load")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="h-8"
                disabled={mutations.deleteList.isPending}
                onClick={async () => {
                  try {
                    await mutations.deleteList.mutateAsync(selectedListId);
                    setSelectedListId(null);
                    toast.success(t("digitalMarketing.metaAds.interestListDeleted", "List deleted"));
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Delete failed");
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {detailQuery.isPending ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <ul className="max-h-[240px] space-y-1 overflow-y-auto text-xs">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-2 rounded border border-gray-100 px-2 py-1.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">{item.name}</p>
                      <p className="text-muted-foreground">
                        {item.type} ·{" "}
                        {formatAudienceSize(item.audience_size_lower, item.audience_size_upper)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Remove"
                      onClick={async () => {
                        try {
                          await mutations.removeItem.mutateAsync({
                            listId: selectedListId,
                            itemId: item.id,
                          });
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Remove failed");
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
        </div>
      </div>
    </section>
  );
}
