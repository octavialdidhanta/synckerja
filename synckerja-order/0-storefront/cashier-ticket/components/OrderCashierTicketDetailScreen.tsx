import { ChevronLeft } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { Button } from "@/shared/components/ui/button";
import { formatOrderRp } from "../../lib/formatOrderRp";
import { ORDER_STOREFRONT_PX } from "../../lib/orderStorefrontGutter";
import { OrderPaymentDetailsCard } from "../../checkout/components/OrderPaymentDetailsCard";
import { ORDER_CHECKOUT_I18N } from "../../checkout/lib/orderCheckoutCopy";
import { CASHIER_TICKET_I18N } from "../lib/cashierTicketCopy";
import { shouldShowCashierQrButton } from "../lib/cashierTicketLifecycle";
import type { StoredCashierTicket } from "../lib/orderDeviceStore";
import { useCashierTicketDetail } from "../hooks/useCashierTicketDetail";
import { updateCashierTicketStatus, updateCashierTicketTotals } from "../lib/orderDeviceStore";
import { useEffect } from "react";
import { OrderCashierTicketLineRow } from "./OrderCashierTicketLineRow";

const ACCENT = "#E91E8C";

function statusLabelKey(phase: ReturnType<typeof useCashierTicketDetail>["phase"]) {
  if (phase === "paid") return CASHIER_TICKET_I18N.statusPaid;
  if (phase === "expired") return CASHIER_TICKET_I18N.statusExpired;
  if (phase === "claimed") return CASHIER_TICKET_I18N.statusClaimed;
  return CASHIER_TICKET_I18N.statusWaiting;
}

export function OrderCashierTicketDetailScreen({
  code,
  ticket,
  onBack,
  onShowQr,
}: {
  code: string;
  ticket: StoredCashierTicket;
  onBack: () => void;
  onShowQr: () => void;
}) {
  const { t } = useAppTranslation();
  const detail = useCashierTicketDetail({ code, ticket });
  const showQrButton = shouldShowCashierQrButton(detail.phase);
  const readOnly = !showQrButton;

  useEffect(() => {
    if (!detail.remote?.ok) return;
    let localStatus: StoredCashierTicket["status"] = "pending";
    if (detail.remote.paid || detail.remote.status === "paid") localStatus = "paid";
    else if (detail.remote.status === "expired") localStatus = "expired";
    else if (detail.remote.status === "cancelled") localStatus = "cancelled";
    else if (detail.remote.claimed) localStatus = "claimed";
    updateCashierTicketStatus(ticket.claimToken, localStatus);
    if (detail.remote.grand_total != null) {
      updateCashierTicketTotals(ticket.claimToken, detail.remote.grand_total);
    }
  }, [detail.remote, ticket.claimToken]);

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-neutral-100">
      <div className={`flex shrink-0 items-center gap-2 bg-white ${ORDER_STOREFRONT_PX} py-3`}>
        <button type="button" onClick={onBack} className="flex h-8 w-8 items-center justify-center">
          <ChevronLeft className="h-6 w-6" strokeWidth={2} />
        </button>
        <h1 className="min-w-0 flex-1 text-center text-[17px] font-semibold">
          {t(CASHIER_TICKET_I18N.detailTitle, "Order details")}
        </h1>
        <span className="h-8 w-8" aria-hidden />
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto ${ORDER_STOREFRONT_PX} py-4`}>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-[15px] font-semibold text-neutral-900">{ticket.storeName}</p>
          <p className="mt-2 text-[13px] text-neutral-600">
            {t(CASHIER_TICKET_I18N.table, "Table")}: {detail.displayTable}
          </p>
          <p className="mt-1 text-[13px] font-medium text-neutral-800">
            {t(statusLabelKey(detail.phase), "Waiting")}
          </p>
          <p className="mt-1 text-[11px] text-neutral-400">
            {new Date(ticket.createdAt).toLocaleString()}
          </p>
        </div>

        {detail.isLoading ? (
          <div className="mt-4 rounded-xl bg-white p-6 text-center text-sm text-neutral-400 shadow-sm">
            …
          </div>
        ) : null}

        {detail.isError && !detail.isLoading ? (
          <div className="mt-4 rounded-xl bg-white p-4 text-center shadow-sm">
            <p className="text-[13px] text-neutral-600">
              {t(CASHIER_TICKET_I18N.loadError, "Could not load order items")}
            </p>
            <button
              type="button"
              className="mt-3 text-[13px] font-semibold"
              style={{ color: ACCENT }}
              onClick={() => void detail.refetch()}
            >
              {t(CASHIER_TICKET_I18N.retry, "Retry")}
            </button>
          </div>
        ) : null}

        {!detail.isLoading && detail.lines.length > 0 ? (
          <section className="mt-4 rounded-xl bg-white px-4 py-2 shadow-sm">
            <h2 className="pt-2 text-[15px] font-bold uppercase tracking-wide text-neutral-900">
              {t(CASHIER_TICKET_I18N.orderedItems, "Ordered items")}
            </h2>
            {detail.lines.map((line) => (
              <OrderCashierTicketLineRow key={line.lineKey} line={line} />
            ))}
          </section>
        ) : null}

        {!detail.isLoading && detail.billNote ? (
          <section className="mt-4 rounded-xl bg-white p-4 shadow-sm">
            <p className="text-[13px] font-medium text-neutral-800">
              {t(ORDER_CHECKOUT_I18N.billNotes, "Add another notes")}
            </p>
            <p className="mt-2 text-[13px] text-neutral-600">{detail.billNote}</p>
          </section>
        ) : null}

        {!detail.isLoading ? (
          <section className="mt-4">
            <OrderPaymentDetailsCard preview={detail.preview} />
          </section>
        ) : null}

        {readOnly ? (
          <p className="mt-4 text-center text-[13px] text-neutral-500">
            {t(
              CASHIER_TICKET_I18N.readOnlyHint,
              "This order is closed. Start a new order from the menu.",
            )}
          </p>
        ) : null}
      </div>

      {showQrButton ? (
        <div className={`shrink-0 border-t bg-white ${ORDER_STOREFRONT_PX} py-3`}>
          <div className="mb-2 flex items-center justify-between text-[13px] text-neutral-700">
            <span>{t(CASHIER_TICKET_I18N.total, "Total")}</span>
            <span className="font-semibold text-neutral-900">
              {formatOrderRp(detail.displayTotal)}
            </span>
          </div>
          <Button
            type="button"
            className="w-full rounded-full bg-neutral-900 text-white hover:bg-neutral-800"
            onClick={onShowQr}
          >
            {t(CASHIER_TICKET_I18N.showQrCode, "Show QR Code")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
