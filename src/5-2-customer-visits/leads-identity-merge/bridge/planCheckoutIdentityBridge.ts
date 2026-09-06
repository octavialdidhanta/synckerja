import { isAttributedPosCheckoutLead } from "@/5-2-customer-visits/checkout/pos-bind/posCheckoutLeadGuards";
import { isValidIdentityEmail } from "../typo/isTypoEmailCandidate";
import { normalizeMergeEmailKey } from "../normalizeMergeEmailKey";
import { normalizeMergePhoneKey } from "../normalizeMergePhoneKey";
import type { LeadMergeLeadInput } from "../types";
import type { CheckoutBridgePlan } from "./types";

/**
 * Pure mirror of merge_checkout_identity_bridge_dry_run (winner / skip rules).
 * Prefers phone-anchored lead unless only the email lead is attributed.
 */
export function planCheckoutIdentityBridge(args: {
  phoneLead: LeadMergeLeadInput | null | undefined;
  emailLead: LeadMergeLeadInput | null | undefined;
  enrolledLeadIds?: ReadonlySet<string>;
}): CheckoutBridgePlan {
  const phoneLeadId = args.phoneLead?.id ?? "";
  const emailLeadId = args.emailLead?.id ?? "";
  const enrolled = args.enrolledLeadIds ?? new Set<string>();

  if (!args.phoneLead || !args.emailLead || args.phoneLead.merged_into_lead_id || args.emailLead.merged_into_lead_id) {
    return {
      skipped: true,
      skipReason: "lead_not_found_or_archived",
      winnerLeadId: null,
      loserLeadIds: [],
      clusterKey: null,
      phoneLeadId,
      emailLeadId,
    };
  }

  if (args.phoneLead.id === args.emailLead.id) {
    return {
      skipped: true,
      skipReason: "same_lead",
      winnerLeadId: args.phoneLead.id,
      loserLeadIds: [],
      clusterKey: null,
      phoneLeadId: args.phoneLead.id,
      emailLeadId: args.emailLead.id,
    };
  }

  const phoneKey = normalizeMergePhoneKey(args.phoneLead.phone_number);
  const emailKey = normalizeMergeEmailKey(args.emailLead.email);
  if (!phoneKey || !emailKey) {
    return {
      skipped: true,
      skipReason: "missing_phone_or_email_key",
      winnerLeadId: null,
      loserLeadIds: [],
      clusterKey: null,
      phoneLeadId: args.phoneLead.id,
      emailLeadId: args.emailLead.id,
    };
  }

  if (!isValidIdentityEmail(emailKey)) {
    return {
      skipped: true,
      skipReason: "invalid_email",
      winnerLeadId: null,
      loserLeadIds: [],
      clusterKey: null,
      phoneLeadId: args.phoneLead.id,
      emailLeadId: args.emailLead.id,
    };
  }

  const clusterKey = `phone:${phoneKey}|email:${emailKey}`;
  const members = [args.phoneLead, args.emailLead];
  const attributedCount = members.filter((m) =>
    isAttributedPosCheckoutLead(
      { id: m.id, source: m.source, ticket_id: m.ticket_id },
      enrolled,
    ),
  ).length;

  if (attributedCount > 1) {
    return {
      skipped: true,
      skipReason: "ambiguous_attributed",
      winnerLeadId: null,
      loserLeadIds: [],
      clusterKey,
      phoneLeadId: args.phoneLead.id,
      emailLeadId: args.emailLead.id,
    };
  }

  const phoneAttr = isAttributedPosCheckoutLead(
    { id: args.phoneLead.id, source: args.phoneLead.source, ticket_id: args.phoneLead.ticket_id },
    enrolled,
  );
  const emailAttr = isAttributedPosCheckoutLead(
    { id: args.emailLead.id, source: args.emailLead.source, ticket_id: args.emailLead.ticket_id },
    enrolled,
  );

  const winnerId =
    emailAttr && !phoneAttr ? args.emailLead.id : args.phoneLead.id;

  return {
    skipped: false,
    skipReason: null,
    winnerLeadId: winnerId,
    loserLeadIds: members.map((m) => m.id).filter((id) => id !== winnerId),
    clusterKey,
    phoneLeadId: args.phoneLead.id,
    emailLeadId: args.emailLead.id,
  };
}
