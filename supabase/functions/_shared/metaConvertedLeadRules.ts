import {
  mergeFbclid,
  parseFbclidFromAttribution,
} from "./metaAdsCapiHelpers.ts";

export type MetaConvertedLeadRow = {
  id: string;
  fbclid: string | null;
  gclid: string | null;
  attribution: unknown;
  converted_at: string | null;
};

export function normalizeCampaignMatchKey(value: string): string {
  return value.trim().toLowerCase();
}

function parseGclidFromAttribution(attribution: unknown): string | null {
  if (attribution == null) return null;
  let obj: Record<string, unknown>;
  if (typeof attribution === "string") {
    try {
      obj = JSON.parse(attribution) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (typeof attribution === "object" && !Array.isArray(attribution)) {
    obj = attribution as Record<string, unknown>;
  } else {
    return null;
  }
  const gclid = obj.gclid ?? obj.GCLID;
  return gclid != null ? String(gclid).trim() || null : null;
}

function effectiveGclid(column: string | null, attribution: unknown): string | null {
  const fromCol = column?.trim() || null;
  if (fromCol) return fromCol;
  return parseGclidFromAttribution(attribution);
}

/** Same rules as Meta CAPI / leads: Meta channel only (fbclid, not Google gclid). */
export function isMetaChannelConvertedLead(lead: {
  fbclid: string | null;
  gclid: string | null;
  attribution: unknown;
}): boolean {
  const fbclid = mergeFbclid(
    lead.fbclid != null ? String(lead.fbclid) : null,
    lead.attribution,
  );
  if (!fbclid) return false;
  const gclid = effectiveGclid(
    lead.gclid != null ? String(lead.gclid) : null,
    lead.attribution,
  );
  if (gclid) return false;
  return true;
}

export function utmCampaignKeyFromAttribution(attribution: unknown): string {
  if (attribution == null || typeof attribution !== "object" || Array.isArray(attribution)) {
    return "";
  }
  const utmRaw = String((attribution as Record<string, unknown>).utm_campaign ?? "");
  return normalizeCampaignMatchKey(utmRaw);
}

export function utmMatchesMetaCampaign(
  utmKey: string,
  campaignId: string,
  campaignName: string,
): boolean {
  if (!utmKey) return false;
  const idKey = normalizeCampaignMatchKey(campaignId);
  const nameKey = normalizeCampaignMatchKey(campaignName);
  if (idKey && utmKey === idKey) return true;
  if (nameKey && utmKey === nameKey) return true;
  return false;
}

export type ParsedMetaConvertedLead = {
  id: string;
  utmKey: string;
};

/** Parse DB rows into eligible leads with UTM keys (dedupe-ready). */
export function parseEligibleMetaConvertedLeads(
  rows: MetaConvertedLeadRow[],
): ParsedMetaConvertedLead[] {
  const out: ParsedMetaConvertedLead[] = [];
  for (const row of rows) {
    if (!isMetaChannelConvertedLead(row)) continue;
    const utmKey = utmCampaignKeyFromAttribution(row.attribution);
    if (!utmKey) continue;
    out.push({ id: String(row.id), utmKey });
  }
  return out;
}

/** Distinct leads matching a Meta campaign row (id or name). */
export function countMetaConvertedLeadsForCampaign(
  leads: ParsedMetaConvertedLead[],
  campaignId: string,
  campaignName: string,
): number {
  const seen = new Set<string>();
  let count = 0;
  for (const lead of leads) {
    if (!utmMatchesMetaCampaign(lead.utmKey, campaignId, campaignName)) continue;
    if (seen.has(lead.id)) continue;
    seen.add(lead.id);
    count++;
  }
  return count;
}
