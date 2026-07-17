import { supabase } from '@/shared/lib/supabaseClient';

export type LeadMagnetConversationTable =
  | 'instagram_conversations'
  | 'facebook_conversations'
  | 'whatsapp_conversations';

export type LeadMagnetLeadMeta = {
  _fromLeadMagnet: true;
  _leadMagnetEnrollmentId: string | null;
  _leadMagnetConversationId: string | null;
  _leadMagnetConversationTable: LeadMagnetConversationTable | null;
  _leadMagnetEnrollmentStatus: string | null;
  _leadMagnetCampaignId: string | null;
  _leadMagnetCampaignName: string | null;
  _leadMagnetKeyword: string | null;
  _leadMagnetPlatform: 'instagram' | 'facebook' | null;
};

type EnrollmentJoinRow = {
  conversation_id: string | null;
  conversation_table: string | null;
  platform: string | null;
  status: string | null;
  campaign_id: string | null;
  lead_magnet_campaigns: { name: string; keyword: string } | { name: string; keyword: string }[] | null;
};

type SubmissionJoinRow = {
  lead_id: string | null;
  lead_magnet_enrollment_id: string | null;
  lead_magnet_campaign_id: string | null;
  lead_magnet_enrollments: EnrollmentJoinRow | EnrollmentJoinRow[] | null;
};

function unwrapEnrollment(raw: SubmissionJoinRow['lead_magnet_enrollments']): EnrollmentJoinRow | null {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

function unwrapCampaign(
  raw: EnrollmentJoinRow['lead_magnet_campaigns'],
): { name: string; keyword: string } | null {
  if (!raw) return null;
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row) return null;
  return { name: row.name, keyword: row.keyword };
}

function normalizeConversationTable(value: string | null | undefined): LeadMagnetConversationTable | null {
  const t = (value ?? '').trim();
  if (
    t === 'instagram_conversations' ||
    t === 'facebook_conversations' ||
    t === 'whatsapp_conversations'
  ) {
    return t;
  }
  return null;
}

export function isLeadMagnetSourceLead(lead: { source?: string | null; category?: string | null }): boolean {
  const source = (lead.source ?? '').trim();
  const category = (lead.category ?? '').trim();
  return source === 'Lead Magnet' || category === 'Lead Magnet';
}

/** Conversation IDs already represented by a Lead Magnet CRM row — hide duplicate virtual inbox rows. */
export function buildLeadMagnetLinkedConversationIdSet(
  metaByLeadId: Map<string, LeadMagnetLeadMeta>,
): Set<string> {
  const ids = new Set<string>();
  for (const meta of metaByLeadId.values()) {
    const convId = (meta._leadMagnetConversationId ?? '').trim();
    if (convId) ids.add(convId);
  }
  return ids;
}

export function shouldHideVirtualConversationForLeadMagnet(
  conversationId: string,
  linkedConversationIds: Set<string>,
): boolean {
  return linkedConversationIds.has(conversationId);
}

export async function fetchLeadMagnetMetaByLeadIds(
  organizationId: string,
  leadIds: string[],
): Promise<Map<string, LeadMagnetLeadMeta>> {
  const result = new Map<string, LeadMagnetLeadMeta>();
  if (!organizationId || leadIds.length === 0) return result;

  const { data, error } = await supabase
    .from('lead_submissions')
    .select(
      `lead_id,
      lead_magnet_enrollment_id,
      lead_magnet_campaign_id,
      lead_magnet_enrollments (
        conversation_id,
        conversation_table,
        platform,
        status,
        campaign_id,
        lead_magnet_campaigns ( name, keyword )
      )`,
    )
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .in('lead_id', leadIds)
    .not('lead_magnet_enrollment_id', 'is', null);

  if (error) {
    console.error('Error fetching lead magnet enrollments for leads:', error);
    return result;
  }

  for (const row of (data ?? []) as SubmissionJoinRow[]) {
    const leadId = String(row.lead_id ?? '').trim();
    if (!leadId || result.has(leadId)) continue;

    const enrollment = unwrapEnrollment(row.lead_magnet_enrollments);
    const campaign = unwrapCampaign(enrollment?.lead_magnet_campaigns ?? null);
    const platformRaw = (enrollment?.platform ?? '').trim();
    const platform = platformRaw === 'instagram' || platformRaw === 'facebook' ? platformRaw : null;

    result.set(leadId, {
      _fromLeadMagnet: true,
      _leadMagnetEnrollmentId: row.lead_magnet_enrollment_id ?? null,
      _leadMagnetConversationId: enrollment?.conversation_id ?? null,
      _leadMagnetConversationTable: normalizeConversationTable(enrollment?.conversation_table),
      _leadMagnetEnrollmentStatus: enrollment?.status ?? null,
      _leadMagnetCampaignId: row.lead_magnet_campaign_id ?? enrollment?.campaign_id ?? null,
      _leadMagnetCampaignName: campaign?.name ?? null,
      _leadMagnetKeyword: campaign?.keyword ?? null,
      _leadMagnetPlatform: platform,
    });
  }

  return result;
}

type ConversationAssignee = { assignee_id: string | null };

export async function fetchConversationAssigneeMap(
  entries: Array<{ conversationId: string; table: LeadMagnetConversationTable }>,
): Promise<Map<string, string | null>> {
  const byTable = new Map<LeadMagnetConversationTable, Set<string>>();
  for (const entry of entries) {
    const id = entry.conversationId.trim();
    if (!id) continue;
    if (!byTable.has(entry.table)) byTable.set(entry.table, new Set());
    byTable.get(entry.table)!.add(id);
  }

  const assigneeByConversationId = new Map<string, string | null>();

  const loadTable = async (table: LeadMagnetConversationTable, ids: string[]) => {
    if (ids.length === 0) return;
    const { data, error } = await supabase.from(table).select('id, assignee_id').in('id', ids);
    if (error) {
      console.error(`Error fetching assignees from ${table}:`, error);
      return;
    }
    for (const row of (data ?? []) as Array<{ id: string; assignee_id: string | null }>) {
      assigneeByConversationId.set(String(row.id), row.assignee_id ?? null);
    }
  };

  await Promise.all(
    [...byTable.entries()].map(([table, idSet]) => loadTable(table, [...idSet])),
  );

  return assigneeByConversationId;
}

export function applyLeadMagnetAssigneeOverlay<T extends Record<string, unknown>>(
  lead: T,
  meta: LeadMagnetLeadMeta | undefined,
  assigneeByConversationId: Map<string, string | null>,
  assigneeNameMap: Map<string, string>,
  normId: (id: string | null | undefined) => string,
): T {
  if (!meta?._leadMagnetConversationId) return lead;
  const convId = String(meta._leadMagnetConversationId);
  const assigneeId = assigneeByConversationId.get(convId);
  if (assigneeId === undefined) return lead;
  const assigneeName = assigneeId ? assigneeNameMap.get(normId(assigneeId)) ?? null : null;
  return {
    ...lead,
    assignee_id: assigneeId,
    assignee: assigneeName ?? (assigneeId ? 'Assigned' : 'Unassigned'),
  };
}

export function enrichLeadRowWithLeadMagnetMeta<T extends Record<string, unknown>>(
  lead: T,
  meta: LeadMagnetLeadMeta | undefined,
): T {
  if (!meta) {
    if (isLeadMagnetSourceLead(lead as { source?: string | null; category?: string | null })) {
      return { ...lead, _fromLeadMagnet: true as const };
    }
    return lead;
  }
  return { ...lead, ...meta };
}
