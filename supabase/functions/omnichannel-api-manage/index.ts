/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  generateApiTokenPlaintext,
  hashApiToken,
  computeTokenExpiresAt,
  isOmnichannelApiTokenExpired,
} from "../_shared/omnichannelPublicApi/auth.ts";
import { isValidWebId, normalizeWebId } from "../_shared/omnichannelPublicApi/urlParams.ts";

const MAX_ACTIVE_TOKENS_PER_ORG = 50;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireOrgAdmin(
  admin: ReturnType<typeof createClient>,
  userId: string,
  organizationId: string,
): Promise<Response | null> {
  const { data: profile } = await admin
    .from("profiles")
    .select("active_organization_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (profile?.active_organization_id !== organizationId) {
    return json({ success: false, error: "Organisasi tidak aktif.", code: "FORBIDDEN" }, 403);
  }

  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  const role = String(roleRow?.role ?? "").toLowerCase();
  if (!["owner", "admin"].includes(role)) {
    return json({ success: false, error: "Hanya owner/admin.", code: "FORBIDDEN" }, 403);
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return json({ error: "Server misconfigured" }, 503);

  const admin = createClient(supabaseUrl, serviceKey);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) return json({ error: "Unauthorized" }, 401);

  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user) return json({ error: "Invalid token" }, 401);

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const organizationId = String(body.organizationId ?? "").trim();
  if (!organizationId) return json({ error: "organizationId wajib." }, 400);

  const adminErr = await requireOrgAdmin(admin, userRes.user.id, organizationId);
  if (adminErr) return adminErr;

  const action = String(body.action ?? "").trim();

  if (action === "listTokens") {
    const { data, error } = await admin
      .from("organization_omnichannel_api_tokens")
      .select(
        "id, label, web_id, token_prefix, allowed_origins, whatsapp_invoice_template_name, is_active, expires_at, last_used_at, revoked_at, created_at",
      )
      .eq("organization_id", organizationId)
      .order("is_active", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) return json({ success: false, error: error.message }, 500);
    return json({ success: true, tokens: data ?? [] });
  }

  if (action === "revokeToken") {
    const tokenId = String(body.tokenId ?? "").trim();
    if (!tokenId) return json({ error: "tokenId wajib." }, 400);

    const { data: existing, error: fetchErr } = await admin
      .from("organization_omnichannel_api_tokens")
      .select("id, is_active")
      .eq("id", tokenId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (fetchErr) return json({ success: false, error: fetchErr.message }, 500);
    if (!existing) return json({ success: false, error: "Token tidak ditemukan." }, 404);

    if (!existing.is_active) {
      return json({ success: true });
    }

    const { error } = await admin
      .from("organization_omnichannel_api_tokens")
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: userRes.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tokenId)
      .eq("organization_id", organizationId);

    if (error) return json({ success: false, error: error.message }, 500);
    return json({ success: true });
  }

  if (action === "getSettings") {
    const { data } = await admin
      .from("organization_omnichannel_api_settings")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();

    return json({
      success: true,
      settings: data ?? {
        organization_id: organizationId,
        default_whatsapp_invoice_template_name: null,
        offline_conversion_enabled: true,
      },
    });
  }

  if (action === "updateSettings") {
    const patch = {
      organization_id: organizationId,
      default_whatsapp_invoice_template_name:
        body.default_whatsapp_invoice_template_name != null
          ? String(body.default_whatsapp_invoice_template_name).trim() || null
          : null,
      offline_conversion_enabled: body.offline_conversion_enabled !== false,
      updated_at: new Date().toISOString(),
    };

    const { error } = await admin.from("organization_omnichannel_api_settings").upsert(patch, {
      onConflict: "organization_id",
    });
    if (error) return json({ success: false, error: error.message }, 500);
    return json({ success: true, settings: patch });
  }

  if (action === "createToken") {
    const webId = normalizeWebId(String(body.web_id ?? ""));
    if (!isValidWebId(webId)) {
      return json({
        success: false,
        error: "web_id tidak valid (lowercase, alphanumeric + hyphen, min 3 karakter).",
      }, 422);
    }

    const label = body.label != null ? String(body.label).trim() : null;
    const allowedOrigins = Array.isArray(body.allowed_origins)
      ? (body.allowed_origins as unknown[]).map((o) => String(o).trim()).filter(Boolean)
      : [];

    let expiresAt: string | null = null;
    if (body.expires_at) {
      const parsed = new Date(String(body.expires_at));
      if (Number.isNaN(parsed.getTime())) {
        return json({ success: false, error: "expires_at tidak valid." }, 422);
      }
      expiresAt = parsed.toISOString();
    } else if (body.expires_in_days != null && body.expires_in_days !== "") {
      const days = Number(body.expires_in_days);
      if (!Number.isFinite(days) || days <= 0) {
        return json({
          success: false,
          error: "expires_in_days harus angka positif (mis. 30, 90, 365).",
        }, 422);
      }
      expiresAt = computeTokenExpiresAt(days);
    }

    const { data: activeRows, error: activeCountErr } = await admin
      .from("organization_omnichannel_api_tokens")
      .select("id, expires_at")
      .eq("organization_id", organizationId)
      .eq("is_active", true);

    if (activeCountErr) {
      return json({ success: false, error: activeCountErr.message }, 500);
    }

    const activeCount = (activeRows ?? []).filter(
      (row) => !isOmnichannelApiTokenExpired(row.expires_at as string | null),
    ).length;

    if (activeCount >= MAX_ACTIVE_TOKENS_PER_ORG) {
      return json({
        success: false,
        error: `Batas token aktif tercapai (maks. ${MAX_ACTIVE_TOKENS_PER_ORG} per organisasi). Cabut token yang tidak dipakai.`,
        code: "LIMIT_EXCEEDED",
      }, 422);
    }

    const plaintext = generateApiTokenPlaintext();
    const tokenHash = await hashApiToken(plaintext);
    const tokenPrefix = plaintext.slice(0, 16);

    await admin.rpc("ensure_analytics_web_access_for_org", {
      p_organization_id: organizationId,
      p_web_id: webId,
      p_created_by: userRes.user.id,
    });

    const { data: inserted, error } = await admin
      .from("organization_omnichannel_api_tokens")
      .insert({
        organization_id: organizationId,
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
        label,
        web_id: webId,
        allowed_origins: allowedOrigins,
        whatsapp_invoice_template_name:
          body.whatsapp_invoice_template_name != null
            ? String(body.whatsapp_invoice_template_name).trim() || null
            : null,
        expires_at: expiresAt,
        created_by: userRes.user.id,
      })
      .select("id, web_id, token_prefix, label, allowed_origins, expires_at, created_at")
      .single();

    if (error) return json({ success: false, error: error.message }, 500);

    return json({
      success: true,
      token: inserted,
      plaintext_token: plaintext,
      message: "Simpan token ini — hanya ditampilkan sekali.",
    });
  }

  return json({ error: "Unknown action" }, 400);
});
