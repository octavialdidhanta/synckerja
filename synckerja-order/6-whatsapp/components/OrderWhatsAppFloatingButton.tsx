import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { buildOrderWhatsAppUrl, fillOrderWhatsAppMessage, ORDER_WHATSAPP_ICON_SRC } from "../lib/orderWhatsApp";

type Props = {
  phoneDigits: string;
  prefillMessage: string | null;
  outletName: string;
  tableName?: string | null;
  /** Tailwind `bottom-[…]` class so the button stacks above the checkout bar when it is visible. */
  bottomClassName: string;
  /** Fired when the guest opens WhatsApp. Must not block navigation. */
  onTrack?: (args: { href: string }) => void;
};

/** Storefront floating WhatsApp button, bottom-right of the phone shell (52px). */
export function OrderWhatsAppFloatingButton({
  phoneDigits,
  prefillMessage,
  outletName,
  tableName,
  bottomClassName,
  onTrack,
}: Props) {
  const { t } = useAppTranslation();
  const href = buildOrderWhatsAppUrl(
    phoneDigits,
    fillOrderWhatsAppMessage(prefillMessage, { outletName, tableName }),
  );
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onTrack?.({ href })}
      className={`absolute right-3 z-20 flex h-[52px] w-[52px] items-center justify-center rounded-full transition-transform active:scale-95 motion-safe:hover:scale-105 ${bottomClassName}`}
      aria-label={t("synckerjaOrder.store.whatsapp", "Chat on WhatsApp")}
      title={t("synckerjaOrder.store.whatsapp", "Chat on WhatsApp")}
    >
      <img
        src={ORDER_WHATSAPP_ICON_SRC}
        alt=""
        width={52}
        height={52}
        draggable={false}
        className="h-full w-full select-none drop-shadow-[0_4px_10px_rgba(0,0,0,0.22)]"
      />
    </a>
  );
}
