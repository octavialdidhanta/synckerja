import type { ReactNode } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ORDER_STOREFRONT_PX } from "../../lib/orderStorefrontGutter";
import { ORDER_CHECKOUT_I18N } from "../lib/orderCheckoutCopy";
import { canContinueCustomer } from "../lib/orderCheckoutSteps";
import {
  OrderCheckoutFooter,
  OrderCheckoutHeader,
  OrderCheckoutShell,
} from "./OrderCheckoutChrome";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-neutral-800">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-[14px] text-neutral-900 outline-none focus:border-neutral-400 disabled:opacity-60";

export function OrderCustomerScreen({
  guestName,
  guestPhone,
  guestEmail,
  tableNumber,
  storeName,
  total,
  disabled,
  onBack,
  onContinue,
  onGuestNameChange,
  onGuestPhoneChange,
  onGuestEmailChange,
}: {
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  tableNumber: string;
  storeName: string;
  total: number;
  disabled?: boolean;
  onBack: () => void;
  onContinue: () => void;
  onGuestNameChange: (value: string) => void;
  onGuestPhoneChange: (value: string) => void;
  onGuestEmailChange: (value: string) => void;
}) {
  const { t } = useAppTranslation();
  const canContinue = canContinueCustomer(guestName);

  return (
    <OrderCheckoutShell>
      <OrderCheckoutHeader
        title={t(ORDER_CHECKOUT_I18N.paymentTitle, "Payment")}
        onBack={onBack}
      />
      <div className={`min-h-0 flex-1 overflow-y-auto ${ORDER_STOREFRONT_PX} py-4`}>
        <h2 className="mb-4 text-[16px] font-semibold text-neutral-900">
          {t(ORDER_CHECKOUT_I18N.customerInfo, "Customer Information")}
        </h2>
        <div className="space-y-3">
          <Field label={t(ORDER_CHECKOUT_I18N.fullName, "Full Name")} required>
            <input
              className={inputClass}
              value={guestName}
              disabled={disabled}
              autoComplete="name"
              onChange={(e) => onGuestNameChange(e.target.value)}
            />
          </Field>
          <Field label={t(ORDER_CHECKOUT_I18N.phone, "Phone")}>
            <input
              className={inputClass}
              value={guestPhone}
              disabled={disabled}
              inputMode="tel"
              autoComplete="tel"
              onChange={(e) => onGuestPhoneChange(e.target.value)}
            />
          </Field>
          <Field label={t(ORDER_CHECKOUT_I18N.email, "Email")}>
            <input
              className={inputClass}
              value={guestEmail}
              disabled={disabled}
              inputMode="email"
              autoComplete="email"
              onChange={(e) => onGuestEmailChange(e.target.value)}
            />
          </Field>
          <Field label={t(ORDER_CHECKOUT_I18N.tableNumber, "Table Number")} required>
            <input className={inputClass} value={tableNumber} readOnly disabled />
          </Field>
        </div>
        {storeName ? (
          <p className="mt-6 text-[13px] text-neutral-500">
            {t(ORDER_CHECKOUT_I18N.orderedFrom, "Ordered from")}{" "}
            <span className="font-medium text-neutral-800">{storeName}</span>
          </p>
        ) : null}
      </div>
      <OrderCheckoutFooter
        total={total}
        cta={t(ORDER_CHECKOUT_I18N.continue, "Continue")}
        disabled={disabled || !canContinue}
        onCta={onContinue}
      />
    </OrderCheckoutShell>
  );
}
