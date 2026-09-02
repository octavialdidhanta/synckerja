import type { CashierTicketStatus } from "./cashierTicketCopy";

export type CashierTicketUiPhase = "waiting" | "claimed" | "paid" | "expired";

export type CashierTicketRemoteStatus = {
  ok?: boolean;
  status?: string;
  claimed?: boolean;
  paid?: boolean;
};

export function resolveCashierTicketUiPhase(
  remote: CashierTicketRemoteStatus | null | undefined,
  localStatus?: CashierTicketStatus,
): CashierTicketUiPhase {
  if (remote?.paid || remote?.status === "paid" || localStatus === "paid") return "paid";
  if (remote?.status === "expired" || localStatus === "expired") return "expired";
  if (remote?.claimed || localStatus === "claimed") return "claimed";
  return "waiting";
}

export function isCashierTicketReadOnly(status: CashierTicketStatus): boolean {
  return status === "paid" || status === "expired" || status === "cancelled";
}

export function shouldOpenCashierTicketAsQr(status: CashierTicketStatus): boolean {
  return status === "pending" || status === "claimed";
}

export function shouldShowCashierQrButton(phase: CashierTicketUiPhase): boolean {
  return phase === "waiting" || phase === "claimed";
}
