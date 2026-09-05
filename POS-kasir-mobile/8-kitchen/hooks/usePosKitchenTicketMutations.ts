import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { assertKitchenTicketInRecallWindow } from "../lib/canRestoreKitchenTicket";
import { kitchenLinesAllDoneAfterToggle } from "../lib/kitchenTicketMeta";
import { nextKitchenTicketStatus } from "../lib/kitchenTicketStatus";
import type { PosKitchenTicketStatus } from "../lib/posKitchenTypes";
import { invalidatePosKitchenBoardQueries } from "./usePosKitchenTickets";

export function usePosKitchenTicketMutations(outletId: string | null) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const invalidate = () => {
    invalidatePosKitchenBoardQueries(queryClient, organizationId, outletId);
  };

  const advanceStatus = useMutation({
    mutationFn: async (args: {
      ticketId: string;
      currentStatus: PosKitchenTicketStatus;
    }): Promise<void> => {
      const next = nextKitchenTicketStatus(args.currentStatus);
      if (!next) return;

      const patch: {
        status: PosKitchenTicketStatus;
        completed_at?: string | null;
        is_held?: boolean;
        held_at?: string | null;
        restore_marker?: "recalled" | "reverted" | null;
      } = { status: next, is_held: false, held_at: null };
      if (next === "done") {
        patch.completed_at = new Date().toISOString();
        patch.restore_marker = null;
      }

      const { error } = await supabase
        .from("pos_kitchen_tickets")
        .update(patch)
        .eq("id", args.ticketId)
        .eq("status", args.currentStatus);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const toggleHold = useMutation({
    mutationFn: async (args: {
      ticketId: string;
      isHeld: boolean;
      heldAt: string | null;
      pauseMs: number;
    }): Promise<void> => {
      const now = Date.now();
      if (!args.isHeld) {
        const { error } = await supabase
          .from("pos_kitchen_tickets")
          .update({
            is_held: true,
            held_at: new Date(now).toISOString(),
          })
          .eq("id", args.ticketId);
        if (error) throw error;
        return;
      }

      let pauseMs = Math.max(0, args.pauseMs);
      if (args.heldAt) {
        const held = new Date(args.heldAt).getTime();
        if (Number.isFinite(held)) {
          pauseMs += Math.max(0, now - held);
        }
      }

      const { error } = await supabase
        .from("pos_kitchen_tickets")
        .update({
          is_held: false,
          held_at: null,
          pause_ms: pauseMs,
        })
        .eq("id", args.ticketId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const toggleLineDone = useMutation({
    mutationFn: async (args: {
      ticketId: string;
      lineId: string;
      isDone: boolean;
      currentStatus: PosKitchenTicketStatus;
      lines: readonly { id: string; is_done: boolean }[];
    }): Promise<void> => {
      const { error } = await supabase
        .from("pos_kitchen_ticket_lines")
        .update({ is_done: args.isDone })
        .eq("id", args.lineId);
      if (error) throw error;

      const allDone = kitchenLinesAllDoneAfterToggle(args.lines, args.lineId, args.isDone);

      // Last checkbox → Ready (Done button). Uncheck while Ready → back to In-Progress.
      if (args.isDone && allDone && args.currentStatus === "in_progress") {
        const { error: statusError } = await supabase
          .from("pos_kitchen_tickets")
          .update({
            status: "ready" satisfies PosKitchenTicketStatus,
            is_held: false,
            held_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", args.ticketId)
          .eq("status", "in_progress");
        if (statusError) throw statusError;
        return;
      }

      if (!args.isDone && args.currentStatus === "ready") {
        const { error: statusError } = await supabase
          .from("pos_kitchen_tickets")
          .update({
            status: "in_progress" satisfies PosKitchenTicketStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", args.ticketId)
          .eq("status", "ready");
        if (statusError) throw statusError;
        return;
      }

      // Bump parent ticket so realtime refreshes board (lines not in publication).
      await supabase
        .from("pos_kitchen_tickets")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", args.ticketId);
    },
    onSuccess: invalidate,
  });

  /** Restore a done ticket to in_progress; marker drives Recalled / Reverted badge. */
  const recallTicket = useMutation({
    mutationFn: async (args: {
      ticketId: string;
      marker: "recalled" | "reverted";
      completedAt?: string | null;
    }): Promise<void> => {
      assertKitchenTicketInRecallWindow({
        status: "done",
        completed_at: args.completedAt ?? null,
      });
      const { error } = await supabase
        .from("pos_kitchen_tickets")
        .update({
          status: "in_progress" satisfies PosKitchenTicketStatus,
          completed_at: null,
          is_held: false,
          held_at: null,
          restore_marker: args.marker,
        })
        .eq("id", args.ticketId)
        .eq("status", "done");
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { advanceStatus, toggleHold, toggleLineDone, recallTicket };
}
