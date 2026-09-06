import { normalizeCustomerEmail } from "@/5-2-customer-visits/lib/normalizeCustomerEmail";
import { normalizeMergePhoneKey } from "../normalizeMergePhoneKey";
import { isValidIdentityEmail } from "../typo/isTypoEmailCandidate";
import type { LeadMergeLeadInput } from "../types";

export type IdentityNodeId = string; // phone:KEY | email:KEY

export type IdentityLeadKeys = {
  leadId: string;
  phoneNode: IdentityNodeId | null;
  emailNode: IdentityNodeId | null;
};

export function phoneNodeId(phoneKey: string): IdentityNodeId {
  return `phone:${phoneKey}`;
}

export function emailNodeId(emailKey: string): IdentityNodeId {
  return `email:${emailKey}`;
}

/** Emit per-lead phone/email nodes (valid keys only). */
export function buildIdentityLeadKeys(leads: LeadMergeLeadInput[]): IdentityLeadKeys[] {
  const out: IdentityLeadKeys[] = [];
  for (const lead of leads) {
    if (lead.merged_into_lead_id) continue;
    const phoneKey = normalizeMergePhoneKey(lead.phone_number);
    const emailRaw = lead.email;
    const emailKey =
      emailRaw && isValidIdentityEmail(emailRaw)
        ? normalizeCustomerEmail(emailRaw)
        : null;
    if (!phoneKey && !emailKey) continue;
    out.push({
      leadId: lead.id,
      phoneNode: phoneKey ? phoneNodeId(phoneKey) : null,
      emailNode: emailKey ? emailNodeId(emailKey) : null,
    });
  }
  return out;
}
