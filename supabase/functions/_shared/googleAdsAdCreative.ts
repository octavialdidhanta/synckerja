export type GoogleAdsAdCreative = {
  headlines: string[];
  descriptions: string[];
  display_url: string;
};

function readText(item: unknown): string {
  if (item == null) return "";
  if (typeof item === "string") return item.trim();
  const rec = item as Record<string, unknown>;
  const text = rec.text ?? (rec.asset as Record<string, unknown> | undefined)?.text;
  return text != null ? String(text).trim() : "";
}

function uniqueNonEmpty(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of items) {
    const t = s.trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}

export function formatDisplayUrlFromFinalUrls(finalUrls: unknown): string {
  const list = Array.isArray(finalUrls)
    ? finalUrls.map((u) => String(u).trim()).filter(Boolean)
    : [];
  if (list.length === 0) return "";
  const raw = list[0]!;
  try {
    const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const host = new URL(href).hostname;
    return host.startsWith("www.") ? host : `www.${host}`;
  } catch {
    return raw.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  }
}

/** Build structured RSA / ETA creative for Google Ads–style ad preview. */
export function extractAdCreative(ad: Record<string, unknown> | undefined): GoogleAdsAdCreative {
  if (!ad) {
    return { headlines: [], descriptions: [], display_url: "" };
  }

  const headlines: string[] = [];
  const descriptions: string[] = [];

  const rsa = (ad.responsiveSearchAd ?? ad.responsive_search_ad) as
    | Record<string, unknown>
    | undefined;
  if (rsa) {
    if (Array.isArray(rsa.headlines)) {
      for (const h of rsa.headlines) headlines.push(readText(h));
    }
    if (Array.isArray(rsa.descriptions)) {
      for (const d of rsa.descriptions) descriptions.push(readText(d));
    }
  }

  const eta = (ad.expandedTextAd ?? ad.expanded_text_ad) as Record<string, unknown> | undefined;
  if (eta) {
    for (const key of [
      "headlinePart1",
      "headline_part1",
      "headlinePart2",
      "headline_part2",
      "headlinePart3",
      "headline_part3",
    ]) {
      const v = eta[key];
      if (v != null && String(v).trim()) headlines.push(String(v).trim());
    }
    for (const key of ["description", "description1", "description2", "description_1", "description_2"]) {
      const v = eta[key];
      if (v != null && String(v).trim()) descriptions.push(String(v).trim());
    }
  }

  const display_url = formatDisplayUrlFromFinalUrls(ad.finalUrls ?? ad.final_urls);
  const name = ad.name != null ? String(ad.name).trim() : "";

  const h = uniqueNonEmpty(headlines);
  const d = uniqueNonEmpty(descriptions);
  if (h.length === 0 && name) h.push(name);

  return {
    headlines: h,
    descriptions: d,
    display_url,
  };
}

/** Single-line fallback for legacy `ad_preview` string field. */
export function adCreativeToPreviewLine(creative: GoogleAdsAdCreative): string {
  if (creative.headlines.length > 0) {
    return creative.headlines.slice(0, 3).join(" | ");
  }
  return "";
}
