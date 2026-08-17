import { normalizeCustomerVisitIgHandle } from './normalizeCustomerVisitIgHandle';
import { normalizeCustomerVisitPhone } from './normalizeCustomerVisitPhone';

export type CustomerVisitLookupKind = 'phone' | 'instagram';

export type CustomerVisitLeadCandidate = {
  id: string;
  client: string;
  phone_number: string | null;
  ticket_id: string;
  source: string | null;
};

export type CustomerVisitEnrollmentRow = {
  lead_id: string | null;
  participant_username: string | null;
};

export type CustomerVisitMatchResult =
  | { status: 'none' }
  | { status: 'unique'; lead: CustomerVisitLeadCandidate }
  | { status: 'many'; leads: CustomerVisitLeadCandidate[] };

export function matchCustomerVisitParty(args: {
  kind: CustomerVisitLookupKind;
  normalized: string;
  leads: CustomerVisitLeadCandidate[];
  enrollments?: CustomerVisitEnrollmentRow[];
}): CustomerVisitMatchResult {
  const byId = new Map<string, CustomerVisitLeadCandidate>();
  const leadById = new Map(args.leads.map((lead) => [lead.id, lead]));

  if (args.kind === 'phone') {
    for (const lead of args.leads) {
      const key = normalizeCustomerVisitPhone(lead.phone_number);
      if (key && key === args.normalized) byId.set(lead.id, lead);
    }
  } else {
    for (const lead of args.leads) {
      const handle = normalizeCustomerVisitIgHandle(lead.client);
      if (handle && handle === args.normalized) byId.set(lead.id, lead);
    }
    for (const enrollment of args.enrollments ?? []) {
      const handle = normalizeCustomerVisitIgHandle(enrollment.participant_username);
      if (handle !== args.normalized) continue;
      const leadId = enrollment.lead_id?.trim();
      if (!leadId) continue;
      const lead = leadById.get(leadId);
      if (lead) byId.set(lead.id, lead);
    }
  }

  const leads = [...byId.values()];
  if (leads.length === 0) return { status: 'none' };
  if (leads.length === 1) return { status: 'unique', lead: leads[0]! };

  const enrolledLeadIds = new Set<string>();
  for (const enrollment of args.enrollments ?? []) {
    const handle = normalizeCustomerVisitIgHandle(enrollment.participant_username);
    if (handle !== args.normalized) continue;
    const leadId = enrollment.lead_id?.trim();
    if (leadId) enrolledLeadIds.add(leadId);
  }
  const preferred = leads.filter((lead) => isPreferredCustomerVisitLead(lead, enrolledLeadIds));
  if (preferred.length === 1) return { status: 'unique', lead: preferred[0]! };
  return { status: 'many', leads };
}

function isPreferredCustomerVisitLead(
  lead: CustomerVisitLeadCandidate,
  enrolledLeadIds: Set<string>,
): boolean {
  const source = (lead.source ?? '').trim();
  const ticket = (lead.ticket_id ?? '').trim().toUpperCase();
  if (source === 'Lead Magnet') return true;
  if (ticket.startsWith('LEAD-')) return true;
  if ((ticket.startsWith('IG-') || ticket.startsWith('FB-')) && enrolledLeadIds.has(lead.id)) return true;
  return false;
}
