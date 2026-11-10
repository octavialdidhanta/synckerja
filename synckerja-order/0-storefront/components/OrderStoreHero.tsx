import { useState, type ReactNode } from "react";
import { ChevronRight, MapPin, Menu, Search } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { orderHoursBadge } from "@/synckerja-order/shared/lib/orderHours";
import type { PublicOrderHours } from "@/synckerja-order/shared/lib/orderTypes";
import { useOneWayCoverSlide } from "../lib/useCoverSlideIndex";
import { ORDER_STOREFRONT_PX } from "../lib/orderStorefrontGutter";

type Props = {
  coverUrl: string | null | undefined;
  coverUrls?: readonly string[] | null;
  logoUrl?: string | null;
  storeName: string;
  isOpen: boolean;
  hours: PublicOrderHours | null | undefined;
  onSearch: () => void;
  onMenu: () => void;
  onStoreInfo: () => void;
  /** Advertising link only. QR / dine-in keeps the chevron without this label. */
  showLocation?: boolean;
  /** Link mode with ordering paused has no location screen, so the card is not a button. */
  storeInfoInteractive?: boolean;
  /** The link-mode menu opens the location screen. Hide it when that screen is closed. */
  showMenu?: boolean;
  /** Empty cover on the live menu shows the marketing line. A paused store leaves the band plain. */
  showCoverSlogan?: boolean;
};

const identityCardClass =
  "flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left shadow-[0_8px_24px_rgba(0,0,0,0.18)]";

function StoreIdentityCard({
  interactive,
  onClick,
  children,
}: {
  interactive: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  if (!interactive) return <div className={identityCardClass}>{children}</div>;
  return (
    <button type="button" onClick={onClick} className={identityCardClass}>
      {children}
    </button>
  );
}

export function OrderStoreHero({
  coverUrl,
  coverUrls,
  logoUrl,
  storeName,
  isOpen,
  hours,
  onSearch,
  onMenu,
  onStoreInfo,
  showLocation = false,
  storeInfoInteractive = true,
  showMenu = true,
  showCoverSlogan = true,
}: Props) {
  const { t } = useAppTranslation();
  const [coverPaused, setCoverPaused] = useState(false);
  const slides = (coverUrls ?? []).map((url) => url.trim()).filter(Boolean);
  const photos = slides.length > 0 ? slides : coverUrl?.trim() ? [coverUrl.trim()] : [];
  const coverMotion = useOneWayCoverSlide(photos.length, coverPaused);
  const coverFrames =
    photos.length > 1 ? [photos[coverMotion.incoming], photos[coverMotion.visible]] : photos;
  const badge = orderHoursBadge({
    isOpen,
    closeHhmm: hours?.close_hhmm ?? null,
    nextOpenHhmm: hours?.next_open_hhmm ?? null,
    nextOpenIsToday: Boolean(hours?.next_open_is_today),
  });
  const badgeLabel =
    badge.kind === "open"
      ? badge.time
        ? t("synckerjaOrder.store.openBadge", "OPEN – Closes {{time}}", { time: badge.time })
        : t("synckerjaOrder.store.openNow", "OPEN")
      : badge.kind === "closedToday" && badge.time
        ? t("synckerjaOrder.store.closedToday", "CLOSED – Open Today {{time}}", {
            time: badge.time,
          })
        : badge.time
          ? t("synckerjaOrder.store.closedLater", "CLOSED – Opens {{time}}", {
              time: badge.time,
            })
          : t("synckerjaOrder.store.closedNow", "CLOSED");

  return (
    <div className="relative">
      <div
        className="relative h-[240px] overflow-hidden bg-neutral-900"
        style={{ height: 240, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}
        onMouseEnter={() => setCoverPaused(true)}
        onMouseLeave={() => setCoverPaused(false)}
      >
        {photos.length > 0 ? (
          <>
            <div
              data-cover-track
              className={`flex h-full ${
                coverMotion.animate ? "transition-transform duration-500 ease-out motion-reduce:transition-none" : ""
              }`}
              style={{
                width: photos.length > 1 ? "200%" : "100%",
                transform: `translateX(${photos.length > 1 && coverMotion.phase === 0 ? "-50%" : "0%"})`,
              }}
              onTransitionEnd={(event) => {
                if (event.propertyName !== "transform") return;
                coverMotion.settle();
              }}
            >
              {coverFrames.map((url, slide) => (
                <img
                  key={`${slide}:${url}`}
                  src={url}
                  alt=""
                  className="h-full object-cover"
                  style={{ width: photos.length > 1 ? "50%" : "100%" }}
                />
              ))}
            </div>
            {photos.length > 1 ? (
              <div className="absolute bottom-14 left-0 right-0 z-10 flex justify-center gap-1.5" aria-hidden>
                {photos.map((url, slide) => (
                  <span
                    key={`${slide}:${url}`}
                    className={`h-1.5 w-1.5 rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.35)] ${
                      slide === coverMotion.visible ? "bg-white" : "bg-white/50"
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className={`flex h-full flex-col justify-end bg-gradient-to-br from-neutral-800 via-neutral-900 to-black ${ORDER_STOREFRONT_PX} pb-16`}>
            {showCoverSlogan ? (
              <p className="whitespace-pre-line text-[28px] font-black leading-none tracking-tight text-white">
                {t("synckerjaOrder.store.heroTitle", "NEW delicious\nMENU")}
              </p>
            ) : null}
          </div>
        )}
      </div>
      <div className="absolute right-3 top-3 z-20 flex items-center gap-3 text-white drop-shadow">
        <button type="button" aria-label="Search" className="p-1" onClick={onSearch}>
          <Search className="h-6 w-6" strokeWidth={2} />
        </button>
        {showMenu ? (
          <button type="button" aria-label="Menu" className="p-1" onClick={onMenu}>
            <Menu className="h-6 w-6" strokeWidth={2} />
          </button>
        ) : null}
      </div>
      <div className={`relative z-10 ${ORDER_STOREFRONT_PX}`} style={{ marginTop: -40 }}>
        <StoreIdentityCard interactive={storeInfoInteractive} onClick={onStoreInfo}>
          <span className="flex min-w-0 items-center gap-1">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
            ) : null}
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold text-neutral-900">{storeName}</span>
              <span
                className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  isOpen ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                }`}
              >
                {badgeLabel}
              </span>
            </span>
          </span>
          {showLocation || storeInfoInteractive ? (
            <span className="ml-3 inline-flex shrink-0 items-center gap-1 text-neutral-400">
              {showLocation ? (
                <>
                  <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
                  <span className="text-[12px] font-medium leading-none">
                    {t("synckerjaOrder.store.ourLocation", "Lokasi Kami")}
                  </span>
                </>
              ) : null}
              {storeInfoInteractive ? <ChevronRight className="h-5 w-5" /> : null}
            </span>
          ) : null}
        </StoreIdentityCard>
      </div>
    </div>
  );
}
