import { ChevronLeft } from "lucide-react";
import { useMemo } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatOrderRp } from "../../lib/formatOrderRp";
import { ORDER_STOREFRONT_PX } from "../../lib/orderStorefrontGutter";
import { CASHIER_TICKET_I18N } from "../lib/cashierTicketCopy";
import { listCashierTickets, type StoredCashierTicket } from "../lib/orderDeviceStore";

function statusLabel(
  ticket: StoredCashierTicket,
  t: (key: string, fallback: string) => string,
) {
  if (ticket.status === "paid") return t(CASHIER_TICKET_I18N.statusPaid, "Paid");
  if (ticket.status === "expired") return t(CASHIER_TICKET_I18N.statusExpired, "Expired");
  if (ticket.status === "claimed") return t(CASHIER_TICKET_I18N.statusClaimed, "At cashier");
  return t(CASHIER_TICKET_I18N.statusWaiting, "Waiting");
}

export function OrderHistoryScreen({
  storeCode,
  onBack,
  onOpenTicket,
}: {
  storeCode: string;
  onBack: () => void;
  onOpenTicket: (ticket: StoredCashierTicket) => void;
}) {
  const { t } = useAppTranslation();
  const tickets = useMemo(() => listCashierTickets(storeCode), [storeCode]);

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-neutral-100">
      <div className={`flex shrink-0 items-center gap-2 bg-white ${ORDER_STOREFRONT_PX} py-3`}>
        <button type="button" onClick={onBack} className="flex h-8 w-8 items-center justify-center">
          <ChevronLeft className="h-6 w-6" strokeWidth={2} />
        </button>
        <h1 className="min-w-0 flex-1 text-center text-[17px] font-semibold">
          {t(CASHIER_TICKET_I18N.orderHistory, "Order History")}
        </h1>
        <span className="h-8 w-8" aria-hidden />
      </div>
      <div className={`min-h-0 flex-1 overflow-y-auto ${ORDER_STOREFRONT_PX} py-4`}>
        {tickets.length === 0 ? (
          <div className="rounded-xl bg-white p-6 text-center shadow-sm">
            <p className="text-[14px] font-medium text-neutral-800">
              {t(CASHIER_TICKET_I18N.historyEmpty, "No orders on this device")}
            </p>
            <p className="mt-2 text-[12px] text-neutral-500">
              {t(
                CASHIER_TICKET_I18N.historyHint,
                "Order history is saved only on this phone for your privacy.",
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <button
                key={ticket.claimToken}
                type="button"
                onClick={() => onOpenTicket(ticket)}
                className="flex w-full flex-col rounded-xl bg-white px-4 py-3 text-left shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold text-neutral-900">{ticket.storeName}</span>
                  <span className="text-[13px] font-medium text-neutral-800">
                    {formatOrderRp(ticket.grandTotal)}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-neutral-500">
                  {ticket.fulfillment === "takeaway"
                    ? t(CASHIER_TICKET_I18N.takeAway, "Take Away")
                    : t(CASHIER_TICKET_I18N.dineIn, "Dine In")}
                  {" · "}
                  {t(CASHIER_TICKET_I18N.table, "Table")}: {ticket.tableNumber} ·{" "}
                  {statusLabel(ticket, t)}
                </p>
                <p className="mt-0.5 text-[11px] text-neutral-400">
                  {new Date(ticket.createdAt).toLocaleString()}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
