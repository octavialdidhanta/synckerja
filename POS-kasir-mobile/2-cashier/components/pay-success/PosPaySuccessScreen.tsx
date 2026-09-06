import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatStoreCheckoutRp } from "@/5-2-customer-visits/checkout/lib/catalogLabel";
import type { CatalogCheckoutTotals } from "@/8-2-1-default-prices/checkout/lib/computeCatalogCheckoutTotals";
import type {
  CustomerVisitCartLine,
  CustomerVisitCheckoutPaymentMethod,
} from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { personalCustomerName } from "@/pos-receipt-feedback/lib/isGenericCustomerName";
import { isPaySuccessNewTransactionBlocked } from "../../lib/pay-first-seating";
import { sanitizePosPhoneLocalInput } from "../../lib/posCashierCustomer";
import { posPaySuccessContactPrefill } from "../../lib/posPaySuccessContactPrefill";
import { shouldShowPosPaySuccessSmsRow } from "../../lib/shouldShowPosPaySuccessSmsRow";
import { POS_PAY_SUCCESS_I18N } from "../../lib/posPaySuccessCopy";
import { usePosCashierIsPhoneLayout } from "../../hooks/usePosCashierIsPhoneLayout";
import { usePosOutletReceiptShareSettings } from "../../hooks/usePosOutletReceiptShareSettings";
import { usePosReceiptSentStatus } from "@/pos-mobile/shared/hooks/usePosReceiptSentStatus";
import { usePosKeyboardDock } from "@/pos-mobile/shared/hooks/usePosKeyboardDock";
import { PosSafeAreaTopSpacer } from "@/pos-mobile/shared/layout/PosSafeAreaTopSpacer";
import { cn } from "@/shared/lib/utils";

export type PosPaySuccessPayload = {
  amountDue: number;
  cashTendered: number | null;
  paymentMethod: CustomerVisitCheckoutPaymentMethod;
  walletLabel: string | null;
  customerName: string;
  /** Optional CRM / cart email for digital receipt prefill. */
  customerEmail?: string | null;
  /** Optional CRM / cart phone (any format) for SMS receipt prefill. */
  customerPhone?: string | null;
  activityId: string | null;
  leadId: string | null;
  linesSnapshot: CustomerVisitCartLine[];
  totalsSnapshot: CatalogCheckoutTotals;
  /** Pay-first KDS session to bind a table after dine-in pay. */
  sessionId?: string | null;
  needsTablePick?: boolean;
  tableLabel?: string | null;
  /** Hide email/SMS receipt block for Synckerja Order pay-at-cashier. */
  checkoutChannel?: "synckerja_cashier" | "qris" | null;
};

type Props = {
  open: boolean;
  payload: PosPaySuccessPayload | null;
  outletId?: string | null;
  digitalEnabled: boolean;
  sendingEmail?: boolean;
  sendingSms?: boolean;
  printing?: boolean;
  pickingTable?: boolean;
  onSendEmail: (email: string, customerName: string) => void;
  onSendSms: (phoneLocal: string, customerName: string) => void;
  onPrint: () => void;
  onPickTable?: () => void;
  onNewTransaction: () => void;
};

function methodLabel(
  payload: PosPaySuccessPayload,
  t: (key: string, fallback: string) => string,
): string {
  if (payload.paymentMethod === "cash") {
    return t(POS_PAY_SUCCESS_I18N.methodCash, "CASH");
  }
  if (payload.paymentMethod === "bank_transfer") {
    return t(POS_PAY_SUCCESS_I18N.methodTransfer, "TRANSFER");
  }
  return (
    payload.walletLabel?.toUpperCase() ||
    t(POS_PAY_SUCCESS_I18N.methodEwallet, "E-WALLET")
  );
}

export function PosPaySuccessScreen({
  open,
  payload,
  outletId,
  digitalEnabled,
  sendingEmail,
  sendingSms,
  printing,
  pickingTable,
  onSendEmail,
  onSendSms,
  onPrint,
  onPickTable,
  onNewTransaction,
}: Props) {
  const { t } = useAppTranslation();
  const isPhone = usePosCashierIsPhoneLayout();
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneLocal, setPhoneLocal] = useState("");
  const receiptSent = usePosReceiptSentStatus(open ? payload?.activityId ?? null : null);
  const shareSettings = usePosOutletReceiptShareSettings(open ? outletId : null);
  const shareViaEmail = Boolean(shareSettings.data?.shareViaEmail);
  const shareViaSms = Boolean(shareSettings.data?.shareViaSms);
  const keyboardDock = usePosKeyboardDock({ enabled: open && Boolean(payload) });

  useEffect(() => {
    if (!open || !payload) return;
    setCustomerName(personalCustomerName(payload.customerName) ?? "");
    const contact = posPaySuccessContactPrefill({
      email: payload.customerEmail,
      phone: payload.customerPhone,
    });
    setEmail(contact.email);
    setPhoneLocal(contact.phoneLocal);
  }, [open, payload]);

  if (!open || !payload) return null;

  const change =
    payload.paymentMethod === "cash" && payload.cashTendered != null
      ? Math.max(0, Math.round(payload.cashTendered) - Math.round(payload.amountDue))
      : null;
  const showChange = payload.paymentMethod === "cash";
  const newTxBlocked = isPaySuccessNewTransactionBlocked({
    needsTablePick: payload.needsTablePick,
    tableLabel: payload.tableLabel,
  });
  const showPickTable =
    Boolean(payload.needsTablePick && !payload.tableLabel && onPickTable);
  const digitalBase =
    digitalEnabled && payload.checkoutChannel !== "synckerja_cashier";
  const showEmailRow = digitalBase && shareViaEmail;
  const showSmsRow =
    digitalBase &&
    shouldShowPosPaySuccessSmsRow({
      shareViaSms,
      customerPhone: payload.customerPhone,
      phoneLocal,
    });
  const showDigitalReceipt = showEmailRow || showSmsRow;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-slate-100">
      {isPhone ? <PosSafeAreaTopSpacer className="bg-slate-100" /> : null}
      <div className="flex-shrink-0 px-4 pt-3 sm:pt-4">
        <p className="text-sm font-bold uppercase tracking-wide text-primary">
          {methodLabel(payload, t)}
        </p>
      </div>

      <div
        ref={keyboardDock.scrollRootRef}
        className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center py-3">
          <p className="text-sm text-slate-600">
            {t(POS_PAY_SUCCESS_I18N.paid, "Paid {{amount}}", {
              amount: formatStoreCheckoutRp(payload.amountDue),
            })}
          </p>

          {showChange ? (
            <>
              <p className="mt-2 text-3xl font-bold text-primary sm:mt-3 sm:text-4xl">
                {t(POS_PAY_SUCCESS_I18N.change, "Change")}
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-primary sm:text-4xl">
                {formatStoreCheckoutRp(change ?? 0)}
              </p>
            </>
          ) : (
            <p className="mt-2 text-3xl font-bold text-primary sm:mt-3 sm:text-4xl">
              {formatStoreCheckoutRp(payload.amountDue)}
            </p>
          )}

          <span className="mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md sm:mt-6 sm:h-16 sm:w-16">
            <Check className="h-8 w-8 sm:h-9 sm:w-9" strokeWidth={3} aria-hidden />
          </span>

          {payload.tableLabel ? (
            <p className="mt-3 text-sm font-medium text-slate-700">
              {t(POS_PAY_SUCCESS_I18N.tableAssigned, "Table: {{name}}", {
                name: payload.tableLabel,
              })}
            </p>
          ) : payload.needsTablePick ? (
            <p className="mt-3 text-center text-xs text-slate-500">
              {t(
                POS_PAY_SUCCESS_I18N.needTable,
                "Choose a table before starting a new transaction.",
              )}
            </p>
          ) : null}

          {!showDigitalReceipt ? (
            payload.checkoutChannel === "synckerja_cashier" ? null : (
            <p className="mt-6 text-center text-xs text-slate-500">
              {t(
                POS_PAY_SUCCESS_I18N.digitalDisabled,
                "Digital receipt is only available for catalog sales.",
              )}
            </p>
            )
          ) : (
            <div className="mt-5 w-full space-y-3 sm:mt-8">
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={t(POS_PAY_SUCCESS_I18N.namePlaceholder, "Customer name (optional)")}
                className="h-11 bg-white"
                disabled={sendingEmail || sendingSms}
              />
              {showEmailRow ? (
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t(POS_PAY_SUCCESS_I18N.emailPlaceholder, "Email receipt")}
                    className="h-11 flex-1 bg-white"
                    disabled={sendingEmail || receiptSent.emailSent}
                  />
                  <Button
                    type="button"
                    className={
                      receiptSent.emailSent
                        ? "h-11 shrink-0 gap-1.5 bg-emerald-600 px-5 hover:bg-emerald-600 disabled:opacity-100"
                        : "h-11 shrink-0 px-5"
                    }
                    disabled={
                      receiptSent.emailSent || sendingEmail || !email.trim()
                    }
                    onClick={() => onSendEmail(email.trim(), customerName.trim())}
                  >
                    {receiptSent.emailSent ? (
                      <Check className="h-4 w-4 shrink-0" aria-hidden strokeWidth={2.5} />
                    ) : null}
                    {t(POS_PAY_SUCCESS_I18N.send, "Send")}
                  </Button>
                </div>
              ) : null}
              {showSmsRow ? (
                <div className="flex gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-white px-2">
                    <span className="shrink-0 text-sm font-medium text-slate-600">+62</span>
                    <Input
                      value={phoneLocal}
                      onChange={(e) =>
                        setPhoneLocal(sanitizePosPhoneLocalInput(e.target.value))
                      }
                      placeholder={t(POS_PAY_SUCCESS_I18N.smsPlaceholder, "SMS receipt")}
                      className="h-11 border-0 shadow-none focus-visible:ring-0"
                      inputMode="tel"
                      disabled={sendingSms || receiptSent.smsSent}
                    />
                  </div>
                  <Button
                    type="button"
                    className={
                      receiptSent.smsSent
                        ? "h-11 shrink-0 gap-1.5 bg-emerald-600 px-5 hover:bg-emerald-600 disabled:opacity-100"
                        : "h-11 shrink-0 px-5"
                    }
                    disabled={
                      receiptSent.smsSent ||
                      sendingSms ||
                      phoneLocal.length < 8 ||
                      phoneLocal.length > 15
                    }
                    onClick={() => onSendSms(phoneLocal, customerName.trim())}
                  >
                    {receiptSent.smsSent ? (
                      <Check className="h-4 w-4 shrink-0" aria-hidden strokeWidth={2.5} />
                    ) : null}
                    {t(POS_PAY_SUCCESS_I18N.send, "Send")}
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div
        className={cn(
          "flex-shrink-0 border-t border-slate-200 bg-slate-100 px-6 pt-3",
          keyboardDock.keyboardOpen && "pb-1",
        )}
      >
        <div className="mx-auto w-full max-w-md space-y-2 pb-3">
          {showPickTable ? (
            <Button
              type="button"
              className="h-12 w-full text-base font-semibold"
              disabled={pickingTable}
              onClick={() => onPickTable?.()}
            >
              {t(POS_PAY_SUCCESS_I18N.pickTable, "Pick table")}
            </Button>
          ) : null}
          <Button
            type="button"
            variant={showPickTable ? "outline" : "default"}
            className={
              showPickTable
                ? "h-12 w-full border-primary text-base font-semibold text-primary"
                : "h-12 w-full text-base font-semibold"
            }
            disabled={printing || payload.linesSnapshot.length === 0}
            onClick={onPrint}
          >
            {t(POS_PAY_SUCCESS_I18N.print, "Print Receipt")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full border-primary text-base font-semibold text-primary"
            disabled={newTxBlocked}
            onClick={() => {
              setCustomerName("");
              setEmail("");
              setPhoneLocal("");
              onNewTransaction();
            }}
          >
            {t(POS_PAY_SUCCESS_I18N.newTransaction, "New Transaction")}
          </Button>
        </div>
        {isPhone && !keyboardDock.keyboardOpen ? (
          <div
            aria-hidden
            className="h-[max(0.75rem,env(safe-area-inset-bottom,0px),var(--footer-bottom-inset,0px),3rem)]"
          />
        ) : null}
      </div>
    </div>
  );
}
