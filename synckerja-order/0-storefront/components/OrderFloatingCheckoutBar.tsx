import { ChevronUp, ShoppingBasket } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { SYNCKERJA_ORDER_I18N } from "@/synckerja-order/shared/lib/orderCopy";
import { formatOrderRp } from "../lib/formatOrderRp";
import { ORDER_STOREFRONT_INSET_X } from "../lib/orderStorefrontGutter";

const BAR_PINK = "#E91E8C";

/** Sit above phone home indicator + mobile browser chrome. */
export const ORDER_CHECKOUT_BAR_BOTTOM =
  "bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))]";
/** Toast / scroll-top sit just above the checkout bar. */
export const ORDER_CHECKOUT_STACK_BOTTOM =
  "bottom-[calc(1.25rem+4.5rem+env(safe-area-inset-bottom,0px))]";

type BarProps = {
  itemCount: number;
  total: number;
  onCheckout: () => void;
};

export function OrderFloatingCheckoutBar({ itemCount, total, onCheckout }: BarProps) {
  const { t } = useAppTranslation();
  if (itemCount <= 0) return null;

  return (
    <button
      type="button"
      onClick={onCheckout}
      className={`absolute ${ORDER_STOREFRONT_INSET_X} z-20 flex h-[58px] overflow-hidden rounded-[14px] shadow-[0_8px_24px_rgba(0,0,0,0.18)] ${ORDER_CHECKOUT_BAR_BOTTOM}`}
      aria-label={t("synckerjaOrder.store.checkoutCount", "CHECK OUT ({{count}})", { count: itemCount })}
    >
      <span className="relative flex w-[58px] shrink-0 items-center justify-center bg-white">
        <ShoppingBasket className="h-7 w-7" style={{ color: BAR_PINK }} strokeWidth={1.75} />
        <span className="absolute right-2 top-2 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-600 px-0.5 text-[10px] font-bold leading-none text-white">
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      </span>
      <span
        className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3.5 text-white"
        style={{ backgroundColor: BAR_PINK }}
      >
        <span className="min-w-0 text-left">
          <span className="block text-[11px] font-medium leading-tight opacity-95">
            {t(SYNCKERJA_ORDER_I18N.total, "Total")}
          </span>
          <span className="block text-[16px] font-bold leading-tight">{formatOrderRp(total)}</span>
        </span>
        <span className="shrink-0 text-[13px] font-bold uppercase tracking-wide">
          {t("synckerjaOrder.store.checkoutCount", "CHECK OUT ({{count}})", { count: itemCount })}
        </span>
      </span>
    </button>
  );
}

type ScrollTopProps = {
  visible: boolean;
  onClick: () => void;
};

export function OrderScrollTopButton({ visible, onClick }: ScrollTopProps) {
  const { t } = useAppTranslation();
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute right-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-neutral-500/90 text-white shadow-md ${ORDER_CHECKOUT_STACK_BOTTOM}`}
      aria-label={t("synckerjaOrder.store.scrollToTop", "Scroll to top")}
    >
      <ChevronUp className="h-5 w-5" strokeWidth={2.5} />
    </button>
  );
}
