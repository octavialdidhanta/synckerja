import { Search } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_ACTIVITY_I18N } from "../lib/posActivityCopy";
import type { PosActivityDateGroup, PosActivityListRow } from "../lib/posActivityTypes";
import { PosActivityDateGroupHeader } from "./PosActivityDateGroupHeader";
import { PosActivityListRow as ActivityRow } from "./PosActivityListRow";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  groups: PosActivityDateGroup[];
  selectedId: string | null;
  onSelect: (row: PosActivityListRow) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  emptyLabel: string;
};

export function PosActivityListPane({
  search,
  onSearchChange,
  groups,
  selectedId,
  onSelect,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  emptyLabel,
}: Props) {
  const { t } = useAppTranslation();
  const flatCount = groups.reduce((n, g) => n + g.rows.length, 0);

  return (
    <aside className="flex w-[34%] min-w-[240px] max-w-md flex-col border-r border-slate-200">
      <div className="flex-shrink-0 border-b border-slate-100 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t(
              POS_ACTIVITY_I18N.searchPlaceholder,
              "Receipt or invoice number",
            )}
            className="h-10 border-slate-200 bg-slate-50 pl-9"
          />
        </div>
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {flatCount === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-slate-400">{emptyLabel}</p>
        ) : (
          groups.map((group) => (
            <div key={group.key}>
              <PosActivityDateGroupHeader group={group} />
              {group.rows.map((row) => (
                <ActivityRow
                  key={row.id}
                  row={row}
                  selected={row.id === selectedId}
                  onSelect={() => onSelect(row)}
                />
              ))}
            </div>
          ))
        )}

        {hasNextPage ? (
          <div className="p-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isFetchingNextPage}
              onClick={onLoadMore}
            >
              {isFetchingNextPage
                ? t(POS_ACTIVITY_I18N.loading, "Loading activity…")
                : t(POS_ACTIVITY_I18N.loadMore, "Load more")}
            </Button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
