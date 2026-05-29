import { gaqlSearch } from "./googleAdsGaql.ts";
import type { GoogleAdsConfig } from "../google-ads-upload-offline-conversion/googleAdsHelpers.ts";
import {
  adCreativeToPreviewLine,
  extractAdCreative,
} from "./googleAdsAdCreative.ts";
import type { NormalizedMetricsRow } from "./googleAdsMetricsCatalog.ts";

function buildAdPreviewQuery(adIds: string[]): string | null {
  const ids = adIds.map((id) => id.replace(/\D/g, "")).filter(Boolean);
  if (ids.length === 0) return null;
  const inList = ids.join(", ");
  return [
    "SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.final_urls,",
    "ad_group_ad.ad.responsive_search_ad.headlines,",
    "ad_group_ad.ad.responsive_search_ad.descriptions,",
    "ad_group_ad.ad.expanded_text_ad.headline_part1,",
    "ad_group_ad.ad.expanded_text_ad.headline_part2,",
    "ad_group_ad.ad.expanded_text_ad.headline_part3,",
    "ad_group_ad.ad.expanded_text_ad.description,",
    "ad_group_ad.ad.expanded_text_ad.description2",
    "FROM ad_group_ad",
    `WHERE ad_group_ad.ad.id IN (${inList})`,
  ].join("\n");
}

/** Enrich ad entity rows with structured creative (separate GAQL, no date segment). */
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
    const creativeById = new Map<string, ReturnType<typeof extractAdCreative>>();
    for (const raw of results) {
      const adGroupAd = raw.adGroupAd as Record<string, unknown> | undefined;
      const ad = adGroupAd?.ad as Record<string, unknown> | undefined;
      const id = ad?.id != null ? String(ad.id) : "";
      if (!id) continue;
      creativeById.set(id, extractAdCreative(ad));
    }

    for (const row of rows) {
      const creative = creativeById.get(row.id);
      if (creative) {
        row.identity.ad_creative = creative;
        row.identity.ad_preview = adCreativeToPreviewLine(creative) ||
          (row.id ? `Ad ${row.id}` : "");
      } else if (!row.identity.ad_preview) {
        row.identity.ad_preview = row.id ? `Ad ${row.id}` : "";
      }
    }
  } catch (e) {
    console.warn(
      "google-ads-metrics ad preview enrichment failed:",
      e instanceof Error ? e.message : String(e),
    );
  }
}
