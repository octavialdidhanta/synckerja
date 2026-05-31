import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

export type OpenGoogleMapsOptions = {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  label?: string | null;
};

function normalizeMapsAddress(address: string): string {
  const trimmed = address.trim();
  if (/indonesia/i.test(trimmed)) return trimmed;
  if (/jakarta/i.test(trimmed)) return `${trimmed}, Indonesia`;
  return `${trimmed}, Jakarta, Indonesia`;
}

/** Prefer human-readable address so Maps matches UI text; fall back to coordinates. */
export function resolveGoogleMapsDestination(options: OpenGoogleMapsOptions): string | null {
  const address = options.address?.trim();
  if (address) {
    return normalizeMapsAddress(address);
  }

  const lat = options.latitude != null ? Number(options.latitude) : null;
  const lng = options.longitude != null ? Number(options.longitude) : null;
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return `${lat},${lng}`;
  }

  return null;
}

export function buildGoogleMapsDirectionsUrl(options: OpenGoogleMapsOptions): string | null {
  const destination = resolveGoogleMapsDestination(options);
  if (!destination) return null;

  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", destination);
  url.searchParams.set("travelmode", "driving");
  return url.toString();
}

export async function openGoogleMapsDirections(options: OpenGoogleMapsOptions): Promise<boolean> {
  const destination = resolveGoogleMapsDestination(options);
  if (!destination) return false;

  const webUrl = buildGoogleMapsDirectionsUrl(options);
  if (!webUrl) return false;

  const encodedDestination = encodeURIComponent(destination);

  if (Capacitor.isNativePlatform()) {
    const platform = Capacitor.getPlatform();

    if (platform === "android") {
      window.location.href = `google.navigation:q=${encodedDestination}`;
      return true;
    }

    if (platform === "ios") {
      window.location.href = `comgooglemaps://?daddr=${encodedDestination}&directionsmode=driving`;
      window.setTimeout(() => {
        void Browser.open({ url: webUrl });
      }, 500);
      return true;
    }

    await Browser.open({ url: webUrl });
    return true;
  }

  window.open(webUrl, "_blank", "noopener,noreferrer");
  return true;
}
