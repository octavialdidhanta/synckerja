const GOOGLE_HOST = /(^|\.)google\.[a-z.]+$/i;
const SHORT_HOSTS = new Set(["maps.app.goo.gl", "goo.gl"]);

/** Share links and full Google Maps URLs. Other https links are rejected. */
export function isGoogleMapsUrl(raw: string): boolean {
  const url = parseHttpsUrl(raw);
  if (!url) return false;
  const host = url.hostname.toLowerCase();
  return SHORT_HOSTS.has(host) || host === "maps.google.com" || GOOGLE_HOST.test(host);
}

/** maps.app.goo.gl and goo.gl need a redirect lookup before they can be embedded. */
export function isGoogleMapsShortLink(raw: string): boolean {
  const url = parseHttpsUrl(raw);
  return url != null && SHORT_HOSTS.has(url.hostname.toLowerCase());
}

/**
 * Build a Maps iframe URL from a pasted link.
 * Short links return null until they are expanded to a full Maps URL.
 */
export function googleMapsEmbedSrc(raw: string): string | null {
  const url = parseHttpsUrl(raw);
  if (!url || !isGoogleMapsUrl(raw) || isGoogleMapsShortLink(raw)) return null;
  if (url.pathname.includes("/maps/embed")) return url.toString();

  const pin = extractPin(url);
  if (pin) return embedQuery(`${pin.lat},${pin.lng}`);

  const query = url.searchParams.get("q") || url.searchParams.get("query") || url.searchParams.get("ll");
  if (query?.trim()) return embedQuery(query.trim());

  const name = placeName(url);
  if (name) return embedQuery(name);
  return null;
}

/**
 * Stable Maps URL stored after a share link is expanded.
 * The place pin (`!3d` / `!4d`) wins over the viewport center after `@`.
 */
export function canonicalGoogleMapsUrl(raw: string): string | null {
  const url = parseHttpsUrl(raw);
  if (!url || !isGoogleMapsUrl(raw) || isGoogleMapsShortLink(raw)) return null;
  const pin = extractPin(url);
  if (pin) {
    const name = placeName(url);
    if (name) {
      return `https://www.google.com/maps/place/${encodeURIComponent(name).replace(/%20/g, "+")}/@${pin.lat},${pin.lng},17z`;
    }
    return `https://www.google.com/maps?q=${encodeURIComponent(`${pin.lat},${pin.lng}`)}`;
  }
  return googleMapsEmbedSrc(raw) ? url.toString() : null;
}

function extractPin(url: URL): { lat: string; lng: string } | null {
  const placeCoords = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(url.toString());
  if (placeCoords) return { lat: placeCoords[1], lng: placeCoords[2] };
  const at = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(`${url.pathname}${url.search}`);
  if (at) return { lat: at[1], lng: at[2] };
  return null;
}

function placeName(url: URL): string {
  const place = /\/maps\/place\/([^/@]+)/.exec(url.pathname);
  if (!place?.[1]) return "";
  return decodeURIComponent(place[1]).replace(/\+/g, " ").trim();
}

function embedQuery(query: string): string {
  // maps.google.com?output=embed now redirects with X-Frame-Options and stays blank in an iframe.
  const safe = encodeURIComponent(query).replace(/%2C/gi, ",");
  return `https://www.google.com/maps/embed?origin=mfe&pb=!1m3!2m1!1s${safe}!6i16`;
}

function parseHttpsUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}
