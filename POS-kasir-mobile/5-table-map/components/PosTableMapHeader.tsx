import { ListOrdered } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import type { PosTableGroup } from "@/8-2-9-table-management/lib/posTableGroupTypes";
import { POS_TABLE_MAP_I18N } from "../lib/posTableMapCopy";
import { PosTableMapLegend } from "./PosTableMapLegend";

type Props = {
  showLegend?: boolean;
  occupiedCount?: number;
  onOpenBillList?: () => void;
  /** Tablet: floor-plan group switcher under the title row. Phone uses footer tabs. */
  groups?: PosTableGroup[];
  activeGroupId?: string | null;
  onSelectGroup?: (groupId: string) => void;
  /** Phone: hide title; Bill List sits on the same row as Vacant/Occupied. */
  phoneLayout?: boolean;
};

/** Slim Table Map header: title + Bill List + optional group chips + Vacant/Occupied legend. */
export function PosTableMapHeader({
  showLegend = true,
  occupiedCount = 0,
  onOpenBillList,
  groups,
  activeGroupId,
  onSelectGroup,
  phoneLayout = false,
}: Props) {
  const { t } = useAppTranslation();
  const showGroups = Boolean(
    !phoneLayout && groups && groups.length > 0 && onSelectGroup,
  );

  const billListButton = onOpenBillList ? (
    <button
      type="button"
      onClick={onOpenBillList}
      className={cn(
        "relative inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-primary shadow-sm transition-colors",
        "hover:border-primary/40 hover:bg-primary/5",
      )}
      aria-label={t(POS_TABLE_MAP_I18N.billListTitle, "Bill List")}
    >
      <ListOrdered className="h-4 w-4" />
      <span>{t(POS_TABLE_MAP_I18N.billListTitle, "Bill List")}</span>
      {occupiedCount > 0 ? (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
          {occupiedCount > 99 ? "99+" : occupiedCount}
        </span>
      ) : null}
    </button>
  ) : null;

  if (phoneLayout) {
    return (
      <header className="flex-shrink-0 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          {showLegend ? (
            <PosTableMapLegend className="min-w-0 flex-1 px-0 py-0" />
          ) : (
            <div className="min-w-0 flex-1" />
          )}
          {billListButton}
        </div>
      </header>
    );
  }

  return (
    <header className="flex-shrink-0 border-b border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <h1 className="text-base font-semibold text-slate-900">
          {t(POS_TABLE_MAP_I18N.title, "Table Map")}
        </h1>
        {billListButton}
      </div>
      {showGroups ? (
        <div className="scrollbar-hide flex gap-1.5 overflow-x-auto px-3 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {groups!.map((g) => {
            const active = g.id === activeGroupId;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => onSelectGroup!(g.id)}
                className={cn(
                  "h-8 shrink-0 rounded-full px-3 text-xs font-semibold transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
                )}
              >
                {g.name}
              </button>
            );
          })}
        </div>
      ) : null}
      {showLegend ? <PosTableMapLegend /> : null}
    </header>
  );
}
