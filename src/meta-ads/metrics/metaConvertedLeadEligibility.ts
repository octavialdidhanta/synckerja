import { mergeLeadClickIds, parseAttributionFields } from "@/shared/lib/leadAttribution";

export function normalizeCampaignMatchKey(value: string): string {
  return value.trim().toLowerCase();
}

/** Mirrors edge `isMetaChannelConvertedLead` for leads UI / reports. */
export function isMetaChannelConvertedLead(lead: {
  fbclid?: string | null;
  gclid?: string | null;
  attribution?: unknown;
}): boolean {
  const { fbclid, gclid } = mergeLeadClickIds(
    { fbclid: lead.fbclid ?? null, gclid: lead.gclid ?? null },
    lead.attribution,
  );
  if (!fbclid) return false;
  if (gclid) return false;
  return true;
}

export function utmCampaignKeyFromLead(lead: {
  utm_campaign?: string | null;
  attribution?: unknown;
}): string {
  const fromFlat = lead.utm_campaign?.trim();
  if (fromFlat) return normalizeCampaignMatchKey(fromFlat);
  const parsed = parseAttributionFields(lead.attribution);
  return parsed.utm_campaign ? normalizeCampaignMatchKey(parsed.utm_campaign) : "";
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

/** Whether a converted lead counts toward Meta CPA for a campaign in the given period. */
export function leadCountsForMetaCampaignCpa(
  lead: {
    fbclid?: string | null;
    gclid?: string | null;
    attribution?: unknown;
    utm_campaign?: string | null;
    converted_at?: string | null;
    lead_status?: { name?: string | null } | null;
  },
  args: {
    campaignId: string;
    campaignName: string;
    dateStart: string;
    dateEnd: string;
  },
): boolean {
  const status = lead.lead_status?.name?.trim().toLowerCase() ?? "";
  if (status !== "converted") return false;
  if (!isMetaChannelConvertedLead(lead)) return false;

  const convertedAt = lead.converted_at;
  if (!convertedAt) return false;
  const convertedMs = new Date(convertedAt).getTime();
  if (Number.isNaN(convertedMs)) return false;

  const startMs = new Date(`${args.dateStart}T00:00:00.000Z`).getTime();
  const endMs = new Date(`${args.dateEnd}T23:59:59.999Z`).getTime();
  if (convertedMs < startMs || convertedMs > endMs) return false;

  const utmKey = utmCampaignKeyFromLead(lead);
  return utmMatchesMetaCampaign(utmKey, args.campaignId, args.campaignName);
}
