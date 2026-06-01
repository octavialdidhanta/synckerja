// Lead Types

export interface NewLead {
  id: string;
  client: string;
  title: string;
  services: string | null;
  category: string;
  assignee: string;
  assignee_id?: string | null;
  fu_priority: string | null;
  status_id: string;
  source: string | null;
  followup: number | null;
  /** True while awaiting customer reply after template follow-up send. */
  template_followup_awaiting_reply?: boolean;
  /** Manual follow-up updates before this time are excluded from count/priority. */
  follow_up_cycle_reset_at?: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_name: string;
  organization_id: string;
  ticket_id: string | null;
  /** Raw JSON from `leads.attribution` (optional on virtual rows). */
  attribution?: Record<string, unknown> | null;
  /** From `leads.attribution_label`. */
  attribution_label?: string | null;
  /** From `leads.gclid`. */
  gclid?: string | null;
  /** From `leads.fbclid`. */
  fbclid?: string | null;
  /** Optional override for per-brand Google Ads upload (`organization_google_ads_accounts.id`). */
  google_ads_account_id?: string | null;
  /** Optional override for per-brand Meta Ads upload (`organization_meta_ads_accounts.id`). */
  meta_ads_account_id?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  landing_url?: string | null;
  lead_status?: {
    id: string;
    name: string;
    color: string | null;
  };
  /** WhatsApp / Instagram virtual rows: Meta session expiry from `*_conversations.meta_session_expires_at`. */
  meta_session_expires_at?: string | null;
  /** Virtual omnichannel rows: `whatsapp` | `instagram` when merged from conversations. */
  channel?: string | null;
}

export interface CreateLeadData {
  client: string;
  title: string;
  services?: string;
  category?: string;
  assignee: string;
  fu_priority?: string;
  status_id: string;
  source?: string;
}

export interface LeadFollowUpUpdate {
  leadId: string;
  followup: number;
  fu_priority?: string;
  notes?: string;
}









