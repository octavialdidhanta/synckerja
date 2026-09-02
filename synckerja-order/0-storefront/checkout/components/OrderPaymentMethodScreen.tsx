import type { ReactNode } from "react";
import QRCode from "react-qr-code";
import { Banknote, QrCode, Store } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ORDER_STOREFRONT_PX } from "../../lib/orderStorefrontGutter";
import { ORDER_CHECKOUT_I18N } from "../lib/orderCheckoutCopy";
import type { OrderPaymentKind } from "../lib/orderCheckoutSteps";
import { canSubmitPayment } from "../lib/orderCheckoutSteps";
import {
  OrderCheckoutFooter,
  OrderCheckoutHeader,
  OrderCheckoutShell,
} from "./OrderCheckoutChrome";

const ACCENT = "#E91E8C";

function MethodCard({
  selected,
  title,
  onSelect,
  children,
}: {
  selected: boolean;
  title: string;
  onSelect: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border px-3 py-3 text-left ${
        selected ? "border-neutral-900 bg-white" : "border-neutral-200 bg-neutral-50"
      }`}
    >
      <span className="flex items-center gap-3">
        <span
          className={`flex h-4 w-4 items-center justify-center rounded-full border ${
            selected ? "border-neutral-900" : "border-neutral-400"
          }`}
        >
          {selected ? <span className="h-2 w-2 rounded-full bg-neutral-900" /> : null}
        </span>
        <span className="text-[14px] font-medium text-neutral-900">{title}</span>
      </span>
      {children}
    </button>
  );
}

export function OrderPaymentMethodScreen({
  kind,
  qrisSelected,
  qrisCode,
  total,
  busy,
  onBack,
  onKindChange,
  onQrisSelectedChange,
  onPayOnline,
  onPayCashier,
}: {
  kind: OrderPaymentKind;
  qrisSelected: boolean;
  qrisCode: string | null;
  total: number;
  busy?: boolean;
  onBack: () => void;
  onKindChange: (kind: OrderPaymentKind) => void;
  onQrisSelectedChange: (selected: boolean) => void;
  onPayOnline: () => void;
  onPayCashier: () => void;
}) {
  const { t } = useAppTranslation();
  const canPay = canSubmitPayment({ kind, qrisSelected });

  return (
    <OrderCheckoutShell>
      <OrderCheckoutHeader
        title={t(ORDER_CHECKOUT_I18N.paymentTitle, "Payment")}
        onBack={onBack}
      />
      <div className={`min-h-0 flex-1 overflow-y-auto ${ORDER_STOREFRONT_PX} py-4`}>
        <h2 className="mb-3 text-[16px] font-semibold text-neutral-900">
          {t(ORDER_CHECKOUT_I18N.paymentMethod, "Payment Method")}
        </h2>
        <div className="space-y-2">
          <MethodCard
            selected={kind === "online"}
            title={t(ORDER_CHECKOUT_I18N.onlinePayment, "Online Payment")}
            onSelect={() => onKindChange("online")}
          >
            {kind === "online" ? (
              <span
                className="mt-3 flex w-full items-center justify-between rounded-lg bg-white px-2 py-2"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <span className="inline-flex items-center gap-2 text-[13px] text-neutral-800">
                  <QrCode className="h-4 w-4" />
                  {t(ORDER_CHECKOUT_I18N.qris, "QRIS")}
                </span>
                <button
                  type="button"
                  className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                    qrisSelected ? "border-neutral-900" : "border-neutral-400"
                  }`}
                  onClick={() => onQrisSelectedChange(!qrisSelected)}
                  aria-pressed={qrisSelected}
                >
                  {qrisSelected ? <span className="h-2 w-2 rounded-full bg-neutral-900" /> : null}
                </button>
              </span>
            ) : null}
          </MethodCard>
          <MethodCard
            selected={kind === "cashier"}
            title={t(ORDER_CHECKOUT_I18N.payCashier, "Pay at cashier")}
            onSelect={() => onKindChange("cashier")}
          />
        </div>

        {kind === "online" && qrisCode ? (
          <div className="mt-6 flex flex-col items-center gap-2">
            <p className="text-[14px] font-medium text-neutral-800">
              {t(ORDER_CHECKOUT_I18N.completePayment, "Complete your payment")}
            </p>
            <div className="bg-white p-3">
              <QRCode value={qrisCode} size={180} />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("synckerjaOrder.store.scanQris", "Scan with your e-wallet")}
            </p>
          </div>
        ) : null}

        {kind === "cashier" ? (
          <div className="mt-8 flex flex-col items-center text-center">
            <div
              className="relative mb-4 flex h-28 w-28 items-center justify-center rounded-full"
              style={{ backgroundColor: `${ACCENT}14` }}
            >
              <Store className="h-12 w-12" style={{ color: ACCENT }} strokeWidth={1.5} />
              <span className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow">
                <Banknote className="h-5 w-5 text-neutral-700" />
              </span>
            </div>
            <p className="max-w-[260px] text-[13px] text-neutral-600">
              {t(
                ORDER_CHECKOUT_I18N.cashierHint,
                "Please proceed to the cashier to complete your payment.",
              )}
            </p>
          </div>
        ) : null}
      </div>
      {qrisCode ? null : (
        <OrderCheckoutFooter
          total={total}
          cta={
            kind === "cashier"
              ? t(ORDER_CHECKOUT_I18N.payCashier, "Pay at cashier")
              : t(ORDER_CHECKOUT_I18N.pay, "Pay")
          }
          disabled={busy || !canPay}
          onCta={kind === "cashier" ? onPayCashier : onPayOnline}
        />
      )}
    </OrderCheckoutShell>
  );
}
