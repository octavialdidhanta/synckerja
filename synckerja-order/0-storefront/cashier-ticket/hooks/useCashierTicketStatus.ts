import { useQuery } from "@tanstack/react-query";
import { fetchCashierTicketStatus } from "../../lib/orderCheckoutApi";
import type { CashierTicketStatus } from "../lib/cashierTicketCopy";

export function useCashierTicketStatus(args: {
  code: string;
  claimToken: string | null;
  enabled?: boolean;
  pollMs?: number;
}) {
  const enabled = Boolean(args.enabled && args.claimToken && args.code);
  return useQuery({
    queryKey: ["cashier-ticket-status", args.code, args.claimToken],
    enabled,
    refetchInterval: (query) => {
      const status = (query.state.data?.status ?? "pending") as CashierTicketStatus;
      if (status === "paid" || status === "expired" || status === "cancelled") return false;
      return args.pollMs ?? 4000;
    },
    queryFn: () =>
      fetchCashierTicketStatus({
        code: args.code,
        claimToken: args.claimToken as string,
      }),
  });
}
