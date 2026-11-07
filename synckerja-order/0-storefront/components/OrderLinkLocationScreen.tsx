import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { googleMapsEmbedSrc } from "@/synckerja-order/shared/lib/googleMapsLink";
import { buildOrderStorePath } from "@/synckerja-order/shared/lib/orderUrls";
import { expandGoogleMapsUrl } from "@/synckerja-order/shared/lib/resolveGoogleMapsLink";
import type { PublicOrderBranch } from "../lib/fetchPublicOrderLink";
import { ORDER_STOREFRONT_PX } from "../lib/orderStorefrontGutter";

type Props = {
  locationName: string;
  address?: string | null;
  mapsUrl: string | null;
  branches?: PublicOrderBranch[];
  onBack: () => void;
};

/** Advertising link: map and place name. Guest profile tabs stay on the QR page. */
export function OrderLinkLocationScreen({
  locationName,
  address,
  mapsUrl,
  branches = [],
  onBack,
}: Props) {
  const placeAddress = address?.trim() || "";
  const { t } = useAppTranslation();
  const openUrl = mapsUrl?.trim() || null;
  const directEmbed = openUrl ? googleMapsEmbedSrc(openUrl) : null;
  const [expandedEmbed, setExpandedEmbed] = useState<string | null>(null);
  const [expanding, setExpanding] = useState(false);
  const embedSrc = directEmbed || expandedEmbed;

  useEffect(() => {
    if (!openUrl || directEmbed) {
      setExpandedEmbed(null);
      setExpanding(false);
      return;
    }
    let cancelled = false;
    setExpanding(true);
    setExpandedEmbed(null);
    void expandGoogleMapsUrl(openUrl).then((canonical) => {
      if (cancelled) return;
      setExpandedEmbed(canonical ? googleMapsEmbedSrc(canonical) : null);
      setExpanding(false);
    });
    return () => {
      cancelled = true;
    };
  }, [openUrl, directEmbed]);

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-neutral-100">
      <div className={`flex shrink-0 items-center gap-2 bg-white ${ORDER_STOREFRONT_PX} py-3`}>
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center text-neutral-800"
          aria-label={t("synckerjaOrder.store.close", "Close")}
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2} />
        </button>
        <h1 className="min-w-0 flex-1 text-center text-[17px] font-semibold text-neutral-900">
          {t("synckerjaOrder.store.ourLocation", "Lokasi Kami")}
        </h1>
        <span className="h-8 w-8" aria-hidden />
      </div>
      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className={`flex min-h-full flex-col ${ORDER_STOREFRONT_PX} pb-2 pt-4`}>
          <div className="mb-3 flex shrink-0 items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
            <div className="min-w-0">
              <h2 className="truncate text-[16px] font-semibold text-neutral-900">{locationName}</h2>
              {placeAddress ? (
                <p className="mt-0.5 text-[13px] leading-snug text-neutral-500">{placeAddress}</p>
              ) : null}
            </div>
          </div>
          {embedSrc ? (
            <iframe
              title={locationName}
              src={embedSrc}
              className="min-h-[280px] w-full flex-1 rounded-xl border-0 bg-white"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div
              className="flex min-h-[280px] flex-1 items-center justify-center rounded-xl bg-white px-6 text-center text-sm text-neutral-500"
              aria-busy={expanding}
            >
              {expanding
                ? null
                : openUrl
                  ? t(
                      "synckerjaOrder.store.mapsShortLink",
                      "The map could not be loaded. Use the button below to open Google Maps.",
                    )
                  : t("synckerjaOrder.store.mapsMissing", "A Google Maps link has not been added yet.")}
            </div>
          )}
          {openUrl ? (
            <a
              href={openUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 shrink-0 text-center text-[13px] font-medium text-primary"
            >
              {t("synckerjaOrder.store.openMaps", "Open in Google Maps")}
            </a>
          ) : null}
        </div>
        {branches.length > 0 ? (
          <div className={`${ORDER_STOREFRONT_PX} pb-2`}>
            <p className="mb-1.5 text-[14px] font-semibold text-neutral-900">
              {t("synckerjaOrder.store.ourBranches", "Cabang Kami")}
            </p>
            <div className="overflow-hidden rounded-xl bg-white">
              {branches.map((branch) => (
                <a
                  key={branch.public_code}
                  href={buildOrderStorePath(branch.public_code, { mode: "link" }, branch.name)}
                  className="flex items-center gap-3 border-b border-neutral-100 px-3 py-2.5 last:border-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-neutral-900">
                      {branch.name}
                    </span>
                    {branch.address ? (
                      <span className="mt-0.5 block truncate text-[12px] text-neutral-500">
                        {branch.address}
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
                </a>
              ))}
            </div>
          </div>
        ) : null}
        <div
          className="h-2 shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
          aria-hidden
        />
      </div>
    </div>
  );
}
