import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function useGuestStoreRefresh(args: {
  code: string;
  tableNumber: string;
  isPaid: boolean;
}) {
  const queryClient = useQueryClient();
  const refreshedRef = useRef(false);

  useEffect(() => {
    if (!args.isPaid || !args.code || !args.tableNumber) {
      refreshedRef.current = false;
      return;
    }
    if (refreshedRef.current) return;
    refreshedRef.current = true;
    void queryClient.invalidateQueries({
      queryKey: ["public-order-store", args.code, args.tableNumber],
    });
  }, [args.isPaid, args.code, args.tableNumber, queryClient]);
}
