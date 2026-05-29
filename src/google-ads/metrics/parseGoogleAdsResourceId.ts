/**
 * Parse a Google Ads resource id from API or composite UI row keys (`{customerId}-{resourceId}`).
 * Avoids `replace(/\D/g)` on composite keys, which merges customer + resource ids into one invalid number.
 */
export function parseGoogleAdsResourceId(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";

  const lastDash = s.lastIndexOf("-");
  if (lastDash > 0 && lastDash < s.length - 1) {
    const tail = s.slice(lastDash + 1).replace(/\D/g, "");
    if (tail.length >= 8 && tail.length <= 20) return tail;
  }

  const digits = s.replace(/\D/g, "");
  if (digits.length >= 8 && digits.length <= 20) return digits;
  return "";
}

/** `{customerId}-{resourceId}` — same shape as campaign/ad group filter dropdown options. */
export function compositeGoogleAdsResourceId(
  customerId: string,
  resourceId: string,
): string {
  const customer = customerId.replace(/\D/g, "");
  const resource = resourceId.replace(/\D/g, "");
  if (customer.length === 10 && resource.length >= 8) {
    return `${customer}-${resource}`;
  }
  return resource || customer;
}

/** Map a metrics table campaign row to the campaign filter picker value. */
export function resolveCampaignFilterIdFromRow(
  row: { id?: string | null; identity?: { campaign_id?: unknown } },
  customerId: string,
): string | null {
  const rawId = String(row.id ?? "").trim();
  if (/^\d{10}-\d+$/.test(rawId)) return rawId;

  const resourceId = parseGoogleAdsResourceId(
    String(row.identity?.campaign_id ?? rawId),
  );
  if (!resourceId) return null;

  return compositeGoogleAdsResourceId(customerId, resourceId) || null;
}
