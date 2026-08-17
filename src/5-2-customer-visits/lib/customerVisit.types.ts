export type CustomerVisitLookupKind = 'phone' | 'instagram';
export type CustomerVisitMatchStatus = 'matched' | 'unmatched';
export type CustomerVisitStatus = 'completed' | 'cancelled';

export type CustomerVisitLeadCampaignPostEmbed = {
  media_id: string;
  platform?: string | null;
  media_caption?: string | null;
  media_permalink?: string | null;
};

export type CustomerVisitLeadCampaignEmbed = {
  name?: string | null;
  lead_magnet_campaign_posts?: CustomerVisitLeadCampaignPostEmbed[] | null;
};

export type CustomerVisitLeadEnrollmentEmbed = {
  created_at?: string | null;
  media_id?: string | null;
  platform?: string | null;
  lead_magnet_campaigns?: CustomerVisitLeadCampaignEmbed | CustomerVisitLeadCampaignEmbed[] | null;
};

export type CustomerVisitLeadEmbed = {
  id: string;
  client: string;
  ticket_id: string;
  source: string | null;
  phone_number: string | null;
  attribution?: Record<string, unknown> | null;
  attribution_label?: string | null;
  lead_magnet_enrollments?: CustomerVisitLeadEnrollmentEmbed[] | null;
};

export type CustomerVisitSaleEmbed = {
  id: string;
  total_amount: number | null;
  payment_method: string | null;
  payment_reference?: string | null;
  cash_tendered?: number | null;
  table_number?: string | null;
  date?: string | null;
  created_at?: string | null;
};

export type CustomerVisitRow = {
  id: string;
  organization_id: string;
  visit_date: string;
  status: CustomerVisitStatus;
  lead_id: string | null;
  lookup_kind: CustomerVisitLookupKind;
  lookup_raw: string;
  lookup_normalized: string;
  match_status: CustomerVisitMatchStatus;
  notes: string | null;
  table_number?: string | null;
  sales_activity_id: string | null;
  created_at: string;
  leads?: CustomerVisitLeadEmbed | CustomerVisitLeadEmbed[] | null;
  sales_activities?: CustomerVisitSaleEmbed | CustomerVisitSaleEmbed[] | null;
  store_tickets?: CustomerVisitSaleEmbed[] | null;
};

export function customerVisitLead(row: CustomerVisitRow): CustomerVisitLeadEmbed | null {
  const embed = row.leads;
  if (!embed) return null;
  return Array.isArray(embed) ? embed[0] ?? null : embed;
}
