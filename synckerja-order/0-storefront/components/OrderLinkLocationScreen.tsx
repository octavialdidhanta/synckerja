import { ChevronLeft, ChevronRight, MapPin, Phone, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  canonicalGoogleMapsUrl,
  googleMapsDirectionsUrl,
  googleMapsEmbedSrc,
} from "@/synckerja-order/shared/lib/googleMapsLink";
import { buildOrderStorePath } from "@/synckerja-order/shared/lib/orderUrls";
import { expandGoogleMapsUrl } from "@/synckerja-order/shared/lib/resolveGoogleMapsLink";
import type { PublicOrderBranch } from "../lib/fetchPublicOrderLink";
import { copyShareText, locationSharePayload, shareOrCopy } from "../lib/shareLocation";
import { ORDER_STOREFRONT_PX } from "../lib/orderStorefrontGutter";

/** Same directions mark Google Maps uses on its route button. */
function callHref(raw: string | null | undefined): string | null {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  if (digits.length < 8) return null;
  return `tel:+${digits}`;
}

function GoogleRouteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="currentColor"
        d="M21.71 11.29l-9-9a.996.996 0 0 0-1.41 0l-9 9a.996.996 0 0 0 0 1.41l9 9c.39.39 1.02.39 1.41 0l9-9a.996.996 0 0 0 0-1.41zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z"
      />
    </svg>
  );
}

type Props = {
  locationName: string;
  address?: string | null;
  mapsUrl: string | null;
  phone?: string | null;
  branches?: PublicOrderBranch[];
  onBack: () => void;
};

/** Advertising link: map and place name. Guest profile tabs stay on the QR page. */
export function OrderLinkLocationScreen({
  locationName,
  address,
  mapsUrl,
  phone,
  branches = [],
  onBack,
}: Props) {
  const placeAddress = address?.trim() || "";
  const { t } = useAppTranslation();
  const openUrl = mapsUrl?.trim() || null;
  const directCanonical = openUrl ? canonicalGoogleMapsUrl(openUrl) : null;
  const directEmbed = openUrl ? googleMapsEmbedSrc(openUrl) : null;
  const [expandedCanonical, setExpandedCanonical] = useState<string | null>(null);
  const [expanding, setExpanding] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "copied" | "manual">("idle");
  const [manualUrl, setManualUrl] = useState("");
  const manualRef = useRef<HTMLInputElement>(null);
  const embedSrc = directEmbed || (expandedCanonical ? googleMapsEmbedSrc(expandedCanonical) : null);
  const directionsUrl = googleMapsDirectionsUrl(directCanonical || expandedCanonical || "");
  const phoneUrl = callHref(phone);
  const shareMapsUrl = directCanonical || expandedCanonical || openUrl;

  const onShare = async () => {
    const pageUrl = window.location.href;
    const payload = locationSharePayload({
      name: locationName,
      address: placeAddress,
      mapsUrl: shareMapsUrl,
      pageUrl,
    });
    const result = await shareOrCopy(payload, {
      share: navigator.share?.bind(navigator),
      canShare: navigator.canShare?.bind(navigator),
      copy: copyShareText,
    });
    if (result === "shared" || result === "aborted") {
      setShareState("idle");
      setManualUrl("");
      return;
    }
    if (result === "copied") {
      setManualUrl("");
      setShareState("copied");
      window.setTimeout(() => setShareState("idle"), 1600);
      return;
    }
    if (result === "failed" && payload.url) {
      setManualUrl(payload.url);
      setShareState("manual");
    }
  };

  useEffect(() => {
    if (shareState === "manual") manualRef.current?.select();
  }, [shareState]);

  useEffect(() => {
    if (!openUrl || directCanonical) {
      setExpandedCanonical(null);
      setExpanding(false);
      return;
    }
    let cancelled = false;
    setExpanding(true);
    setExpandedCanonical(null);
    void expandGoogleMapsUrl(openUrl).then((canonical) => {
      if (cancelled) return;
      setExpandedCanonical(canonical);
      setExpanding(false);
    });
    return () => {
      cancelled = true;
    };
  }, [openUrl, directCanonical]);

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
              className="aspect-square w-full shrink-0 rounded-xl border-0 bg-white"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div
              className="flex aspect-square w-full shrink-0 items-center justify-center rounded-xl bg-white px-6 text-center text-sm text-neutral-500"
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
          <div className="mt-3 flex w-full shrink-0 gap-1.5">
            {directionsUrl ? (
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-full bg-primary px-2 text-[12px] font-semibold text-primary-foreground"
              >
                <GoogleRouteIcon />
                {t("synckerjaOrder.store.startRoute", "Mulai")}
              </a>
            ) : null}
            {phoneUrl ? (
              <a
                href={phoneUrl}
                className="flex h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-full border border-primary bg-white px-2 text-[12px] font-semibold text-primary"
              >
                <Phone className="h-4 w-4" strokeWidth={2} />
                {t("synckerjaOrder.store.call", "Telepon")}
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => void onShare()}
              className="flex h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-full border border-primary bg-white px-2 text-[12px] font-semibold text-primary"
            >
              <Share2 className="h-4 w-4" strokeWidth={2} />
              {shareState === "copied"
                ? t("synckerjaOrder.store.shareCopied", "Tersalin")
                : t("synckerjaOrder.store.share", "Bagikan")}
            </button>
          </div>
          {shareState === "manual" && manualUrl ? (
            <input
              ref={manualRef}
              readOnly
              value={manualUrl}
              aria-label={t("synckerjaOrder.store.share", "Bagikan")}
              className="mt-2 h-9 w-full shrink-0 rounded-lg border border-neutral-200 bg-white px-3 text-[12px] text-neutral-700"
              onFocus={(event) => event.currentTarget.select()}
            />
          ) : null}
          {branches.length > 0 ? (
            <div className="mt-4 shrink-0">
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
        </div>
        <div
          className="h-2 shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
          aria-hidden
        />
      </div>
    </div>
  );
}
