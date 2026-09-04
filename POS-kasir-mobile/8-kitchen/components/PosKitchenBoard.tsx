import { useMemo } from "react";
import { useToast } from "@/shared/hooks/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_KITCHEN_I18N } from "../lib/posKitchenCopy";
import { KITCHEN_RESTORE_WINDOW_EXPIRED } from "../lib/canRestoreKitchenTicket";
import type { PosKitchenTicket } from "../lib/posKitchenTypes";
import { usePosKitchenTicketMutations } from "../hooks/usePosKitchenTicketMutations";
import { useKitchenWaitTicker } from "../hooks/useKitchenWaitTicker";
import type { KitchenDisplayMode } from "../settings/lib/posKitchenSettingsTypes";
import type { KitchenThemeColors } from "../settings/lib/defaultKitchenTheme";
import { PosKitchenTicketCard } from "./PosKitchenTicketCard";

type Props = {
  outletId: string;
  tickets: PosKitchenTicket[];
  readOnly?: boolean;
  showRecall?: boolean;
  displayMode?: KitchenDisplayMode;
  themeColors?: KitchenThemeColors;
  fontScale?: number;
  /** Override empty-lane copy (Recall / Completed history). */
  emptyMessage?: string;
};

function sortOldestCreatedFirst(list: PosKitchenTicket[]): PosKitchenTicket[] {
  return [...list].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

function sortNewestCompletedFirst(list: PosKitchenTicket[]): PosKitchenTicket[] {
  return [...list].sort((a, b) => {
    const aMs = a.completed_at ? Date.parse(a.completed_at) : 0;
    const bMs = b.completed_at ? Date.parse(b.completed_at) : 0;
    return bMs - aMs;
  });
}

/**
 * Ticket lane: classic = horizontal scroll; tiled = wrapping grid.
 */
export function PosKitchenBoard({
  outletId,
  tickets,
  readOnly,
  showRecall,
  displayMode = "classic",
  themeColors,
  fontScale = 1,
  emptyMessage,
}: Props) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { advanceStatus, toggleHold, toggleLineDone, recallTicket } =
    usePosKitchenTicketMutations(outletId);
  const nowMs = useKitchenWaitTicker();

  const ordered = useMemo(
    () =>
      showRecall
        ? sortNewestCompletedFirst(tickets)
        : sortOldestCreatedFirst(tickets),
    [tickets, showRecall],
  );

  const busyTicketId =
    (advanceStatus.isPending ? advanceStatus.variables?.ticketId : null) ??
    (toggleHold.isPending ? toggleHold.variables?.ticketId : null) ??
    (toggleLineDone.isPending ? toggleLineDone.variables?.ticketId : null) ??
    (recallTicket.isPending ? recallTicket.variables?.ticketId : null) ??
    null;

  const onError = (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    toast({
      title: t(POS_KITCHEN_I18N.advanceError, "Could not update ticket"),
      description:
        message === KITCHEN_RESTORE_WINDOW_EXPIRED
          ? t(
              POS_KITCHEN_I18N.restoreWindowExpired,
              "This ticket can only be restored within 15 minutes of completion.",
            )
          : message,
      variant: "destructive",
    });
  };

  const card = (ticket: PosKitchenTicket) => (
    <PosKitchenTicketCard
      ticket={ticket}
      nowMs={nowMs}
      busy={busyTicketId === ticket.id}
      readOnly={readOnly}
      showRecall={showRecall}
      themeColors={themeColors}
      fontScale={fontScale}
      onAdvance={() =>
        advanceStatus.mutate(
          { ticketId: ticket.id, currentStatus: ticket.status },
          { onError },
        )
      }
      onToggleHold={() =>
        toggleHold.mutate(
          {
            ticketId: ticket.id,
            isHeld: ticket.is_held,
            heldAt: ticket.held_at,
            pauseMs: ticket.pause_ms,
          },
          { onError },
        )
      }
      onToggleLine={(lineId, nextDone) =>
        toggleLineDone.mutate(
          { ticketId: ticket.id, lineId, isDone: nextDone },
          { onError },
        )
      }
      onRecall={() =>
        recallTicket.mutate(
          { ticketId: ticket.id, marker: "recalled", completedAt: ticket.completed_at },
          { onError },
        )
      }
      onRevert={() =>
        recallTicket.mutate(
          { ticketId: ticket.id, marker: "reverted", completedAt: ticket.completed_at },
          { onError },
        )
      }
    />
  );

  if (ordered.length === 0) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-3">
        <div className="flex min-h-[200px] w-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white px-4 text-center text-sm text-slate-500">
          {emptyMessage ?? t(POS_KITCHEN_I18N.empty, "No kitchen tickets yet.")}
        </div>
      </div>
    );
  }

  if (displayMode === "tiled") {
    return (
      <div className="scrollbar-hide min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          {ordered.map((ticket) => (
            <div key={ticket.id} className="min-w-0 self-start">
              {card(ticket)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="scrollbar-hide flex min-h-0 min-w-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden p-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {ordered.map((ticket) => (
        <div
          key={ticket.id}
          className="w-[min(300px,78vw)] flex-shrink-0 self-start"
        >
          {card(ticket)}
        </div>
      ))}
    </div>
  );
}
