import QRCode from "react-qr-code";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatOrderRp } from "../../lib/formatOrderRp";
import { ORDER_STOREFRONT_PX } from "../../lib/orderStorefrontGutter";
import { buildCashierQrPayload } from "../lib/buildCashierQrPayload";
import { CASHIER_TICKET_I18N } from "../lib/cashierTicketCopy";
import type { CashierTicketUiPhase } from "../lib/cashierTicketLifecycle";

const ACCENT = "#E91E8C";

export function OrderCashierQrActiveView({
  storeName,
  tableNumber,
  grandTotal,
  claimToken,
  expiresAt,
  phase,
  fulfillment,
}: {
  storeName: string;
  tableNumber: string;
  grandTotal: number;
  claimToken: string;
  expiresAt: string;
  phase: Extract<CashierTicketUiPhase, "waiting" | "claimed" | "expired">;
  fulfillment?: "dine_in" | "takeaway";
}) {
  const { t } = useAppTranslation();

  const statusLabel = (() => {
    if (phase === "expired") {
      return t(CASHIER_TICKET_I18N.statusExpired, "Expired");
    }
    if (phase === "claimed") {
      return t(CASHIER_TICKET_I18N.statusClaimed, "Being served at cashier");
    }
    return t(CASHIER_TICKET_I18N.statusWaiting, "Waiting at cashier");
  })();

  const fulfillmentLabel =
    fulfillment === "takeaway"
      ? t(CASHIER_TICKET_I18N.takeAway, "Take Away")
      : t(CASHIER_TICKET_I18N.dineIn, "Dine In");

  const hint =
    phase === "claimed"
      ? t(
          CASHIER_TICKET_I18N.claimedCanAddItems,
          "Cashier is processing your order — you can still add items from the menu.",
        )
      : phase === "expired"
        ? t(CASHIER_TICKET_I18N.expiredHint, "This ticket has expired. Start a new order from the menu.")
        : t(
            CASHIER_TICKET_I18N.showCashier,
            "Show this QR code to the cashier to verify your order before payment.",
          );

  return (
    <div className={`flex min-h-0 flex-1 flex-col items-center justify-center ${ORDER_STOREFRONT_PX} py-6 text-center`}>
      {storeName ? (
        <p className="text-[15px] font-semibold text-neutral-900">{storeName}</p>
      ) : null}
      <p className="mt-1 text-[13px] font-medium text-neutral-700">{fulfillmentLabel}</p>
      <p className="mt-1 text-[13px] text-neutral-500">
        {t(CASHIER_TICKET_I18N.fromTable, "From table")}: {tableNumber}
      </p>
      <p className="mt-4 text-[14px] font-medium text-neutral-700">
        {t(CASHIER_TICKET_I18N.total, "Total")}{" "}
        <span className="text-[18px] font-bold text-neutral-900">{formatOrderRp(grandTotal)}</span>
      </p>
      {phase !== "expired" ? (
        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <QRCode value={buildCashierQrPayload(claimToken)} size={220} />
        </div>
      ) : null}
      <p className="mt-5 max-w-[280px] text-[14px] leading-relaxed text-neutral-600">{hint}</p>
      <p
        className="mt-3 rounded-full px-3 py-1 text-[12px] font-medium"
        style={{ color: ACCENT, backgroundColor: `${ACCENT}14` }}
      >
        {statusLabel}
      </p>
      {expiresAt && phase !== "expired" ? (
        <p className="mt-2 text-[11px] text-neutral-400">
          {t(CASHIER_TICKET_I18N.ticketExpires, "Valid until {{time}}", {
            time: new Date(expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          })}
        </p>
      ) : null}
    </div>
  );
}
