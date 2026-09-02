import type { ReactNode } from "react";
import QRCode from "react-qr-code";
import { Banknote, Check, Mail, Phone, QrCode, Store, User, Utensils } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ORDER_STOREFRONT_PX } from "../../lib/orderStorefrontGutter";
import { ORDER_CHECKOUT_I18N } from "../lib/orderCheckoutCopy";
import type { OrderFulfillment } from "../lib/orderFulfillment";
import type { OrderPaymentKind } from "../lib/orderCheckoutSteps";
import { canContinueCustomer, canSubmitPayment } from "../lib/orderCheckoutSteps";
import {
  OrderCheckoutFooter,
  OrderCheckoutHeader,
  OrderCheckoutShell,
} from "./OrderCheckoutChrome";

const ACCENT = "#E91E8C";

function Field({
  label,
  required,
  icon,
  children,
}: {
  label: string;
  required?: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-neutral-800">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
          {icon}
        </span>
        {children}
      </span>
    </label>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-10 pr-3 text-[14px] text-neutral-900 outline-none focus:border-neutral-400 disabled:opacity-60";

function PaymentKindTab({
  selected,
  title,
  onSelect,
}: {
  selected: boolean;
  title: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-h-[72px] flex-1 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-center ${
        selected
          ? "border-neutral-900 bg-white shadow-sm"
          : "border-neutral-200 bg-neutral-50 text-neutral-600"
      }`}
    >
      <span className="text-[13px] font-medium text-neutral-900">{title}</span>
    </button>
  );
}

export function OrderPaymentScreen({
  guestName,
  guestPhone,
  guestEmail,
  tableNumber,
  storeName,
  fulfillment,
  kind,
  qrisSelected,
  qrisCode,
  total,
  busy,
  onBack,
  onGuestNameChange,
  onGuestPhoneChange,
  onGuestEmailChange,
  onKindChange,
  onQrisSelectedChange,
  onPayOnline,
  onPayCashier,
}: {
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  tableNumber: string;
  storeName: string;
  fulfillment: OrderFulfillment;
  kind: OrderPaymentKind;
  qrisSelected: boolean;
  qrisCode: string | null;
  total: number;
  busy?: boolean;
  onBack: () => void;
  onGuestNameChange: (value: string) => void;
  onGuestPhoneChange: (value: string) => void;
  onGuestEmailChange: (value: string) => void;
  onKindChange: (kind: OrderPaymentKind) => void;
  onQrisSelectedChange: (selected: boolean) => void;
  onPayOnline: () => void;
  onPayCashier: () => void;
}) {
  const { t } = useAppTranslation();
  const canPay =
    canContinueCustomer(guestName) && canSubmitPayment({ kind, qrisSelected });
  const fulfillmentLabel =
    fulfillment === "takeaway"
      ? t(ORDER_CHECKOUT_I18N.takeAway, "Take Away")
      : t(ORDER_CHECKOUT_I18N.dineIn, "Dine In");

  return (
    <OrderCheckoutShell>
      <OrderCheckoutHeader
        title={t(ORDER_CHECKOUT_I18N.paymentTitle, "Payment")}
        onBack={onBack}
      />
      <div className={`min-h-0 flex-1 overflow-y-auto ${ORDER_STOREFRONT_PX} py-4`}>
        <div
          className="mb-4 flex items-center justify-between rounded-xl border px-3 py-2.5"
          style={{ borderColor: ACCENT }}
        >
          <span className="inline-flex items-center gap-2 text-[14px] font-medium text-neutral-800">
            <Utensils className="h-4 w-4" />
            {t(ORDER_CHECKOUT_I18N.orderType, "Order Type")}
          </span>
          <span className="inline-flex items-center gap-1 text-[14px] font-semibold text-neutral-900">
            <Check className="h-4 w-4" style={{ color: ACCENT }} strokeWidth={2.5} />
            {fulfillmentLabel}
          </span>
        </div>

        <h2 className="mb-3 text-[16px] font-semibold text-neutral-900">
          {t(ORDER_CHECKOUT_I18N.customerInfo, "Customer Information")}
        </h2>
        <div className="space-y-3">
          <Field
            label={t(ORDER_CHECKOUT_I18N.fullName, "Full Name")}
            required
            icon={<User className="h-4 w-4" />}
          >
            <input
              className={inputClass}
              value={guestName}
              disabled={busy}
              autoComplete="name"
              placeholder={t(ORDER_CHECKOUT_I18N.fullName, "Full Name")}
              onChange={(e) => onGuestNameChange(e.target.value)}
            />
          </Field>
          <Field
            label={t(ORDER_CHECKOUT_I18N.phone, "Phone")}
            icon={<Phone className="h-4 w-4" />}
          >
            <input
              className={inputClass}
              value={guestPhone}
              disabled={busy}
              inputMode="tel"
              autoComplete="tel"
              placeholder={t(ORDER_CHECKOUT_I18N.phone, "Phone")}
              onChange={(e) => onGuestPhoneChange(e.target.value)}
            />
          </Field>
          <Field
            label={t(ORDER_CHECKOUT_I18N.email, "Email")}
            icon={<Mail className="h-4 w-4" />}
          >
            <input
              className={inputClass}
              value={guestEmail}
              disabled={busy}
              inputMode="email"
              autoComplete="email"
              placeholder={t(ORDER_CHECKOUT_I18N.email, "Email")}
              onChange={(e) => onGuestEmailChange(e.target.value)}
            />
          </Field>
          <Field
            label={t(ORDER_CHECKOUT_I18N.tableNumber, "Table Number")}
            required
            icon={<Utensils className="h-4 w-4" />}
          >
            <input className={inputClass} value={tableNumber} readOnly disabled />
          </Field>
        </div>

        {storeName ? (
          <div className="mt-6">
            <p className="text-[14px] font-semibold text-neutral-900">
              {t(ORDER_CHECKOUT_I18N.orderedFrom, "Ordered from")}
            </p>
            <p className="mt-1 text-[13px] text-neutral-600">{storeName}</p>
          </div>
        ) : null}

        <h2 className="mb-3 mt-6 text-[16px] font-semibold text-neutral-900">
          {t(ORDER_CHECKOUT_I18N.paymentMethod, "Payment Method")}
        </h2>
        <div className="flex gap-2">
          <PaymentKindTab
            selected={kind === "online"}
            title={t(ORDER_CHECKOUT_I18N.onlinePayment, "Online Payment")}
            onSelect={() => onKindChange("online")}
          />
          <PaymentKindTab
            selected={kind === "cashier"}
            title={t(ORDER_CHECKOUT_I18N.payCashier, "Pay at cashier")}
            onSelect={() => onKindChange("cashier")}
          />
        </div>

        {kind === "online" ? (
          <div className="mt-4">
            <p className="mb-2 text-[14px] font-medium text-neutral-800">
              {t(ORDER_CHECKOUT_I18N.completePayment, "Complete your payment")}
            </p>
            {qrisCode ? (
              <div className="flex flex-col items-center gap-2">
                <div className="bg-white p-3">
                  <QRCode value={qrisCode} size={180} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("synckerjaOrder.store.scanQris", "Scan with your e-wallet")}
                </p>
              </div>
            ) : (
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 py-3"
                onClick={() => onQrisSelectedChange(!qrisSelected)}
              >
                <span className="inline-flex items-center gap-2 text-[13px] text-neutral-800">
                  <QrCode className="h-4 w-4" />
                  {t(ORDER_CHECKOUT_I18N.qris, "QRIS")}
                </span>
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                    qrisSelected ? "border-neutral-900" : "border-neutral-400"
                  }`}
                >
                  {qrisSelected ? <span className="h-2 w-2 rounded-full bg-neutral-900" /> : null}
                </span>
              </button>
            )}
          </div>
        ) : null}

        {kind === "cashier" && !qrisCode ? (
          <div className="mt-6 flex flex-col items-center text-center">
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
