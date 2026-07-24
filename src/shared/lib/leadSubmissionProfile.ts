import { supabase } from '@/shared/lib/supabaseClient';

/** Columns used by Client Profile modal and completeness checks. */
export const LEAD_SUBMISSION_PROFILE_SELECT =
  'id, lead_id, organization_id, name, phone_number, email, code, gender, age, occupation, location, industry, notes, form_data, status, submitted_at, updated_at, is_active, lead_magnet_campaign_id, lead_magnet_campaign_name, lead_magnet_target_market';

export type LeadSubmissionProfileRow = {
  id: string;
  lead_id: string | null;
  organization_id: string;
  name: string | null;
  phone_number: string | null;
  email: string | null;
  code: string | null;
  gender: string | null;
  age: number | null;
  occupation: string | null;
  location: string | null;
  industry: string | null;
  notes: string | null;
  form_data: Record<string, unknown> | null;
  status: string;
  submitted_at: string | null;
  updated_at: string;
  is_active: boolean;
  lead_magnet_campaign_id: string | null;
  lead_magnet_campaign_name: string | null;
  lead_magnet_target_market: string | null;
};

export type ClientProfileCompleteness = 'full' | 'partial' | 'empty';

function rowSortKey(r: LeadSubmissionProfileRow): string {
  const submitted = r.submitted_at ?? '';
  const updated = r.updated_at ?? '';
  return `${submitted}\0${updated}`;
}

function isActiveRow(r: LeadSubmissionProfileRow): boolean {
  return r.is_active !== false;
}

/** Prefer submitted, then draft (WhatsApp floating). */
export function pickLeadSubmissionForProfile(
  rows: LeadSubmissionProfileRow[],
  leadId: string,
): LeadSubmissionProfileRow | null {
  const forLead = rows.filter((r) => r.lead_id === leadId && isActiveRow(r));
  if (forLead.length === 0) return null;

  const submitted = forLead
    .filter((r) => r.status === 'submitted')
    .sort((a, b) => rowSortKey(b).localeCompare(rowSortKey(a)));
  if (submitted.length > 0) return submitted[0]!;

  const draft = forLead
    .filter((r) => r.status === 'draft')
    .sort((a, b) => rowSortKey(b).localeCompare(rowSortKey(a)));
  return draft[0] ?? null;
}

/** Channel / floating-stub labels that must not replace a real CRM contact name. */
const PLACEHOLDER_CLIENT_NAMES = new Set(
  [
    'whatsapp floating click',
    'website visitor',
    'whatsapp button',
    'whatsapp',
    'instagram contact',
    'instagram',
    'messenger contact',
    'messenger',
    'facebook contact',
    'facebook',
    'lead',
    'floating wa click',
  ].map((s) => s.toLowerCase()),
);

export function isPlaceholderLeadClientName(name: string | null | undefined): boolean {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return true;
  return PLACEHOLDER_CLIENT_NAMES.has(trimmed.toLowerCase());
}

export type LeadContactDisplayFallback = {
  client?: string | null;
  phone_number?: string | null;
  email?: string | null;
};

/**
 * Merge submission + lead/channel fields for Client Profile display.
 * Floating WA stubs often keep placeholder name and null phone after ticket merge.
 */
export function resolveClientProfileContactFields(args: {
  submission?: Pick<LeadSubmissionProfileRow, 'name' | 'phone_number' | 'email'> | null;
  lead?: LeadContactDisplayFallback | null;
  clientNameProp?: string | null;
  initialPhoneNumber?: string | null;
}): { name: string; phone_number: string; email: string } {
  const subName = String(args.submission?.name ?? '').trim();
  const leadClient = String(args.lead?.client ?? '').trim();
  const propClient = String(args.clientNameProp ?? '').trim();

  const name =
    (!isPlaceholderLeadClientName(subName) ? subName : '') ||
    (!isPlaceholderLeadClientName(leadClient) ? leadClient : '') ||
    (!isPlaceholderLeadClientName(propClient) ? propClient : '') ||
    leadClient ||
    propClient ||
    subName ||
    '';

  const phone =
    String(args.submission?.phone_number ?? '').trim() ||
    String(args.lead?.phone_number ?? '').trim() ||
    String(args.initialPhoneNumber ?? '').trim() ||
    '';

  const email =
    String(args.submission?.email ?? '').trim() ||
    String(args.lead?.email ?? '').trim() ||
    '';

  return { name, phone_number: phone, email };
}

export function clientCompletenessFromSubmission(
  row: LeadSubmissionProfileRow | null | undefined,
  leadFallback?: LeadContactDisplayFallback | null,
): ClientProfileCompleteness {
  const resolved = resolveClientProfileContactFields({
    submission: row,
    lead: leadFallback,
  });

  const values = [
    resolved.name,
    row?.code != null ? String(row.code).trim() : '',
    row?.gender != null ? String(row.gender).trim() : '',
    row?.age != null ? String(row.age).trim() : '',
    row?.occupation != null ? String(row.occupation).trim() : '',
    row?.location != null ? String(row.location).trim() : '',
    resolved.phone_number,
    resolved.email,
  ];
  const filled = values.filter((v) => v !== '' && !isPlaceholderLeadClientName(v)).length;
  // name alone from channel (without other profile fields) still counts as partial
  if (filled === 0) return 'empty';
  if (filled === values.length) return 'full';
  return 'partial';
}

export type LeadSubmissionProfileUpdatePayload = {
  name: string;
  phone_number: string | null;
  email: string | null;
  code: string | null;
  gender: string | null;
  age: number | null;
  occupation: string | null;
  location: string | null;
};

export async function fetchLeadSubmissionForProfile(
  leadId: string,
  organizationId: string,
): Promise<LeadSubmissionProfileRow | null> {
  const { data, error } = await supabase
    .from('lead_submissions')
    .select(LEAD_SUBMISSION_PROFILE_SELECT)
    .eq('organization_id', organizationId)
    .eq('lead_id', leadId)
    .eq('is_active', true);

  if (error) {
    console.error('fetchLeadSubmissionForProfile:', error);
    throw error;
  }
  return pickLeadSubmissionForProfile((data ?? []) as LeadSubmissionProfileRow[], leadId);
}

export async function fetchLeadSubmissionsForLeads(
  leadIds: string[],
  organizationId: string,
): Promise<Map<string, LeadSubmissionProfileRow>> {
  const map = new Map<string, LeadSubmissionProfileRow>();
  if (leadIds.length === 0) return map;

  const uniqueIds = [...new Set(leadIds.filter((id) => id && !id.startsWith('wa-') && !id.startsWith('email-')))];
  if (uniqueIds.length === 0) return map;

  const chunkSize = 200;
  const allRows: LeadSubmissionProfileRow[] = [];

  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    const chunk = uniqueIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('lead_submissions')
      .select(LEAD_SUBMISSION_PROFILE_SELECT)
      .eq('organization_id', organizationId)
      .in('lead_id', chunk)
      .eq('is_active', true);

    if (error) {
      console.error('fetchLeadSubmissionsForLeads:', error);
      throw error;
    }
    allRows.push(...((data ?? []) as LeadSubmissionProfileRow[]));
  }

  for (const leadId of uniqueIds) {
    const picked = pickLeadSubmissionForProfile(allRows, leadId);
    if (picked) map.set(leadId, picked);
  }
  return map;
}

export async function updateLeadSubmissionProfile(
  submissionId: string,
  payload: LeadSubmissionProfileUpdatePayload,
): Promise<void> {
  const { error } = await supabase
    .from('lead_submissions')
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', submissionId);

  if (error) throw error;
}

/** Fallback display from `leads` when no submission row exists. */
/** One profile row per lead for recipient picker / phone resolution. */
export type RecipientLeadProfileLite = {
  lead_id: string;
  phone_number: string | null;
  updated_at: string | null;
};

export function buildRecipientProfileRowsFromSubmissions(
  allRows: LeadSubmissionProfileRow[],
  leadIds: Iterable<string>,
): RecipientLeadProfileLite[] {
  const out: RecipientLeadProfileLite[] = [];
  for (const leadId of leadIds) {
    const picked = pickLeadSubmissionForProfile(allRows, leadId);
    if (picked?.lead_id) {
      out.push({
        lead_id: picked.lead_id,
        phone_number: picked.phone_number,
        updated_at: picked.updated_at,
      });
    }
  }
  return out;
}

export async function fetchLeadSubmissionsForOrganization(
  organizationId: string,
): Promise<LeadSubmissionProfileRow[]> {
  const { data, error } = await supabase
    .from('lead_submissions')
    .select(LEAD_SUBMISSION_PROFILE_SELECT)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .not('lead_id', 'is', null);

  if (error) {
    console.error('fetchLeadSubmissionsForOrganization:', error);
    throw error;
  }
  return (data ?? []) as LeadSubmissionProfileRow[];
}

/** Postgres / client error marker when WA resolve blocked due to missing submission email. */
export const RESOLVE_EMAIL_REQUIRED_CODE = 'resolve_email_required';

export function isLeadSubmissionEmailPresent(email: string | null | undefined): boolean {
  return email != null && String(email).trim() !== '';
}

/** Minimal format check before saving email on Resolve. */
export function isValidResolveEmailFormat(email: string): boolean {
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  const at = trimmed.indexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return false;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  return local.length > 0 && domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.');
}

export function isResolveEmailRequiredError(err: unknown): boolean {
  if (err == null) return false;
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes(RESOLVE_EMAIL_REQUIRED_CODE)) return true;
  const code = (err as { code?: string })?.code;
  return code === RESOLVE_EMAIL_REQUIRED_CODE || code === 'P0001';
}

export async function getLeadSubmissionEmailForLead(
  leadId: string,
  organizationId: string,
): Promise<string | null> {
  const row = await fetchLeadSubmissionForProfile(leadId, organizationId);
  if (!row?.email || !isLeadSubmissionEmailPresent(row.email)) return null;
  return row.email.trim();
}

/** Throws `RESOLVE_EMAIL_REQUIRED_CODE` when lead_submissions.email is missing after save. */
export async function assertLeadSubmissionEmailSaved(
  leadId: string,
  organizationId: string,
): Promise<string> {
  const email = await getLeadSubmissionEmailForLead(leadId, organizationId);
  if (!email) {
    throw new Error(RESOLVE_EMAIL_REQUIRED_CODE);
  }
  return email;
}

/** Error marker when auto Lead Conversion cannot read phone/email from lead_submissions. */
export const SALES_ACTIVITY_CONTACT_REQUIRED_CODE = 'sales_activity_contact_required';

export function isLeadSubmissionPhonePresent(phone: string | null | undefined): boolean {
  return phone != null && String(phone).trim() !== '';
}

export type SalesActivityClientContact = {
  client_phone: string;
  client_email: string;
};

export async function getSalesActivityClientContactFromSubmission(
  leadId: string,
  organizationId: string,
): Promise<SalesActivityClientContact | null> {
  const row = await fetchLeadSubmissionForProfile(leadId, organizationId);
  if (!row) return null;
  if (!isLeadSubmissionPhonePresent(row.phone_number) || !isLeadSubmissionEmailPresent(row.email)) {
    return null;
  }
  return {
    client_phone: row.phone_number!.trim(),
    client_email: row.email!.trim(),
  };
}

/** Throws `SALES_ACTIVITY_CONTACT_REQUIRED_CODE` when phone or email missing on lead_submissions. */
export async function assertSalesActivityClientContactFromSubmission(
  leadId: string,
  organizationId: string,
): Promise<SalesActivityClientContact> {
  const contact = await getSalesActivityClientContactFromSubmission(leadId, organizationId);
  if (!contact) {
    throw new Error(SALES_ACTIVITY_CONTACT_REQUIRED_CODE);
  }
  return contact;
}

export type UpsertLeadSubmissionEmailDefaults = {
  name?: string | null;
  phone_number?: string | null;
};

/** Thrown when no web_id can be resolved for a new lead_submissions row. */
export const LEAD_SUBMISSION_WEB_ID_REQUIRED_CODE = 'lead_submission_web_id_required';

/** Thrown when no form_id can be resolved (typical for WA-only leads without website form pipeline). */
export const LEAD_SUBMISSION_FORM_ID_REQUIRED_CODE = 'form_id_required_for_submission';

function submissionConstraintMessage(err: unknown): string {
  if (err == null) return '';
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return err instanceof Error ? err.message : String(err);
}

export function isLeadSubmissionWebIdRequiredError(err: unknown): boolean {
  const msg = submissionConstraintMessage(err);
  if (msg.includes(LEAD_SUBMISSION_WEB_ID_REQUIRED_CODE)) return true;
  const code = (err as { code?: string })?.code;
  if (code === '23502' && msg.toLowerCase().includes('web_id')) return true;
  return false;
}

export function isLeadSubmissionFormIdRequiredError(err: unknown): boolean {
  const msg = submissionConstraintMessage(err);
  if (msg.includes(LEAD_SUBMISSION_FORM_ID_REQUIRED_CODE)) return true;
  const code = (err as { code?: string })?.code;
  if (code === '23502' && msg.toLowerCase().includes('form_id')) return true;
  return false;
}

export function isLeadSubmissionProfileSaveError(err: unknown): boolean {
  return (
    isLeadSubmissionWebIdRequiredError(err) ||
    isLeadSubmissionFormIdRequiredError(err) ||
    (err instanceof Error && err.message === 'invalid_resolve_email') ||
    isResolveEmailRequiredError(err)
  );
}

/** Resolve web_id for omnichannel draft submissions (NOT NULL on lead_submissions). */
export async function resolveWebIdForLeadSubmission(
  organizationId: string,
  leadId: string,
): Promise<string> {
  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .select('web_id')
    .eq('id', leadId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (!leadErr && lead?.web_id && String(lead.web_id).trim()) {
    return String(lead.web_id).trim();
  }
  if (leadErr && leadErr.code !== '42703' && leadErr.code !== 'PGRST204') {
    console.error('resolveWebIdForLeadSubmission: leads.web_id', leadErr);
  }

  const { data: accessRows, error: accessErr } = await supabase
    .from('analytics_web_access')
    .select('web_id, is_approved')
    .eq('organization_id', organizationId)
    .order('is_approved', { ascending: false })
    .order('web_id', { ascending: true });

  if (!accessErr && accessRows?.length) {
    const approved = accessRows.find((r) => r.is_approved !== false);
    const webId = (approved ?? accessRows[0])?.web_id;
    if (webId && String(webId).trim()) return String(webId).trim();
  }

  const { data: rpcRows, error: rpcErr } = await supabase.rpc('list_accessible_web_ids');
  if (!rpcErr && Array.isArray(rpcRows) && rpcRows.length > 0) {
    const first = rpcRows[0] as { web_id?: string } | string;
    const webId = typeof first === 'string' ? first : first?.web_id;
    if (webId && String(webId).trim()) return String(webId).trim();
  }

  const { data: sibling, error: siblingErr } = await supabase
    .from('lead_submissions')
    .select('web_id')
    .eq('organization_id', organizationId)
    .not('web_id', 'is', null)
    .limit(1)
    .maybeSingle();

  if (!siblingErr && sibling?.web_id && String(sibling.web_id).trim()) {
    return String(sibling.web_id).trim();
  }

  throw new Error(LEAD_SUBMISSION_WEB_ID_REQUIRED_CODE);
}

/** Resolve form_id for omnichannel draft submissions; returns null when org has no website-form-backed rows. */
export async function resolveFormIdForLeadSubmission(
  organizationId: string,
  leadId: string,
  webId: string,
): Promise<string | null> {
  const { data: rpcFormId, error: rpcErr } = await supabase.rpc(
    'resolve_form_id_for_omnichannel_submission',
    {
      p_organization_id: organizationId,
      p_web_id: webId,
    },
  );
  if (!rpcErr && rpcFormId != null && String(rpcFormId).trim()) {
    return String(rpcFormId).trim();
  }
  if (rpcErr && rpcErr.code !== 'PGRST202' && rpcErr.code !== '42883') {
    console.warn('resolveFormIdForLeadSubmission: rpc', rpcErr.message);
  }

  const { data: forLead, error: forLeadErr } = await supabase
    .from('lead_submissions')
    .select('form_id')
    .eq('organization_id', organizationId)
    .eq('lead_id', leadId)
    .not('form_id', 'is', null)
    .limit(1)
    .maybeSingle();

  if (!forLeadErr && forLead?.form_id && String(forLead.form_id).trim()) {
    return String(forLead.form_id).trim();
  }

  const { data: sameWeb, error: sameWebErr } = await supabase
    .from('lead_submissions')
    .select('form_id')
    .eq('organization_id', organizationId)
    .eq('web_id', webId)
    .not('form_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sameWebErr && sameWeb?.form_id && String(sameWeb.form_id).trim()) {
    return String(sameWeb.form_id).trim();
  }

  const { data: anyOrg, error: anyOrgErr } = await supabase
    .from('lead_submissions')
    .select('form_id')
    .eq('organization_id', organizationId)
    .not('form_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!anyOrgErr && anyOrg?.form_id && String(anyOrg.form_id).trim()) {
    return String(anyOrg.form_id).trim();
  }

  return null;
}

export async function upsertLeadSubmissionEmailForResolve(args: {
  leadId: string;
  organizationId: string;
  email: string;
  defaults?: UpsertLeadSubmissionEmailDefaults;
}): Promise<void> {
  const trimmedEmail = args.email.trim();
  if (!isValidResolveEmailFormat(trimmedEmail)) {
    throw new Error('invalid_resolve_email');
  }

  const existing = await fetchLeadSubmissionForProfile(args.leadId, args.organizationId);
  const now = new Date().toISOString();

  if (existing?.id) {
    const { error } = await supabase
      .from('lead_submissions')
      .update({
        email: trimmedEmail,
        updated_at: now,
        ...(args.defaults?.name?.trim() && !existing.name?.trim()
          ? { name: args.defaults.name.trim() }
          : {}),
        ...(args.defaults?.phone_number?.trim() && !existing.phone_number?.trim()
          ? { phone_number: args.defaults.phone_number.trim() }
          : {}),
      })
      .eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const displayName =
    args.defaults?.name?.trim() ||
    (await fetchLeadDisplayFallback(args.leadId, args.organizationId))?.client?.trim() ||
    'WhatsApp Lead';

  const webId = await resolveWebIdForLeadSubmission(args.organizationId, args.leadId);
  const formId = await resolveFormIdForLeadSubmission(args.organizationId, args.leadId, webId);

  const { error: insertError } = await supabase.from('lead_submissions').insert({
    organization_id: args.organizationId,
    lead_id: args.leadId,
    web_id: webId,
    form_id: formId ?? null,
    name: displayName,
    email: trimmedEmail,
    phone_number: args.defaults?.phone_number?.trim() || null,
    status: 'draft',
    is_active: true,
    updated_at: now,
  });

  if (insertError) throw insertError;
}

export async function fetchLeadDisplayFallback(
  leadId: string,
  organizationId: string,
): Promise<{ client: string | null; phone_number: string | null; email: string | null } | null> {
  const { data, error } = await supabase
    .from('leads')
    .select('client, phone_number, email, ticket_id')
    .eq('id', leadId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) {
    console.error('fetchLeadDisplayFallback:', error);
    return null;
  }
  if (!data) return null;

  let phone = data.phone_number != null ? String(data.phone_number).trim() : '';
  let client = data.client != null ? String(data.client).trim() : '';
  const email = data.email != null ? String(data.email).trim() : '';
  const ticketId = data.ticket_id != null ? String(data.ticket_id).trim() : '';

  // Floating stub may still have empty phone/name on submission while WA conversation is linked.
  if ((!phone || isPlaceholderLeadClientName(client)) && ticketId.toUpperCase().startsWith('WA-')) {
    const { data: conv } = await supabase
      .from('whatsapp_conversations')
      .select('customer_name, customer_wa_id')
      .eq('organization_id', organizationId)
      .eq('ticket_id', ticketId)
      .maybeSingle();
    if (conv) {
      if (!phone && conv.customer_wa_id) phone = String(conv.customer_wa_id).trim();
      const convName = String(conv.customer_name ?? '').trim();
      if (isPlaceholderLeadClientName(client) && convName && !isPlaceholderLeadClientName(convName)) {
        client = convName;
      }
    }
  }

  return {
    client: client || null,
    phone_number: phone || null,
    email: email || null,
  };
}
