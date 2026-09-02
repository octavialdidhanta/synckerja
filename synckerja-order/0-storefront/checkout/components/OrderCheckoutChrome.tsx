import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatOrderRp } from "../../lib/formatOrderRp";
import { ORDER_STOREFRONT_PX } from "../../lib/orderStorefrontGutter";
import { ORDER_CHECKOUT_I18N } from "../lib/orderCheckoutCopy";

const ACCENT = "#E91E8C";

export function OrderCheckoutHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  const { t } = useAppTranslation();
  return (
    <div className={`flex shrink-0 items-center gap-2 border-b border-neutral-200 ${ORDER_STOREFRONT_PX} py-3`}>
      <button
        type="button"
        onClick={onBack}
        className="flex h-8 w-8 items-center justify-center text-neutral-800"
        aria-label={t(ORDER_CHECKOUT_I18N.back, "Back")}
      >
        <ChevronLeft className="h-6 w-6" strokeWidth={2} />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-center text-[17px] font-semibold text-neutral-900">
        {title}
      </h1>
      <span className="h-8 w-8" aria-hidden />
    </div>
  );
}

export function OrderCheckoutFooter({
  totalLabel,
  total,
  cta,
  disabled,
  onCta,
}: {
  totalLabel?: string;
  total: number;
  cta: string;
  disabled?: boolean;
  onCta: () => void;
}) {
  const { t } = useAppTranslation();
  return (
    <div
      className={`shrink-0 border-t border-neutral-200 bg-white ${ORDER_STOREFRONT_PX} pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[14px] text-neutral-800">
          {totalLabel ?? t(ORDER_CHECKOUT_I18N.totalPayment, "Total Payment")}
        </p>
        <p className="text-[16px] font-bold text-neutral-900">{formatOrderRp(total)}</p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onCta}
        className="h-12 w-full rounded-xl text-[15px] font-bold text-white disabled:opacity-40"
        style={{ backgroundColor: ACCENT }}
      >
        {cta}
      </button>
    </div>
  );
}

export function OrderCheckoutShell({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-white">{children}</div>
  );
}
