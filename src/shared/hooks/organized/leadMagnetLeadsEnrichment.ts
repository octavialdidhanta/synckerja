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
  _leadMagnetParticipantScopedId: string | null;
};

export type LeadMagnetVirtualDedupeContext = {
  linkedConversationIds: Set<string>;
  linkedTicketSuffixes: Set<string>;
  linkedParticipantScopedIds: Set<string>;
};

type SubmissionRow = {
  lead_id: string | null;
  lead_magnet_enrollment_id: string | null;
  lead_magnet_campaign_id: string | null;
};

type EnrollmentRow = {
  id: string;
  conversation_id: string | null;
  conversation_table: string | null;
  platform: string | null;
  status: string | null;
  campaign_id: string | null;
  participant_scoped_id: string | null;
};

type CampaignRow = {
  id: string;
  name: string;
  keyword: string;
};

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

function buildMetaFromRows(
  submission: SubmissionRow,
  enrollment: EnrollmentRow | undefined,
  campaign: CampaignRow | undefined,
): LeadMagnetLeadMeta {
  const platformRaw = (enrollment?.platform ?? '').trim();
  const platform = platformRaw === 'instagram' || platformRaw === 'facebook' ? platformRaw : null;

  return {
    _fromLeadMagnet: true,
    _leadMagnetEnrollmentId: submission.lead_magnet_enrollment_id ?? null,
    _leadMagnetConversationId: enrollment?.conversation_id ?? null,
    _leadMagnetConversationTable: normalizeConversationTable(enrollment?.conversation_table),
    _leadMagnetEnrollmentStatus: enrollment?.status ?? null,
    _leadMagnetCampaignId: submission.lead_magnet_campaign_id ?? enrollment?.campaign_id ?? null,
    _leadMagnetCampaignName: campaign?.name ?? null,
    _leadMagnetKeyword: campaign?.keyword ?? null,
    _leadMagnetPlatform: platform,
    _leadMagnetParticipantScopedId: enrollment?.participant_scoped_id ?? null,
  };
}

export function isLeadMagnetSourceLead(lead: { source?: string | null; category?: string | null }): boolean {
  const source = (lead.source ?? '').trim();
  const category = (lead.category ?? '').trim();
  return source === 'Lead Magnet' || category === 'Lead Magnet';
}

/** First 8 hex chars of a UUID (uppercase), used in IG-/FB-/WA- ticket ids. */
export function conversationUuidToTicketSuffix(conversationId: string): string {
  return conversationId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

/** Parse IG-414717FE / FB-13231239 / WA-XXXXXXXX ticket suffix. */
export function parseVirtualChannelTicketSuffix(ticketId: string): string | null {
  const match = ticketId.trim().match(/^(?:IG|FB|WA)-([0-9A-F]{8})$/i);
  return match ? match[1].toUpperCase() : null;
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

export function buildLeadMagnetLinkedTicketSuffixSet(
  metaByLeadId: Map<string, LeadMagnetLeadMeta>,
): Set<string> {
  const suffixes = new Set<string>();
  for (const meta of metaByLeadId.values()) {
    const convId = (meta._leadMagnetConversationId ?? '').trim();
    if (convId) suffixes.add(conversationUuidToTicketSuffix(convId));
  }
  return suffixes;
}

export function buildLeadMagnetParticipantScopedIdSet(
  metaByLeadId: Map<string, LeadMagnetLeadMeta>,
): Set<string> {
  const ids = new Set<string>();
  for (const meta of metaByLeadId.values()) {
    const participantId = (meta._leadMagnetParticipantScopedId ?? '').trim();
    if (participantId) ids.add(participantId);
  }
  return ids;
}

export function buildLeadMagnetVirtualDedupeContext(
  metaByLeadId: Map<string, LeadMagnetLeadMeta>,
): LeadMagnetVirtualDedupeContext {
  return {
    linkedConversationIds: buildLeadMagnetLinkedConversationIdSet(metaByLeadId),
    linkedTicketSuffixes: buildLeadMagnetLinkedTicketSuffixSet(metaByLeadId),
    linkedParticipantScopedIds: buildLeadMagnetParticipantScopedIdSet(metaByLeadId),
  };
}

export type VirtualConversationDedupeArgs = {
  conversationId: string;
  ticketId?: string | null;
  customerIgId?: string | null;
  customerPsid?: string | null;
  customerWaId?: string | null;
};

export function shouldHideVirtualConversationForLeadMagnet(
  args: VirtualConversationDedupeArgs | string,
  ctxOrLinkedIds: LeadMagnetVirtualDedupeContext | Set<string>,
): boolean {
  const normalizedArgs: VirtualConversationDedupeArgs =
    typeof args === 'string' ? { conversationId: args } : args;

  const ctx: LeadMagnetVirtualDedupeContext =
    ctxOrLinkedIds instanceof Set
      ? { linkedConversationIds: ctxOrLinkedIds, linkedTicketSuffixes: new Set(), linkedParticipantScopedIds: new Set() }
      : ctxOrLinkedIds;

  const convId = normalizedArgs.conversationId.trim();
  if (convId && ctx.linkedConversationIds.has(convId)) return true;

  const ticketSuffix =
    (normalizedArgs.ticketId ? parseVirtualChannelTicketSuffix(normalizedArgs.ticketId) : null) ??
    (convId ? conversationUuidToTicketSuffix(convId) : null);
  if (ticketSuffix && ctx.linkedTicketSuffixes.has(ticketSuffix)) return true;

  const participantId = (
    normalizedArgs.customerIgId ??
    normalizedArgs.customerPsid ??
    normalizedArgs.customerWaId ??
    ''
  ).trim();
  if (participantId && ctx.linkedParticipantScopedIds.has(participantId)) return true;

  return false;
}

export async function fetchLeadMagnetMetaByLeadIds(
  organizationId: string,
  leadIds: string[],
): Promise<Map<string, LeadMagnetLeadMeta>> {
  const result = new Map<string, LeadMagnetLeadMeta>();
  if (!organizationId || leadIds.length === 0) return result;

  const { data: submissionRows, error: submissionError } = await supabase
    .from('lead_submissions')
    .select('lead_id, lead_magnet_enrollment_id, lead_magnet_campaign_id')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .in('lead_id', leadIds)
    .not('lead_magnet_enrollment_id', 'is', null);

  if (submissionError) {
    console.error('Error fetching lead magnet submissions for leads:', submissionError);
    return result;
  }

  const submissions = (submissionRows ?? []) as SubmissionRow[];
  if (submissions.length === 0) return result;

  const enrollmentIds = [
    ...new Set(
      submissions
        .map((row) => String(row.lead_magnet_enrollment_id ?? '').trim())
        .filter(Boolean),
    ),
  ];

  const { data: enrollmentRows, error: enrollmentError } = await supabase
    .from('lead_magnet_enrollments')
    .select('id, conversation_id, conversation_table, platform, status, campaign_id, participant_scoped_id')
    .eq('organization_id', organizationId)
    .in('id', enrollmentIds);

  if (enrollmentError) {
    console.error('Error fetching lead magnet enrollments for leads:', enrollmentError);
    return result;
  }

  const enrollmentById = new Map<string, EnrollmentRow>();
  for (const row of (enrollmentRows ?? []) as EnrollmentRow[]) {
    enrollmentById.set(String(row.id), row);
  }

  const campaignIds = new Set<string>();
  for (const submission of submissions) {
    const campaignId = String(submission.lead_magnet_campaign_id ?? '').trim();
    if (campaignId) campaignIds.add(campaignId);
    const enrollmentId = String(submission.lead_magnet_enrollment_id ?? '').trim();
    const enrollment = enrollmentId ? enrollmentById.get(enrollmentId) : undefined;
    const enrollCampaignId = String(enrollment?.campaign_id ?? '').trim();
    if (enrollCampaignId) campaignIds.add(enrollCampaignId);
  }

  const campaignById = new Map<string, CampaignRow>();
  if (campaignIds.size > 0) {
    const { data: campaignRows, error: campaignError } = await supabase
      .from('lead_magnet_campaigns')
      .select('id, name, keyword')
      .eq('organization_id', organizationId)
      .in('id', [...campaignIds]);

    if (campaignError) {
      console.error('Error fetching lead magnet campaigns for leads:', campaignError);
    } else {
      for (const row of (campaignRows ?? []) as CampaignRow[]) {
        campaignById.set(String(row.id), row);
      }
    }
  }

  if (import.meta.env.DEV) {
    for (const submission of submissions) {
      const enrollmentId = String(submission.lead_magnet_enrollment_id ?? '').trim();
      if (enrollmentId && !enrollmentById.has(enrollmentId)) {
        console.warn(
          '[leadMagnetLeadsEnrichment] submission references missing enrollment',
          { leadId: submission.lead_id, enrollmentId },
        );
      }
    }
  }

  for (const submission of submissions) {
    const leadId = String(submission.lead_id ?? '').trim();
    if (!leadId || result.has(leadId)) continue;

    const enrollmentId = String(submission.lead_magnet_enrollment_id ?? '').trim();
    const enrollment = enrollmentId ? enrollmentById.get(enrollmentId) : undefined;
    const campaignId = String(
      submission.lead_magnet_campaign_id ?? enrollment?.campaign_id ?? '',
    ).trim();
    const campaign = campaignId ? campaignById.get(campaignId) : undefined;

    result.set(leadId, buildMetaFromRows(submission, enrollment, campaign));
  }

  return result;
}

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
