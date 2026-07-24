/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  googleContactsCorsHeaders,
  googleContactsJson,
  readPlatformGoogleContactsOAuth,
  requireOrgAdmin,
} from "../_shared/googleContactsAuth.ts";

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

  if (!readPlatformGoogleContactsOAuth()) {
    return googleContactsJson({ error: "Google OAuth is not configured on the server" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
  if ("error" in userRes) return userRes.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return googleContactsJson({ error: "Invalid JSON body" }, 400);
  }

  const action = String(body.action ?? "").trim();
  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) {
    return googleContactsJson({ error: "Missing organization_id" }, 400);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("active_organization_id")
    .eq("user_id", userRes.userId)
    .maybeSingle();
  const activeOrg = profile?.active_organization_id != null
    ? String(profile.active_organization_id)
    : "";
  if (!activeOrg || activeOrg !== organizationId) {
    return googleContactsJson({ error: "Forbidden" }, 403);
  }

  const forbidden = await requireOrgAdmin(admin, userRes.userId, organizationId);
  if (forbidden) return forbidden;

  if (action === "getSettings") {
    const { data: connection } = await admin
      .from("organization_google_contacts_connections")
      .select(
        "organization_id, google_account_email, is_active, oauth_connected_at, updated_at",
      )
      .eq("organization_id", organizationId)
      .maybeSingle();

    const { data: tokenRow } = await admin
      .from("organization_google_contacts_connection_tokens")
      .select("organization_id, oauth_scopes")
      .eq("organization_id", organizationId)
      .maybeSingle();

    const oauthConnected = Boolean(tokenRow?.organization_id);

    const { count: pendingJobs } = await admin
      .from("google_contacts_sync_jobs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("status", ["pending", "processing"]);

    const { count: failedJobs } = await admin
      .from("google_contacts_sync_jobs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "failed");

    const { count: syncedCount } = await admin
      .from("lead_google_contact_links")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("sync_status", "synced");

    return googleContactsJson({
      connection: connection ?? null,
      oauthConnected,
      oauthScopes: tokenRow?.oauth_scopes ?? null,
      pendingJobs: pendingJobs ?? 0,
      failedJobs: failedJobs ?? 0,
      syncedContacts: syncedCount ?? 0,
    }, 200);
  }

  if (action === "disconnect") {
    await admin
      .from("organization_google_contacts_connection_tokens")
      .delete()
      .eq("organization_id", organizationId);
    await admin
      .from("organization_google_contacts_connections")
      .upsert(
        {
          organization_id: organizationId,
          is_active: false,
          oauth_connected_at: null,
          google_account_email: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id" },
      );
    return googleContactsJson({ ok: true }, 200);
  }

  if (action === "enqueueBackfill") {
    const { data: leads, error: leadsErr } = await admin
      .from("leads")
      .select("id, phone_number")
      .eq("organization_id", organizationId)
      .not("phone_number", "is", null)
      .neq("phone_number", "")
      .limit(2000);

    if (leadsErr) {
      return googleContactsJson({ error: leadsErr.message }, 500);
    }

    let enqueued = 0;
    for (const lead of leads ?? []) {
      const { data: ok } = await admin.rpc("enqueue_google_contacts_sync", {
        p_organization_id: organizationId,
        p_lead_id: lead.id,
        p_reason: "backfill",
      });
      if (ok) enqueued += 1;
    }

    // Kick worker (best-effort)
    try {
      await fetch(`${supabaseUrl.replace(/\/+$/, "")}/functions/v1/google-contacts-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ action: "processJobs", organization_id: organizationId }),
      });
    } catch (e) {
      console.error("google-contacts-config kick sync:", e);
    }

    return googleContactsJson({ ok: true, enqueued }, 200);
  }

  return googleContactsJson({ error: "Unknown action" }, 400);
});
