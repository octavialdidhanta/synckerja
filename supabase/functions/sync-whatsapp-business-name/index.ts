import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const META_GRAPH_VERSION = "v21.0";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseWithUser = createClient(supabaseUrl, serviceRoleKey, { global: { headers: { Authorization: authHeader } } });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabaseWithUser.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({})) as { phone_number_id?: string };
    const bodyPhoneNumberId = body?.phone_number_id != null ? String(body.phone_number_id).trim() || null : null;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_organization_id")
      .eq("user_id", user.id)
      .single();

    let orgId = profile?.active_organization_id ?? null;

    const { data: userOrgs } = await supabaseAdmin
      .from("user_organizations")
      .select("organization_id")
      .eq("user_id", user.id);
    const orgIds = (userOrgs ?? []).map((r: { organization_id: string }) => r.organization_id);

    let config: { meta_access_token: string; phone_number_id: string; whatsapp_business_account_id?: string } | null = null;
    let resolvedOrgId: string | null = null;

    const tryAccount = async (oid: string, pnId: string | null) => {
      const base = supabaseAdmin
        .from("organization_whatsapp_accounts")
        .select("meta_access_token, phone_number_id, whatsapp_business_account_id")
        .eq("organization_id", oid)
        .eq("is_active", true);
      const q = pnId ? base.eq("phone_number_id", pnId) : base.limit(1);
      const { data: rows, error } = await q;
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!error && row?.phone_number_id) {
        let accessToken = (row.meta_access_token ?? "").trim();
        if (!accessToken) {
          const { data: orgMeta } = await supabaseAdmin.from("organization_meta_config").select("meta_access_token").eq("organization_id", oid).maybeSingle();
          accessToken = (orgMeta?.meta_access_token ?? "").trim();
        }
        if (accessToken) return { config: { ...row, meta_access_token: accessToken }, orgId: oid };
      }
      return null;
    };

    if (bodyPhoneNumberId && orgIds.length > 0) {
      if (orgId) {
        const current = await tryAccount(orgId, bodyPhoneNumberId);
        if (current) {
          config = current.config;
          resolvedOrgId = current.orgId;
        }
      }
      if (!config) {
        for (const oid of orgIds) {
          if (oid === orgId) continue;
          const current = await tryAccount(oid, bodyPhoneNumberId);
          if (current) {
            config = current.config;
            resolvedOrgId = current.orgId;
            if (!orgId) {
              await supabaseAdmin.from("profiles").update({ active_organization_id: oid }).eq("user_id", user.id);
              orgId = oid;
            }
            break;
          }
        }
      }
    }
    if (!config && orgId) {
      const current = await tryAccount(orgId, null);
      if (current) {
        config = current.config;
        resolvedOrgId = current.orgId;
      }
    }
    if (!config && orgIds.length > 0) {
      for (const oid of orgIds) {
        if (oid === orgId) continue;
        const current = await tryAccount(oid, null);
        if (current) {
          config = current.config;
          resolvedOrgId = current.orgId;
          if (!orgId) {
            await supabaseAdmin.from("profiles").update({ active_organization_id: oid }).eq("user_id", user.id);
            orgId = oid;
          }
          break;
        }
      }
    }
    if (!config || !resolvedOrgId) {
      const hint = !bodyPhoneNumberId
        ? "Kirim phone_number_id di body (dari akun yang terhubung)."
        : orgIds.length === 0
          ? "User belum tergabung organisasi. Pilih organisasi di pengaturan."
          : "Akun WhatsApp tidak ditemukan untuk organisasi Anda. Pastikan akun sudah tersimpan di halaman Connect.";
      return new Response(
        JSON.stringify({ error: "WhatsApp not configured or missing Phone Number ID", hint }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    orgId = resolvedOrgId;

    const accessToken = config.meta_access_token.trim();
    const phoneNumberId = config.phone_number_id.trim();
    const wabaId = config.whatsapp_business_account_id?.trim() || "";

    // 1) GET phone number with explicit fields so name_status is always returned (Meta: APPROVED / DECLINED / PENDING)
    const fields = "verified_name,display_phone_number,name_status";
    const metaUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}?fields=${encodeURIComponent(fields)}`;
    const metaRes = await fetch(metaUrl, {
      method: "GET",
      headers: { "Authorization": `Bearer ${accessToken}` },
    });

    const metaData = await metaRes.json().catch(() => ({})) as {
      verified_name?: string;
      name_status?: string;
      display_phone_number?: string | number;
      error?: { message?: string };
    };

    if (!metaRes.ok) {
      const metaError = metaData?.error as { message?: string; code?: number; error_subcode?: number } | undefined;
      const msg = metaError?.message ?? (metaData?.error as { message?: string })?.message ?? "Meta API error";
      const code = metaError?.code;
      const subcode = metaError?.error_subcode;
      const userHint =
        code === 100 && (subcode === 33 || /does not exist|missing permissions|does not support/i.test(msg))
          ? "Phone Number ID atau token tidak valid. Periksa di Meta Business: App → WhatsApp → API Setup. Pastikan Phone Number ID dan Access Token dari App & WABA yang sama."
          : msg;
      return new Response(
        JSON.stringify({ error: userHint }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const name = typeof metaData?.verified_name === "string" ? metaData.verified_name.trim() : null;
    let nameStatusRaw: string | null = typeof metaData?.name_status === "string" ? metaData.name_status.trim() : null;
    let displayPhone: string | null = null;
    if (metaData?.display_phone_number != null) {
      const raw = metaData.display_phone_number;
      displayPhone = typeof raw === "number" ? String(raw) : (typeof raw === "string" ? raw.trim() : null);
      if (displayPhone && /^\d+$/.test(displayPhone)) displayPhone = `+${displayPhone}`;
    }

    // 2) If name_status still missing, fetch it in a second request (some API versions omit it)
    if (nameStatusRaw == null || nameStatusRaw === "") {
      const statusUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}?fields=name_status`;
      const statusRes = await fetch(statusUrl, { method: "GET", headers: { "Authorization": `Bearer ${accessToken}` } });
      const statusData = await statusRes.json().catch(() => ({})) as { name_status?: string };
      if (statusRes.ok && typeof statusData?.name_status === "string") nameStatusRaw = statusData.name_status.trim();
    }

    // Normalize name_status to uppercase (APPROVED / DECLINED / PENDING) for consistent UI
    const nameStatus = nameStatusRaw && nameStatusRaw.length > 0 ? nameStatusRaw.toUpperCase() : null;

    // 3) Fallback: if still no display_phone_number, get from WABA phone_numbers list
    if (!displayPhone && wabaId) {
      const listUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(wabaId)}/phone_numbers`;
      const listRes = await fetch(listUrl, {
        method: "GET",
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
      const listData = await listRes.json().catch(() => ({})) as {
        data?: Array<{ id?: string; display_phone_number?: string }>;
        error?: { message?: string };
      };
      if (listRes.ok && Array.isArray(listData?.data)) {
        const match = listData.data.find((p: { id?: string }) => p.id === phoneNumberId);
        const raw = match?.display_phone_number;
        if (raw != null) {
          displayPhone = typeof raw === "string" ? raw.trim() : String(raw);
          if (displayPhone && /^\d+$/.test(displayPhone)) displayPhone = `+${displayPhone}`;
        }
      }
    }

    if (!name) {
      return new Response(JSON.stringify({ error: "Meta did not return verified_name for this phone number" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updatePayload: Record<string, unknown> = {
      whatsapp_business_name: name,
      name_status: nameStatus,
      updated_at: new Date().toISOString(),
    };
    if (displayPhone) updatePayload.display_phone_number = displayPhone;

    const { error: updateError } = await supabaseAdmin
      .from("organization_whatsapp_accounts")
      .update(updatePayload)
      .eq("organization_id", orgId)
      .eq("phone_number_id", phoneNumberId);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to update name" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, name }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("sync-whatsapp-business-name error:", err);
    return new Response(
      JSON.stringify({ error: "Sync failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
