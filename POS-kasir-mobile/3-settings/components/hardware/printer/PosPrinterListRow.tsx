import { ChevronRight } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  formatPosPrinterRoleStatus,
  posPrinterDisplayName,
} from "../../../lib/printer/posPrinterRoleLabels";
import type { PosSavedPrinter } from "../../../lib/printer/posPrinterTypes";

type Props = {
  printer: PosSavedPrinter;
  onClick: () => void;
};

export function PosPrinterListRow({ printer, onClick }: Props) {
  const { t } = useAppTranslation();
  const status = formatPosPrinterRoleStatus(printer.roles, t);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-slate-100 px-1 py-3.5 text-left transition-colors hover:bg-slate-50 last:border-b-0"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">
          {posPrinterDisplayName(printer)}
        </p>
        <p className="truncate text-xs text-slate-400">{printer.systemName}</p>
      </div>
      <span className="max-w-[40%] truncate text-right text-xs text-slate-500">{status}</span>
      <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-300" aria-hidden />
    </button>
  );
}
