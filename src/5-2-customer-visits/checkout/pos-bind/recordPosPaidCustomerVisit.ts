import { getLocalDateYmd } from "@/shared/lib/date/getLocalDateYmd";
import { supabase } from "@/shared/lib/supabaseClient";
import { shouldRecordPosPaidCustomerVisit } from "./posCheckoutLeadGuards";
import type {
  RecordPosPaidCustomerVisitInput,
  RecordPosPaidCustomerVisitResult,
} from "./posCheckoutLead.types";

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

async function findCompletedMatchedToday(args: {
  organizationId: string;
  leadId: string;
  visitDate: string;
}): Promise<string | null> {
  const { data, error } = await supabase
    .from("customer_visits")
    .select("id")
    .eq("organization_id", args.organizationId)
    .eq("lead_id", args.leadId)
    .eq("visit_date", args.visitDate)
    .eq("match_status", "matched")
    .eq("status", "completed")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

async function linkVisitToActivity(args: {
  organizationId: string;
  visitId: string;
  salesActivityId: string;
}): Promise<void> {
  const { error: activityErr } = await supabase
    .from("sales_activities")
    .update({ customer_visit_id: args.visitId })
    .eq("id", args.salesActivityId)
    .eq("organization_id", args.organizationId);
  if (activityErr) throw activityErr;

  const { error: visitErr } = await supabase
    .from("customer_visits")
    .update({ sales_activity_id: args.salesActivityId })
    .eq("id", args.visitId)
    .eq("organization_id", args.organizationId);
  if (visitErr) throw visitErr;
}

/**
 * Insert or reuse today's matched visit, then point the paid receipt at it.
 * Call only after the sales activity exists (cash after insert, QRIS onPaid).
 */
export async function recordPosPaidCustomerVisit(
  input: RecordPosPaidCustomerVisitInput & { boundByPhone: boolean },
): Promise<RecordPosPaidCustomerVisitResult | null> {
  if (!shouldRecordPosPaidCustomerVisit(input.boundByPhone)) return null;
  if (!input.phoneKey) return null;

  const visitDate = getLocalDateYmd();
  const existingId = await findCompletedMatchedToday({
    organizationId: input.organizationId,
    leadId: input.leadId,
    visitDate,
  });

  let visitId = existingId;
  let reused = Boolean(existingId);

  if (!visitId) {
    const lookupRaw = (input.lookupRaw ?? input.phoneKey).trim();
    const { data, error } = await supabase
      .from("customer_visits")
      .insert({
        organization_id: input.organizationId,
        visit_date: visitDate,
        status: "completed",
        lead_id: input.leadId,
        lookup_kind: "phone",
        lookup_raw: lookupRaw,
        lookup_normalized: input.phoneKey,
        match_status: "matched",
        sales_activity_id: input.salesActivityId,
        created_by: input.createdBy ?? null,
      })
      .select("id")
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        const racedId = await findCompletedMatchedToday({
          organizationId: input.organizationId,
          leadId: input.leadId,
          visitDate,
        });
        if (racedId) {
          visitId = racedId;
          reused = true;
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    } else {
      if (!data?.id) throw new Error("customer_visit_insert_no_id");
      visitId = data.id as string;
      reused = false;
    }
  }

  if (!visitId) throw new Error("customer_visit_insert_no_id");

  await linkVisitToActivity({
    organizationId: input.organizationId,
    visitId,
    salesActivityId: input.salesActivityId,
  });

  return { visitId, reused };
}
