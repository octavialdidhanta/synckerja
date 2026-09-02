import { useMemo } from "react";
import type { OrderCheckoutPreview } from "../../checkout/lib/orderCheckoutPreview";
import { parseCashierTicketPreview } from "../lib/cashierTicketPreview";
import { parseCashierTicketCart, type CashierTicketLine } from "../lib/parseCashierTicketCart";
import { resolveCashierTicketUiPhase } from "../lib/cashierTicketLifecycle";
import type { StoredCashierTicket } from "../lib/orderDeviceStore";
import { useCashierTicketStatus } from "./useCashierTicketStatus";

export function useCashierTicketDetail(args: {
  code: string;
  ticket: StoredCashierTicket;
  enabled?: boolean;
}) {
  const statusQuery = useCashierTicketStatus({
    code: args.code,
    claimToken: args.ticket.claimToken,
    enabled: args.enabled ?? true,
  });
  const remote = statusQuery.data;

  const lines = useMemo(
    (): CashierTicketLine[] => (remote?.ok ? parseCashierTicketCart(remote.cart) : []),
    [remote],
  );

  const preview = useMemo((): OrderCheckoutPreview => {
    const fallbackSubtotal = lines.reduce(
      (sum, line) => sum + line.unitPrice * line.quantity,
      0,
    );
    return parseCashierTicketPreview({
      checkoutTotals: remote?.checkout_totals,
      fallbackSubtotal,
      fallbackGrandTotal: remote?.grand_total ?? args.ticket.grandTotal,
    });
  }, [remote, lines, args.ticket.grandTotal]);

  const phase = resolveCashierTicketUiPhase(remote, args.ticket.status);
  const billNote = remote?.bill_note?.trim() || null;

  return {
    remote,
    lines,
    preview,
    phase,
    billNote,
    isLoading: statusQuery.isLoading && !remote?.ok,
    isError: statusQuery.isError || remote?.ok === false,
    refetch: statusQuery.refetch,
    displayTable: remote?.table_number ?? args.ticket.tableNumber,
    displayTotal: remote?.grand_total ?? args.ticket.grandTotal,
    displayExpires: remote?.expires_at ?? args.ticket.expiresAt,
  };
}
