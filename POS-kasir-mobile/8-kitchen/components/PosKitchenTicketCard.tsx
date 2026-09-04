import {
  Check,
  History,
  Info,
  Pause,
  PhoneIncoming,
  RotateCcw,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { resolveKitchenSalesTypeBucket } from "../lib/kitchenSalesTypeBucket";
import { POS_KITCHEN_I18N } from "../lib/posKitchenCopy";
import {
  formatKitchenSalesTypeTitle,
  resolveKitchenSalesTypeTheme,
} from "../lib/kitchenSalesTypeTheme";
import {
  formatKitchenTicketCode,
  kitchenTicketElapsedMs,
  kitchenTicketReadiness,
} from "../lib/kitchenTicketMeta";
import {
  formatKitchenWaitDuration,
  kitchenSlaBucket,
  kitchenSlaRingColor,
  kitchenSlaRingProgress,
} from "../lib/kitchenTicketSla";
import type { PosKitchenTicket } from "../lib/posKitchenTypes";
import { isKitchenTicketInRecallWindow } from "../lib/canRestoreKitchenTicket";
import type { KitchenThemeColors } from "../settings/lib/defaultKitchenTheme";
import { PosKitchenProgressRing } from "./PosKitchenProgressRing";

type Props = {
  ticket: PosKitchenTicket;
  nowMs: number;
  busy?: boolean;
  /** Hide Start/Hold/checklist mutations (completed / recall view). */
  readOnly?: boolean;
  /** Show Recall / Revert restore actions. */
  showRecall?: boolean;
  themeColors?: KitchenThemeColors;
  fontScale?: number;
  onAdvance: () => void;
  onToggleHold: () => void;
  onToggleLine: (lineId: string, nextDone: boolean) => void;
  onRecall?: () => void;
  onRevert?: () => void;
};

function actionLabel(
  status: PosKitchenTicket["status"],
  t: (key: string, fallback: string) => string,
): string {
  if (status === "new") return t(POS_KITCHEN_I18N.start, "Start");
  if (status === "in_progress") return t(POS_KITCHEN_I18N.inProgress, "In-Progress");
  return t(POS_KITCHEN_I18N.done, "Done");
}

function actionClass(status: PosKitchenTicket["status"]): string {
  if (status === "new") return "bg-[#B8C1D1] hover:bg-[#a8b2c4] text-white";
  if (status === "in_progress") return "bg-amber-400 hover:bg-amber-500 text-white";
  return "bg-emerald-500 hover:bg-emerald-600 text-white";
}

function RestoreMarkerBadge({
  marker,
}: {
  marker: NonNullable<PosKitchenTicket["restore_marker"]>;
}) {
  const { t } = useAppTranslation();
  const isRecalled = marker === "recalled";

  return (
    <div className="flex justify-end px-3 pb-1 pt-0.5">
      <span
        className={[
          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
          isRecalled
            ? "bg-amber-300 text-slate-900"
            : "bg-rose-500 text-white",
        ].join(" ")}
      >
        <History className="h-3 w-3" aria-hidden />
        {isRecalled
          ? t(POS_KITCHEN_I18N.recalledBadge, "Recalled")
          : t(POS_KITCHEN_I18N.revertedBadge, "Reverted")}
        <Info className="h-3 w-3 opacity-80" aria-hidden />
      </span>
    </div>
  );
}

export function PosKitchenTicketCard({
  ticket,
  nowMs,
  busy,
  readOnly,
  showRecall,
  themeColors,
  fontScale = 1,
  onAdvance,
  onToggleHold,
  onToggleLine,
  onRecall,
  onRevert,
}: Props) {
  const { t } = useAppTranslation();

  const salesFallback = t(POS_KITCHEN_I18N.salesTypeFallback, "Dine in");
  const salesTitle = formatKitchenSalesTypeTitle(ticket.sales_type_label, salesFallback);
  const theme = resolveKitchenSalesTypeTheme(
    ticket.sales_type_label,
    themeColors?.order_types,
  );
  const code = formatKitchenTicketCode(ticket.id);
  const guest =
    ticket.customer_name?.trim() || t(POS_KITCHEN_I18N.guestUnknown, "—");

  const elapsedMs = kitchenTicketElapsedMs(ticket, nowMs);
  const slaBucket = kitchenSlaBucket(elapsedMs);
  const waitLabel = formatKitchenWaitDuration(elapsedMs, t);
  const slaProgress = kitchenSlaRingProgress(elapsedMs);
  const readiness = kitchenTicketReadiness(ticket.lines);
  const slaStroke = kitchenSlaRingColor(slaBucket, themeColors?.status);

  const HeaderIcon =
    resolveKitchenSalesTypeBucket(ticket.sales_type_label) === "dine_in"
      ? UtensilsCrossed
      : Store;
  const interactionsDisabled = Boolean(busy || readOnly);
  /** Recall/Revert only after at least one line is unchecked. */
  const hasUncheckedLine = ticket.lines.some((line) => !line.is_done);
  const canRestore =
    Boolean(showRecall) && isKitchenTicketInRecallWindow(ticket, nowMs);
  const recallDisabled = Boolean(busy || !hasUncheckedLine || !canRestore);
  const checklistDisabled = Boolean(busy || (readOnly && !showRecall));

  return (
    <article
      className="flex w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md"
      style={{ fontSize: `${fontScale * 16}px` }}
    >
      <header
        className="flex items-stretch gap-0"
        style={{ backgroundColor: theme.headerBgHex }}
      >
        <div className="flex w-11 flex-shrink-0 items-center justify-center bg-white/90">
          <HeaderIcon className={`h-5 w-5 ${theme.headerIcon}`} aria-hidden />
        </div>
        <div className="min-w-0 flex-1 px-2.5 py-2">
          <p className="truncate text-[0.875em] font-bold uppercase tracking-wide text-slate-900">
            {salesTitle}
          </p>
          <p className="truncate text-[0.75em] font-medium text-slate-700">{code}</p>
        </div>
      </header>

      <p className="border-b border-slate-100 px-3 py-1.5 text-[0.7em] text-slate-600">
        {ticket.table_name}
        <span className="text-slate-400"> · </span>
        {guest}
      </p>

      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
        <PosKitchenProgressRing
          size={58}
          progress={slaProgress}
          stroke={slaStroke}
          strokeWidth={4}
        >
          <span className="px-1 text-[0.7em] font-semibold leading-tight text-slate-800 tabular-nums">
            {waitLabel}
          </span>
        </PosKitchenProgressRing>

        {canRestore ? (
          <button
            type="button"
            disabled={recallDisabled}
            onClick={(e) => {
              e.stopPropagation();
              onRecall?.();
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100 transition hover:bg-emerald-100 disabled:opacity-40 disabled:hover:bg-emerald-50"
          >
            <PhoneIncoming className="h-3.5 w-3.5" aria-hidden />
            {t(POS_KITCHEN_I18N.recallAction, "Recall")}
          </button>
        ) : !readOnly ? (
          <button
            type="button"
            disabled={interactionsDisabled}
            onClick={(e) => {
              e.stopPropagation();
              onToggleHold();
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-600 ring-1 ring-amber-100 transition hover:bg-amber-100 disabled:opacity-50"
          >
            <Pause className="h-3.5 w-3.5 fill-amber-500 text-amber-500" aria-hidden />
            {ticket.is_held
              ? t(POS_KITCHEN_I18N.resume, "Resume")
              : t(POS_KITCHEN_I18N.hold, "Hold")}
          </button>
        ) : null}
      </div>

      {ticket.restore_marker && !showRecall ? (
        <RestoreMarkerBadge marker={ticket.restore_marker} />
      ) : null}

      <ul className="max-h-[180px] space-y-2 overflow-y-auto px-3 py-3">
        {ticket.lines.map((line) => {
          const label = `${line.quantity}× ${line.display_name}`;
          return (
            <li key={line.id}>
              <button
                type="button"
                disabled={checklistDisabled}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLine(line.id, !line.is_done);
                }}
                className="flex w-full items-start gap-2 text-left disabled:opacity-50"
              >
                <span
                  className={[
                    "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[5px]",
                    line.is_done ? "bg-emerald-500 text-white" : "border-2 border-slate-300 bg-white",
                  ].join(" ")}
                  aria-hidden
                >
                  {line.is_done ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={[
                      "block text-sm font-medium text-slate-800",
                      line.is_done ? "text-slate-400 line-through" : "",
                    ].join(" ")}
                  >
                    {label}
                  </span>
                  {line.modifiers_text ? (
                    <span
                      className={[
                        "mt-0.5 block text-xs text-slate-500",
                        line.is_done ? "line-through opacity-70" : "",
                      ].join(" ")}
                    >
                      {line.modifiers_text}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <footer className="mt-auto flex items-center gap-2 border-t border-slate-100 px-3 py-2.5">
        <PosKitchenProgressRing
          size={44}
          progress={readiness.percent / 100}
          stroke="#F1C40F"
          strokeWidth={3.5}
        >
          <span className="text-[10px] font-semibold tabular-nums text-slate-800">
            {t(POS_KITCHEN_I18N.readyPercent, "{{p}}%", { p: readiness.percent })}
          </span>
        </PosKitchenProgressRing>

        {canRestore ? (
          <button
            type="button"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              onRevert?.();
            }}
            className="inline-flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-rose-500 px-3 text-sm font-bold text-white shadow-sm transition hover:bg-rose-600 disabled:opacity-40 disabled:hover:bg-rose-500"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            {t(POS_KITCHEN_I18N.revertAction, "Revert")}
          </button>
        ) : !readOnly ? (
          <button
            type="button"
            disabled={interactionsDisabled}
            onClick={(e) => {
              e.stopPropagation();
              onAdvance();
            }}
            className={`min-h-10 min-w-0 flex-1 rounded-lg px-3 text-sm font-bold shadow-sm transition disabled:opacity-50 ${actionClass(ticket.status)}`}
          >
            {actionLabel(ticket.status, t)}
          </button>
        ) : (
          <div className="min-h-10 min-w-0 flex-1" aria-hidden />
        )}
      </footer>
    </article>
  );
}
