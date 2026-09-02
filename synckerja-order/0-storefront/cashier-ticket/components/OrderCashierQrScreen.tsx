import { ChevronLeft } from "lucide-react";
import { useEffect } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ORDER_STOREFRONT_PX } from "../../lib/orderStorefrontGutter";
import { OrderCashierQrActiveView } from "./OrderCashierQrActiveView";
import { OrderCashierQrPaidView } from "./OrderCashierQrPaidView";
import { CASHIER_TICKET_I18N } from "../lib/cashierTicketCopy";
import { resolveCashierTicketUiPhase } from "../lib/cashierTicketLifecycle";
import { useCashierTicketPaidRedirect } from "../hooks/useCashierTicketPaidRedirect";
import { useCashierTicketStatus } from "../hooks/useCashierTicketStatus";
import { useGuestStoreRefresh } from "../hooks/useGuestStoreRefresh";
import { updateCashierTicketStatus, updateCashierTicketTotals } from "../lib/orderDeviceStore";

const ACCENT = "#E91E8C";

export function OrderCashierQrScreen({
  code,
  claimToken,
  storeName,
  tableNumber,
  grandTotal,
  expiresAt,
  fulfillment: fulfillmentProp,
  onBack,
  onReturnToMenu,
  onPaid,
}: {
  code: string;
  claimToken: string;
  storeName: string;
  tableNumber: string;
  grandTotal: number;
  expiresAt: string;
  fulfillment?: "dine_in" | "takeaway";
  onBack: () => void;
  onReturnToMenu: () => void;
  onPaid?: () => void;
}) {
  const { t } = useAppTranslation();
  const statusQuery = useCashierTicketStatus({ code, claimToken, enabled: true });
  const remote = statusQuery.data;
  const phase = resolveCashierTicketUiPhase(remote);
  const isPaid = phase === "paid";

  useGuestStoreRefresh({ code, tableNumber, isPaid });
  useCashierTicketPaidRedirect({ isPaid, onReturnToMenu });

  useEffect(() => {
    if (!remote?.ok) return;
    let localStatus: "pending" | "claimed" | "paid" | "expired" | "cancelled" = "pending";
    if (remote.paid || remote.status === "paid") localStatus = "paid";
    else if (remote.status === "expired") localStatus = "expired";
    else if (remote.status === "cancelled") localStatus = "cancelled";
    else if (remote.claimed) localStatus = "claimed";
    updateCashierTicketStatus(claimToken, localStatus);
    if (remote.grand_total != null) {
      updateCashierTicketTotals(claimToken, remote.grand_total);
    }
  }, [remote, claimToken]);

  useEffect(() => {
    if (isPaid) onPaid?.();
  }, [isPaid, onPaid]);

  const displayTotal = remote?.grand_total ?? grandTotal;
  const displayTable = remote?.table_number ?? tableNumber;
  const displayExpires = remote?.expires_at ?? expiresAt;
  const displayFulfillment = remote?.fulfillment ?? fulfillmentProp;

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-white">
      <div className={`flex shrink-0 items-center gap-2 border-b border-neutral-200 ${ORDER_STOREFRONT_PX} py-3`}>
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center text-neutral-800"
          aria-label={t(CASHIER_TICKET_I18N.backToMenu, "Back")}
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2} />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-[17px] font-semibold text-neutral-900">
          {isPaid
            ? t(CASHIER_TICKET_I18N.paidSuccess, "Payment successful")
            : t(CASHIER_TICKET_I18N.qrTitle, "Show to Cashier")}
        </h1>
        <span className="h-8 w-8" aria-hidden />
      </div>
      {isPaid ? (
        <OrderCashierQrPaidView
          storeName={storeName}
          tableNumber={displayTable}
          grandTotal={displayTotal}
          onOrderAgain={onReturnToMenu}
        />
      ) : (
        <OrderCashierQrActiveView
          storeName={storeName}
          tableNumber={displayTable}
          grandTotal={displayTotal}
          claimToken={claimToken}
          expiresAt={displayExpires}
          phase={phase === "expired" ? "expired" : phase === "claimed" ? "claimed" : "waiting"}
          fulfillment={displayFulfillment}
        />
      )}
      {!isPaid ? (
        <div className={`shrink-0 border-t border-neutral-100 ${ORDER_STOREFRONT_PX} py-3`}>
          <button
            type="button"
            onClick={onBack}
            className="w-full rounded-full py-2.5 text-[14px] font-medium"
            style={{ color: ACCENT }}
          >
            {t(CASHIER_TICKET_I18N.backToMenuAddItems, "Back to menu — add items")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
