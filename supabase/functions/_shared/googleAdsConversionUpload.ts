/**
 * Shared Google Ads offline conversion upload logic (deferred batch + single-lead).
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveOrgGoogleAdsForUpload } from "./googleAdsOrgResolver.ts";
import {
  fetchGoogleAdsAccessToken,
  formatConversionDateTimeWib,
  hasHashableContact,
  hashUserIdentifiers,
  type HashedUserIdentifiers,
  uploadClickConversion,
  type ClickIdBundle,
} from "../google-ads-upload-offline-conversion/googleAdsHelpers.ts";

export type GoogleAdsUploadLogStatus = "pending" | "success" | "failed" | "skipped";

export type GoogleAdsUploadLogRow = {
  organization_id: string;
  lead_id: string;
  sales_activity_id: string | null;
  gclid: string | null;
  status: GoogleAdsUploadLogStatus;
  skip_reason: string | null;
  error_message: string | null;
  google_ads_partial_failure: unknown;
  google_ads_account_id: string | null;
  customer_id_snapshot: string | null;
  upload_attempt_count?: number;
};

export type ProcessGoogleAdsConversionResult = {
  ok: boolean;
  uploaded?: boolean;
  skipped?: boolean;
  duplicate?: boolean;
  reason?: string;
  error?: string;
};

function pickGclid(columnGclid: string | null | undefined, attribution: unknown): string | null {
  const fromColumn = columnGclid != null ? String(columnGclid).trim() : "";
  if (fromColumn) return fromColumn;

  if (attribution == null) return null;
  let obj: unknown = attribution;
  if (typeof obj === "string") {
    const t = obj.trim();
    if (!t) return null;
    try {
      obj = JSON.parse(t) as unknown;
    } catch {
      return null;
    }
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return null;
  const g = (obj as Record<string, unknown>).gclid;
  if (g == null) return null;
  const s = String(g).trim();
  return s || null;
}

async function resolveLeadContact(
  admin: SupabaseClient,
  organizationId: string,
  leadId: string,
  leadEmail: string | null | undefined,
  leadPhone: string | null | undefined,
): Promise<{ email: string | null; phone: string | null }> {
  let email = leadEmail?.trim() || null;
  let phone = leadPhone?.trim() || null;

  if (!email || !phone) {
    const { data: submission } = await admin
      .from("lead_submissions")
      .select("email, phone_number")
      .eq("lead_id", leadId)
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("submitted_at", { ascending: false })
      .limit(5);

    for (const row of submission ?? []) {
      const r = row as { email?: string | null; phone_number?: string | null };
      if (!email && r.email?.trim()) email = r.email.trim();
      if (!phone && r.phone_number?.trim()) phone = r.phone_number.trim();
      if (email && phone) break;
    }
  }

  if (!email || !phone) {
    const { data: profile } = await admin
      .from("lead_client_profiles")
      .select("email, phone_number")
      .eq("lead_id", leadId)
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(3);

    for (const row of profile ?? []) {
      const r = row as { email?: string | null; phone_number?: string | null };
      if (!email && r.email?.trim()) email = r.email.trim();
      if (!phone && r.phone_number?.trim()) phone = r.phone_number.trim();
      if (email && phone) break;
    }
  }

  return { email, phone };
}

async function resolveConversionValue(
  admin: SupabaseClient,
  organizationId: string,
  salesActivityId: string | null,
): Promise<number> {
  if (salesActivityId) {
    const { data: payment } = await admin
      .from("sales_activity_payments")
      .select("payment_amount")
      .eq("sales_activity_id", salesActivityId)
      .eq("organization_id", organizationId)
      .in("payment_type", ["down_payment", "final_payment"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const payAmt = Number((payment as { payment_amount?: unknown } | null)?.payment_amount);
    if (Number.isFinite(payAmt) && payAmt > 0) return payAmt;

    const { data: activity } = await admin
      .from("sales_activities")
      .select("down_payment_amount, is_down_payment, total_amount")
      .eq("id", salesActivityId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (activity) {
      const a = activity as {
        down_payment_amount?: unknown;
        is_down_payment?: boolean;
        total_amount?: unknown;
      };
      if (a.is_down_payment) {
        const dp = Number(a.down_payment_amount);
        if (Number.isFinite(dp) && dp > 0) return dp;
      }
      const total = Number(a.total_amount);
      if (Number.isFinite(total) && total > 0) return total;
    }
  }

  return 1;
}

async function upsertLog(
  admin: SupabaseClient,
  row: GoogleAdsUploadLogRow,
  incrementAttempt: boolean,
): Promise<void> {
  const now = new Date().toISOString();

  if (incrementAttempt) {
    const { data: existing } = await admin
      .from("google_ads_conversion_uploads")
      .select("upload_attempt_count")
      .eq("lead_id", row.lead_id)
      .maybeSingle();

    const prev = Number((existing as { upload_attempt_count?: number } | null)?.upload_attempt_count ?? 0);
    row.upload_attempt_count = prev + 1;
  }

  const { error } = await admin.from("google_ads_conversion_uploads").upsert(
    {
      ...row,
      updated_at: now,
    },
    { onConflict: "lead_id" },
  );
  if (error) console.error("google_ads_conversion_uploads upsert:", error);
}

export async function processGoogleAdsConversionUpload(
  admin: SupabaseClient,
  organizationId: string,
  leadId: string,
  options?: {
    salesActivityId?: string | null;
    skipIfSuccess?: boolean;
    incrementAttempt?: boolean;
  },
): Promise<ProcessGoogleAdsConversionResult> {
  const salesActivityId = options?.salesActivityId?.trim() || null;
  const skipIfSuccess = options?.skipIfSuccess !== false;
  const incrementAttempt = options?.incrementAttempt !== false;

  if (skipIfSuccess) {
    const { data: existingLog } = await admin
      .from("google_ads_conversion_uploads")
      .select("status, upload_attempt_count")
      .eq("lead_id", leadId)
      .maybeSingle();

    if ((existingLog as { status?: string } | null)?.status === "success") {
      return { ok: true, duplicate: true };
    }

    const attempts = Number((existingLog as { upload_attempt_count?: number } | null)?.upload_attempt_count ?? 0);
    if (attempts >= 5 && (existingLog as { status?: string } | null)?.status === "failed") {
      return { ok: true, skipped: true, reason: "max_attempts_exceeded" };
    }
  }

  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .select(
      "id, organization_id, gclid, attribution, google_ads_account_id, payment_at, email, phone_number",
    )
    .eq("id", leadId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (leadErr || !lead?.id) {
    return { ok: false, error: "Lead not found" };
  }

  const gclid = pickGclid(
    (lead as { gclid?: string | null }).gclid,
    (lead as { attribution?: unknown }).attribution,
  );

  const leadAccountId = (lead as { google_ads_account_id?: string | null }).google_ads_account_id != null
    ? String((lead as { google_ads_account_id?: string | null }).google_ads_account_id)
    : null;

  const resolved = await resolveOrgGoogleAdsForUpload(admin, organizationId, leadAccountId);

  const accountIdForLog = resolved?.account.accountId === "legacy-global"
    ? null
    : resolved?.account.accountId ?? null;

  const baseLog: GoogleAdsUploadLogRow = {
    organization_id: organizationId,
    lead_id: leadId,
    sales_activity_id: salesActivityId,
    gclid,
    status: "skipped",
    skip_reason: null,
    error_message: null,
    google_ads_partial_failure: null,
    google_ads_account_id: accountIdForLog,
    customer_id_snapshot: resolved?.config.customerId ?? null,
  };

  if (!gclid) {
    baseLog.skip_reason = "no_gclid";
    await upsertLog(admin, baseLog, false);
    return { ok: true, skipped: true, reason: baseLog.skip_reason };
  }

  const paymentAt = (lead as { payment_at?: string | null }).payment_at;
  if (!paymentAt) {
    baseLog.skip_reason = "no_payment_at";
    await upsertLog(admin, baseLog, false);
    return { ok: true, skipped: true, reason: baseLog.skip_reason };
  }

  if (!resolved) {
    baseLog.skip_reason = "google_ads_not_configured";
    await upsertLog(admin, baseLog, false);
    return { ok: true, skipped: true, reason: baseLog.skip_reason };
  }

  const contact = await resolveLeadContact(
    admin,
    organizationId,
    leadId,
    (lead as { email?: string | null }).email,
    (lead as { phone_number?: string | null }).phone_number,
  );

  const hashed: HashedUserIdentifiers = await hashUserIdentifiers(contact.email, contact.phone);
  const hasContact = hasHashableContact(hashed);

  const clickIds: ClickIdBundle = { gclid, gbraid: null, wbraid: null };

  let effectiveSalesActivityId = salesActivityId;
  if (!effectiveSalesActivityId) {
    const { data: uploadRow } = await admin
      .from("google_ads_conversion_uploads")
      .select("sales_activity_id")
      .eq("lead_id", leadId)
      .maybeSingle();
    effectiveSalesActivityId =
      (uploadRow as { sales_activity_id?: string | null } | null)?.sales_activity_id ?? null;
  }

  const conversionValue = await resolveConversionValue(admin, organizationId, effectiveSalesActivityId);
  const conversionDateTime = formatConversionDateTimeWib(String(paymentAt));

  try {
    const accessToken = await fetchGoogleAdsAccessToken(resolved.config);
    const upload = await uploadClickConversion(resolved.config, accessToken, {
      clickIds,
      conversionDateTime,
      conversionValue,
      currencyCode: "IDR",
      hashed: hasContact ? hashed : { hashedEmail: null, hashedPhone: null },
    });

    if (!upload.ok) {
      baseLog.status = "failed";
      baseLog.error_message = upload.errorMessage ?? "upload_failed";
      baseLog.google_ads_partial_failure = upload.partialFailure ?? null;
      await upsertLog(admin, baseLog, incrementAttempt);
      return {
        ok: false,
        error: baseLog.error_message ?? undefined,
      };
    }

    baseLog.status = "success";
    baseLog.google_ads_partial_failure = upload.partialFailure ?? null;
    await upsertLog(admin, baseLog, incrementAttempt);
    return { ok: true, uploaded: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("processGoogleAdsConversionUpload:", msg);
    baseLog.status = "failed";
    baseLog.error_message = msg.slice(0, 1000);
    await upsertLog(admin, baseLog, incrementAttempt);
    return { ok: false, error: msg };
  }
}

export type PendingConversionCandidate = {
  lead_id: string;
  organization_id: string;
  sales_activity_id: string | null;
};

/** Leads eligible for batch upload: pending/failed, gclid, payment_at >= 5h ago, attempts < 5. */
export async function fetchPendingGoogleAdsConversionCandidates(
  admin: SupabaseClient,
  limit: number,
): Promise<PendingConversionCandidate[]> {
  const { data, error } = await admin.rpc("fetch_google_ads_pending_conversion_batch", {
    p_limit: limit,
  });

  if (error) {
    console.error("fetchPendingGoogleAdsConversionCandidates:", error);
    return [];
  }

  return (data ?? []).map((row: {
    lead_id: string;
    organization_id: string;
    sales_activity_id: string | null;
  }) => ({
    lead_id: String(row.lead_id),
    organization_id: String(row.organization_id),
    sales_activity_id: row.sales_activity_id,
  }));
}
