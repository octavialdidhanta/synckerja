import { gaqlSearch } from "./googleAdsGaql.ts";
import type { GoogleAdsConfig } from "../google-ads-upload-offline-conversion/googleAdsHelpers.ts";
import type { NormalizedMetricsRow } from "./googleAdsMetricsCatalog.ts";

function extractAdPreview(ad: Record<string, unknown> | undefined): string {
  if (!ad) return "";

  const rsa = (ad.responsiveSearchAd ?? ad.responsive_search_ad) as
    | Record<string, unknown>
    | undefined;
  const headlines = rsa?.headlines;
  if (Array.isArray(headlines) && headlines.length > 0) {
    const texts = headlines
      .map((h) => {
        const item = h as Record<string, unknown>;
        const text = item.text ?? (item.asset as Record<string, unknown> | undefined)?.text;
        return text != null ? String(text).trim() : "";
      })
      .filter(Boolean);
    if (texts.length > 0) return texts.slice(0, 3).join(" · ");
  }

  const eta = (ad.expandedTextAd ?? ad.expanded_text_ad) as Record<string, unknown> | undefined;
  if (eta) {
    const parts = [
      eta.headlinePart1,
      eta.headline_part1,
      eta.headlinePart2,
      eta.headline_part2,
      eta.headlinePart3,
      eta.headline_part3,
    ]
      .map((p) => (p != null ? String(p).trim() : ""))
      .filter(Boolean);
    if (parts.length > 0) return parts.join(" | ");
  }

  const name = ad.name;
  if (name != null && String(name).trim()) return String(name).trim();
  return "";
}

function buildAdPreviewQuery(adIds: string[]): string | null {
  const ids = adIds.map((id) => id.replace(/\D/g, "")).filter(Boolean);
  if (ids.length === 0) return null;
  const inList = ids.join(", ");
  return [
    "SELECT ad_group_ad.ad.id, ad_group_ad.ad.name,",
    "ad_group_ad.ad.responsive_search_ad.headlines,",
    "ad_group_ad.ad.expanded_text_ad.headline_part1,",
    "ad_group_ad.ad.expanded_text_ad.headline_part2,",
    "ad_group_ad.ad.expanded_text_ad.headline_part3",
    "FROM ad_group_ad",
    `WHERE ad_group_ad.ad.id IN (${inList})`,
  ].join("\n");
}

/** Enrich ad entity rows with creative preview (separate GAQL, no date segment). */
export async function enrichAdRowsWithPreviews(
  config: GoogleAdsConfig,
  accessToken: string,
  customerId: string,
  rows: NormalizedMetricsRow[],
): Promise<void> {
  const adIds = rows.map((r) => r.id).filter(Boolean);
  const query = buildAdPreviewQuery(adIds);
  if (!query) return;

  try {
    const results = await gaqlSearch<Record<string, unknown>>(
      config,
      accessToken,
      customerId,
      query,
    );
    const previewById = new Map<string, string>();
    for (const raw of results) {
      const adGroupAd = raw.adGroupAd as Record<string, unknown> | undefined;
      const ad = adGroupAd?.ad as Record<string, unknown> | undefined;
      const id = ad?.id != null ? String(ad.id) : "";
      if (!id) continue;
      const preview = extractAdPreview(ad);
      if (preview) previewById.set(id, preview);
    }

    for (const row of rows) {
      const preview = previewById.get(row.id);
      if (preview) {
        row.identity.ad_preview = preview;
      } else if (!row.identity.ad_preview) {
        row.identity.ad_preview = row.identity.ad_preview ??
          (row.id ? `Ad ${row.id}` : "");
      }
    }
  } catch (e) {
    console.warn(
      "google-ads-metrics ad preview enrichment failed:",
      e instanceof Error ? e.message : String(e),
    );
  }
}
