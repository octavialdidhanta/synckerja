/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  googleContactsCorsHeaders,
  googleContactsJson,
} from "../_shared/googleContactsAuth.ts";
import { getGoogleContactsAccessToken } from "../_shared/googleContactsOrgResolver.ts";
import { normalizePhoneToE164 } from "../_shared/googleContactsPhone.ts";
import {
  upsertContact,
} from "../_shared/googleContactsPeople.ts";
import {
  pickLeadContactDisplayName,
  resolveChannelCustomerName,
} from "../_shared/omnichannelLeadClientName.ts";

type SyncJob = {
  id: string;
  organization_id: string;
  lead_id: string;
  reason: string;
  attempts: number;
};

function backoffSeconds(attempts: number): number {
  const base = Math.min(3600, Math.pow(2, Math.max(0, attempts - 1)) * 30);
  return base;
}

async function loadLeadContactFields(
  admin: SupabaseClient,
  organizationId: string,
  leadId: string,
): Promise<{
  name: string;
  phone: string | null;
  email: string | null;
  ticketId: string | null;
  source: string | null;
  shouldPatchLeadClient: boolean;
} | null> {
  const { data: lead } = await admin
    .from("leads")
    .select("id, client, phone_number, email, ticket_id, source, organization_id")
    .eq("id", leadId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!lead?.id) return null;

  const { data: submission } = await admin
    .from("lead_submissions")
    .select("name, phone_number, email")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const phone =
    String(lead.phone_number ?? "").trim() ||
    String(submission?.phone_number ?? "").trim() ||
    null;
  const email =
    String(lead.email ?? "").trim() ||
    String(submission?.email ?? "").trim() ||
    null;
  const ticketId = lead.ticket_id != null ? String(lead.ticket_id) : null;
  const channelCustomerName = await resolveChannelCustomerName(
    admin,
    organizationId,
    ticketId,
    phone,
  );
  const picked = pickLeadContactDisplayName({
    submissionName: submission?.name,
    leadClient: lead.client,
    channelCustomerName,
    phone,
  });

  return {
    name: picked.name,
    phone,
    email,
    ticketId,
    source: lead.source != null ? String(lead.source) : null,
    shouldPatchLeadClient: picked.shouldPatchLeadClient,
  };
}

async function processOneJob(admin: SupabaseClient, job: SyncJob): Promise<void> {
  const fields = await loadLeadContactFields(admin, job.organization_id, job.lead_id);
  if (!fields) {
    await admin
      .from("google_contacts_sync_jobs")
      .update({
        status: "done",
        last_error: "lead_not_found",
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return;
  }

  const phoneE164 = normalizePhoneToE164(fields.phone);
  if (!phoneE164) {
    await admin.from("lead_google_contact_links").upsert(
      {
        organization_id: job.organization_id,
        lead_id: job.lead_id,
        sync_status: "skipped",
        last_error: "invalid_phone",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,lead_id" },
    );
    await admin
      .from("google_contacts_sync_jobs")
      .update({
        status: "done",
        last_error: "invalid_phone",
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return;
  }

  let access;
  try {
    access = await getGoogleContactsAccessToken(admin, job.organization_id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const retryAt = new Date(Date.now() + backoffSeconds(job.attempts) * 1000).toISOString();
    await admin
      .from("google_contacts_sync_jobs")
      .update({
        status: "failed",
        last_error: msg,
        run_after: retryAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    await admin.from("lead_google_contact_links").upsert(
      {
        organization_id: job.organization_id,
        lead_id: job.lead_id,
        sync_status: "failed",
        last_error: msg,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,lead_id" },
    );
    if (/invalid_grant/i.test(msg)) {
      await admin
        .from("organization_google_contacts_connections")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("organization_id", job.organization_id);
    }
    return;
  }

  if (!access) {
    await admin
      .from("google_contacts_sync_jobs")
      .update({
        status: "failed",
        last_error: "not_connected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return;
  }

  const { data: link } = await admin
    .from("lead_google_contact_links")
    .select("google_resource_name")
    .eq("organization_id", job.organization_id)
    .eq("lead_id", job.lead_id)
    .maybeSingle();

  if (fields.shouldPatchLeadClient && fields.name && fields.name !== "Lead") {
    await admin
      .from("leads")
      .update({
        client: fields.name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.lead_id)
      .eq("organization_id", job.organization_id);

    const { data: stubSubs } = await admin
      .from("lead_submissions")
      .select("id, name")
      .eq("lead_id", job.lead_id)
      .limit(5);
    for (const sub of stubSubs ?? []) {
      const subName = String(sub.name ?? "").trim();
      if (!subName || subName.toLowerCase() === fields.name.toLowerCase()) continue;
      // Only rewrite known channel stubs on submission rows
      const lower = subName.toLowerCase();
      if (
        lower === "whatsapp floating click" ||
        lower === "website visitor" ||
        lower === "instagram contact" ||
        lower === "messenger contact"
      ) {
        await admin
          .from("lead_submissions")
          .update({ name: fields.name, updated_at: new Date().toISOString() })
          .eq("id", sub.id);
      }
    }
  }

  const noteParts = [
    "Synced from Synckerja Omnichannel Leads",
    fields.ticketId ? `Ticket: ${fields.ticketId}` : null,
    fields.source ? `Source: ${fields.source}` : null,
  ].filter(Boolean);
  const note = noteParts.join(" · ");

  try {
    const linkedResource = link?.google_resource_name
      ? String(link.google_resource_name)
      : null;

    const person = await upsertContact(
      access.accessToken,
      linkedResource,
      {
        name: fields.name,
        phoneE164,
        email: fields.email,
        note,
      },
      phoneE164,
      fields.email,
    );
    const resourceName = person.resourceName ?? linkedResource;

    await admin.from("lead_google_contact_links").upsert(
      {
        organization_id: job.organization_id,
        lead_id: job.lead_id,
        google_resource_name: resourceName,
        sync_status: "synced",
        last_synced_at: new Date().toISOString(),
        last_error: null,
        last_phone_e164: phoneE164,
        last_email: fields.email,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,lead_id" },
    );

    await admin
      .from("google_contacts_sync_jobs")
      .update({
        status: "done",
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const retryAt = new Date(Date.now() + backoffSeconds(job.attempts) * 1000).toISOString();
    await admin
      .from("google_contacts_sync_jobs")
      .update({
        status: "failed",
        last_error: msg,
        run_after: retryAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    await admin.from("lead_google_contact_links").upsert(
      {
        organization_id: job.organization_id,
        lead_id: job.lead_id,
        sync_status: "failed",
        last_error: msg,
        last_phone_e164: phoneE164,
        last_email: fields.email,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,lead_id" },
    );
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: googleContactsCorsHeaders });
  }
  if (req.method !== "POST") {
    return googleContactsJson({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return googleContactsJson({ error: "Server misconfigured" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!bearer || bearer !== serviceRoleKey) {
    return googleContactsJson({ error: "Unauthorized" }, 401);
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const action = String(body.action ?? "processJobs").trim();
  if (action !== "processJobs") {
    return googleContactsJson({ error: "Unknown action" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: jobs, error: claimErr } = await admin.rpc("claim_google_contacts_sync_jobs", {
    p_limit: 25,
  });

  if (claimErr) {
    console.error("claim_google_contacts_sync_jobs:", claimErr.message);
    return googleContactsJson({ error: claimErr.message }, 500);
  }

  const list = (jobs ?? []) as SyncJob[];
  let processed = 0;
  for (const job of list) {
    await processOneJob(admin, {
      id: String(job.id),
      organization_id: String(job.organization_id),
      lead_id: String(job.lead_id),
      reason: String(job.reason ?? "update"),
      attempts: Number(job.attempts ?? 1),
    });
    processed += 1;
    // Soft throttle — People API returns HTML error pages when bursty
    if (processed < list.length) {
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  return googleContactsJson({ ok: true, processed }, 200);
});
