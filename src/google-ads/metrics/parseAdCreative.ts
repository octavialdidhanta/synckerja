export type GoogleAdsAdCreative = {
  headlines: string[];
  descriptions: string[];
  display_url: string;
};

export function parseAdCreativeFromIdentity(
  identity: Record<string, unknown>,
): GoogleAdsAdCreative {
  const raw = identity.ad_creative;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const c = raw as Record<string, unknown>;
    return {
      headlines: Array.isArray(c.headlines)
        ? c.headlines.map((h) => String(h).trim()).filter(Boolean)
        : [],
      descriptions: Array.isArray(c.descriptions)
        ? c.descriptions.map((d) => String(d).trim()).filter(Boolean)
        : [],
      display_url: c.display_url != null ? String(c.display_url).trim() : "",
    };
  }

  const preview = String(identity.ad_preview ?? "").trim();
  if (!preview) {
    return { headlines: [], descriptions: [], display_url: "" };
  }

  const headlines = preview
    .split(/\s*[|·]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  return { headlines, descriptions: [], display_url: "" };
}

export function truncateDescription(text: string, maxLen = 88): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1).trim()}…`;
}
