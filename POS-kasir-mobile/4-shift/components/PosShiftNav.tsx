import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_SHIFT_I18N } from "../lib/posShiftCopy";
import {
  POS_SHIFT_NAV,
  type PosShiftSectionId,
} from "../lib/posShiftSections";

type Props = {
  activeId: PosShiftSectionId;
  onSelect: (
    id: Exclude<
      PosShiftSectionId,
      | "cash-io"
      | "products-sold"
      | "history-detail"
      | "history-cash-io"
      | "history-products-sold"
    >,
  ) => void;
  autoStartEnabled: boolean;
};

export function PosShiftNav({ activeId, onSelect, autoStartEnabled }: Props) {
  const { t } = useAppTranslation();
  const navActive =
    activeId === "cash-io" || activeId === "products-sold"
      ? "current"
      : activeId === "history-detail" ||
          activeId === "history-cash-io" ||
          activeId === "history-products-sold"
        ? "history"
        : activeId;

  return (
    <nav className="flex flex-col" aria-label="Shift">
      <p className="bg-slate-100 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-600">
        {t(POS_SHIFT_I18N.sectionSettings, "Shift Settings")}
      </p>
      {POS_SHIFT_NAV.map((item) => {
        const active = item.id === navActive;
        const statusLabel = item.showAutoStatus
          ? autoStartEnabled
            ? t(POS_SHIFT_I18N.statusActive, "Active")
            : t(POS_SHIFT_I18N.statusInactive, "Inactive")
          : undefined;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={cn(
              "flex w-full items-center justify-between gap-2 border-b border-slate-100 px-4 py-3.5 text-left text-sm",
              active
                ? "bg-primary text-white"
                : "bg-white text-slate-900 hover:bg-slate-50",
            )}
          >
            <span className="font-medium">{t(item.labelKey, item.labelFallback)}</span>
            {statusLabel ? (
              <span
                className={cn(
                  "flex-shrink-0 text-xs",
                  active ? "text-white/90" : "text-slate-400",
                )}
              >
                {statusLabel}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
