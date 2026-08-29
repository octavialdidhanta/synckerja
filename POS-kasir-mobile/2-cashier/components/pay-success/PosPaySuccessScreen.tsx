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
import { POS_PAY_SUCCESS_I18N } from "../../lib/posPaySuccessCopy";

export type PosPaySuccessPayload = {
  amountDue: number;
  cashTendered: number | null;
  paymentMethod: CustomerVisitCheckoutPaymentMethod;
  walletLabel: string | null;
  customerName: string;
  activityId: string | null;
  leadId: string | null;
  linesSnapshot: CustomerVisitCartLine[];
  totalsSnapshot: CatalogCheckoutTotals;
};

type Props = {
  open: boolean;
  payload: PosPaySuccessPayload | null;
  digitalEnabled: boolean;
  sendingEmail?: boolean;
  sendingSms?: boolean;
  printing?: boolean;
  onSendEmail: (email: string, customerName: string) => void;
  onSendSms: (phoneLocal: string, customerName: string) => void;
  onPrint: () => void;
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
  digitalEnabled,
  sendingEmail,
  sendingSms,
  printing,
  onSendEmail,
  onSendSms,
  onPrint,
  onNewTransaction,
}: Props) {
  const { t } = useAppTranslation();
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneLocal, setPhoneLocal] = useState("");

  useEffect(() => {
    if (!open || !payload) return;
    setCustomerName(personalCustomerName(payload.customerName) ?? "");
    setEmail("");
    setPhoneLocal("");
  }, [open, payload]);

  if (!open || !payload) return null;

  const change =
    payload.paymentMethod === "cash" && payload.cashTendered != null
      ? Math.max(0, Math.round(payload.cashTendered) - Math.round(payload.amountDue))
      : null;
  const showChange = payload.paymentMethod === "cash";

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-100">
      <div className="px-4 pt-4">
        <p className="text-sm font-bold uppercase tracking-wide text-primary">
          {methodLabel(payload, t)}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center px-6 pb-8">
        <div className="flex w-full max-w-md flex-1 flex-col">
          <div className="flex flex-1 flex-col items-center justify-center">
            <p className="text-sm text-slate-600">
              {t(POS_PAY_SUCCESS_I18N.paid, "Paid {{amount}}", {
                amount: formatStoreCheckoutRp(payload.amountDue),
              })}
            </p>

            {showChange ? (
              <>
                <p className="mt-3 text-3xl font-bold text-primary sm:text-4xl">
                  {t(POS_PAY_SUCCESS_I18N.change, "Change")}
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-primary sm:text-4xl">
                  {formatStoreCheckoutRp(change ?? 0)}
                </p>
              </>
            ) : (
              <p className="mt-3 text-3xl font-bold text-primary sm:text-4xl">
                {formatStoreCheckoutRp(payload.amountDue)}
              </p>
            )}

            <span className="mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
              <Check className="h-9 w-9" strokeWidth={3} aria-hidden />
            </span>

            {!digitalEnabled ? (
              <p className="mt-8 text-center text-xs text-slate-500">
                {t(
                  POS_PAY_SUCCESS_I18N.digitalDisabled,
                  "Digital receipt is only available for catalog sales.",
                )}
              </p>
            ) : (
              <div className="mt-8 w-full space-y-3">
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={t(POS_PAY_SUCCESS_I18N.namePlaceholder, "Customer name (optional)")}
                  className="h-11 bg-white"
                  disabled={sendingEmail || sendingSms}
                />
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t(POS_PAY_SUCCESS_I18N.emailPlaceholder, "Email receipt")}
                    className="h-11 flex-1 bg-white"
                    disabled={sendingEmail}
                  />
                  <Button
                    type="button"
                    className="h-11 shrink-0 px-5"
                    disabled={sendingEmail || !email.trim()}
                    onClick={() => onSendEmail(email.trim(), customerName.trim())}
                  >
                    {t(POS_PAY_SUCCESS_I18N.send, "Send")}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-white px-2">
                    <span className="shrink-0 text-sm font-medium text-slate-600">+62</span>
                    <Input
                      value={phoneLocal}
                      onChange={(e) => setPhoneLocal(e.target.value.replace(/\D/g, ""))}
                      placeholder={t(POS_PAY_SUCCESS_I18N.smsPlaceholder, "SMS receipt")}
                      className="h-11 border-0 shadow-none focus-visible:ring-0"
                      inputMode="tel"
                      disabled={sendingSms}
                    />
                  </div>
                  <Button
                    type="button"
                    className="h-11 shrink-0 px-5"
                    disabled={sendingSms || phoneLocal.length < 8 || phoneLocal.length > 15}
                    onClick={() => onSendSms(phoneLocal, customerName.trim())}
                  >
                    {t(POS_PAY_SUCCESS_I18N.send, "Send")}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 w-full space-y-2">
            <Button
              type="button"
              className="h-12 w-full text-base font-semibold"
              disabled={printing || payload.linesSnapshot.length === 0}
              onClick={onPrint}
            >
              {t(POS_PAY_SUCCESS_I18N.print, "Print Receipt")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full border-primary text-base font-semibold text-primary"
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
        </div>
      </div>
    </div>
  );
}
