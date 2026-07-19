/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  blibliSellerCorsHeaders,
  blibliSellerJson,
  getUserFromBearer,
  isBlibliPlatformConfigured,
  readBlibliPlatformConfig,
  requireActiveOrg,
  requireBlibliPlatformConfigured,
  requireOrgAdmin,
  requireOrgMember,
} from "../_shared/blibliSeller/blibliSellerAuth.ts";
import { encryptBlibliSecret } from "../_shared/blibliSeller/blibliSellerCrypto.ts";

type ConnectionRow = {
  id: string;
  organization_id: string;
  store_code: string;
  store_id: number;
  username: string;
  display_name: string | null;
  is_default: boolean;
  status: string;
  last_mint_at: string | null;
  last_mint_ok: boolean | null;
  last_mint_error: string | null;
  created_at: string;
  updated_at: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: blibliSellerCorsHeaders });
  }
  if (req.method !== "POST") {
    return blibliSellerJson({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return blibliSellerJson({ error: "Server misconfigured" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
  if ("error" in userRes) return userRes.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return blibliSellerJson({ error: "Invalid JSON body" }, 400);
  }

  const action = String(body.action ?? "").trim();
  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) return blibliSellerJson({ error: "Missing organization_id" }, 400);

  const orgForbidden = await requireActiveOrg(admin, userRes.userId, organizationId);
  if (orgForbidden) return orgForbidden;

  if (action === "getSettings") {
    const memberForbidden = await requireOrgMember(admin, userRes.userId, organizationId);
    if (memberForbidden) return memberForbidden;

    const { data: connections, error } = await admin
      .from("organization_blibli_seller_connections")
      .select(
        "id, organization_id, store_code, store_id, username, display_name, is_default, status, last_mint_at, last_mint_ok, last_mint_error, created_at, updated_at",
      )
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) return blibliSellerJson({ error: error.message }, 500);

    const rows = (connections ?? []) as ConnectionRow[];
    const connectionIds = rows.map((r) => r.id);
    let hasTokens = new Set<string>();
    if (connectionIds.length > 0) {
      const { data: tokenRows } = await admin
        .from("organization_blibli_seller_connection_tokens")
        .select("connection_id, signature_key_enc")
        .in("connection_id", connectionIds);
      hasTokens = new Set((tokenRows ?? []).map((t) => String((t as { connection_id: string }).connection_id)));
      const signatureByConn = new Map(
        (tokenRows ?? []).map((t) => {
          const row = t as { connection_id: string; signature_key_enc: string | null };
          return [String(row.connection_id), Boolean(row.signature_key_enc)] as const;
        }),
      );
      const platform = readBlibliPlatformConfig();
      return blibliSellerJson(
        {
          connected: rows.some((r) => hasTokens.has(r.id)),
          connections: rows.map((r) => ({
            id: r.id,
            store_code: r.store_code,
            store_id: r.store_id,
            username: r.username,
            display_name: r.display_name,
            is_default: r.is_default,
            status: r.status,
            has_api_seller_key: hasTokens.has(r.id),
            has_signature_key: signatureByConn.get(r.id) ?? false,
            last_mint_at: r.last_mint_at,
            last_mint_ok: r.last_mint_ok,
            last_mint_error: r.last_mint_error,
            created_at: r.created_at,
            updated_at: r.updated_at,
          })),
          serverConfigured: isBlibliPlatformConfigured(),
          /** Public API Client ID for Seller API Manager bind instructions (never the client key). */
          apiClientId: platform?.apiClientId ?? null,
          channelId: platform?.channelId ?? null,
        },
        200,
      );
    }

    const platform = readBlibliPlatformConfig();
    return blibliSellerJson(
      {
        connected: false,
        connections: [],
        serverConfigured: isBlibliPlatformConfigured(),
        apiClientId: platform?.apiClientId ?? null,
        channelId: platform?.channelId ?? null,
      },
      200,
    );
  }

  const adminForbidden = await requireOrgAdmin(admin, userRes.userId, organizationId);
  if (adminForbidden) return adminForbidden;

  if (action === "connect" || action === "upsertConnection") {
    const platformForbidden = requireBlibliPlatformConfigured();
    if (platformForbidden) return platformForbidden;

    const storeCode = String(body.store_code ?? "").trim();
    const username = String(body.username ?? "").trim();
    const storeIdRaw = body.store_id;
    const storeId = typeof storeIdRaw === "number"
      ? storeIdRaw
      : Number(String(storeIdRaw ?? "").trim());
    const apiSellerKey = String(body.api_seller_key ?? "").trim();
    const signatureKeyRaw = body.signature_key != null ? String(body.signature_key).trim() : "";
    const displayName = body.display_name != null ? String(body.display_name).trim() || null : null;
    const makeDefault = body.is_default === true || body.set_default === true;

    if (!storeCode) return blibliSellerJson({ error: "Missing store_code" }, 400);
    if (!username) return blibliSellerJson({ error: "Missing username" }, 400);
    if (!Number.isFinite(storeId) || storeId <= 0) {
      return blibliSellerJson({ error: "Invalid store_id" }, 400);
    }
    if (!apiSellerKey) return blibliSellerJson({ error: "Missing api_seller_key" }, 400);

    let apiSellerKeyEnc: string;
    let signatureKeyEnc: string | null = null;
    try {
      apiSellerKeyEnc = await encryptBlibliSecret(apiSellerKey);
      if (signatureKeyRaw) signatureKeyEnc = await encryptBlibliSecret(signatureKeyRaw);
    } catch (e) {
      return blibliSellerJson(
        {
          error: e instanceof Error
            ? e.message
            : "Failed to encrypt credentials. Set BLIBLI_SELLER_CONFIG_ENCRYPTION_KEY.",
        },
        500,
      );
    }

    if (makeDefault) {
      await admin
        .from("organization_blibli_seller_connections")
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq("organization_id", organizationId)
        .eq("status", "active");
    }

    const { data: existing } = await admin
      .from("organization_blibli_seller_connections")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("store_code", storeCode)
      .maybeSingle();

    const now = new Date().toISOString();
    let connectionId: string;

    if (existing?.id) {
      connectionId = String(existing.id);
      const updatePayload: Record<string, unknown> = {
        store_id: storeId,
        username,
        display_name: displayName,
        status: "active",
        updated_at: now,
      };
      if (makeDefault) updatePayload.is_default = true;
      const { error: updErr } = await admin
        .from("organization_blibli_seller_connections")
        .update(updatePayload)
        .eq("id", connectionId);
      if (updErr) return blibliSellerJson({ error: updErr.message }, 500);

      if (makeDefault) {
        await admin
          .from("organization_blibli_seller_connections")
          .update({ is_default: true, updated_at: now })
          .eq("id", connectionId);
      }
    } else {
      const { data: activeCount } = await admin
        .from("organization_blibli_seller_connections")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("status", "active");
      const shouldDefault = makeDefault || (activeCount ?? []).length === 0;

      const { data: inserted, error: insErr } = await admin
        .from("organization_blibli_seller_connections")
        .insert({
          organization_id: organizationId,
          store_code: storeCode,
          store_id: storeId,
          username,
          display_name: displayName,
          is_default: shouldDefault,
          status: "active",
          created_by: userRes.userId,
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .single();
      if (insErr || !inserted?.id) {
        return blibliSellerJson({ error: insErr?.message ?? "Failed to create connection" }, 500);
      }
      connectionId = String(inserted.id);
    }

    const tokenPayload: Record<string, unknown> = {
      connection_id: connectionId,
      api_seller_key_enc: apiSellerKeyEnc,
      updated_at: now,
    };
    if (signatureKeyEnc !== null || signatureKeyRaw === "") {
      // Empty string clears signature; null means "leave unchanged" only when field omitted.
      if (body.signature_key !== undefined) {
        tokenPayload.signature_key_enc = signatureKeyEnc;
      }
    }

    const { data: existingToken } = await admin
      .from("organization_blibli_seller_connection_tokens")
      .select("connection_id, signature_key_enc")
      .eq("connection_id", connectionId)
      .maybeSingle();

    if (existingToken) {
      if (body.signature_key === undefined) {
        delete tokenPayload.signature_key_enc;
      }
      const { error: tokErr } = await admin
        .from("organization_blibli_seller_connection_tokens")
        .update(tokenPayload)
        .eq("connection_id", connectionId);
      if (tokErr) return blibliSellerJson({ error: tokErr.message }, 500);
    } else {
      if (tokenPayload.signature_key_enc === undefined) {
        tokenPayload.signature_key_enc = null;
      }
      const { error: tokErr } = await admin
        .from("organization_blibli_seller_connection_tokens")
        .insert(tokenPayload);
      if (tokErr) return blibliSellerJson({ error: tokErr.message }, 500);
    }

    return blibliSellerJson({ ok: true, connection_id: connectionId }, 200);
  }

  if (action === "disconnect") {
    const connectionId = String(body.connection_id ?? "").trim();
    const storeCode = String(body.store_code ?? "").trim();

    let query = admin
      .from("organization_blibli_seller_connections")
      .update({
        status: "disconnected",
        is_default: false,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("status", "active");

    if (connectionId) query = query.eq("id", connectionId);
    else if (storeCode) query = query.eq("store_code", storeCode);
    else {
      // disconnect all
    }

    const { data: disconnected, error } = await query.select("id");
    if (error) return blibliSellerJson({ error: error.message }, 500);

    const ids = (disconnected ?? []).map((r) => String((r as { id: string }).id));
    if (ids.length > 0) {
      await admin.from("organization_blibli_seller_connection_tokens").delete().in("connection_id", ids);
    }

    // Promote another active connection to default if needed
    const { data: stillActive } = await admin
      .from("organization_blibli_seller_connections")
      .select("id, is_default")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .order("created_at", { ascending: true });

    const actives = stillActive ?? [];
    if (actives.length > 0 && !actives.some((a) => (a as { is_default: boolean }).is_default)) {
      await admin
        .from("organization_blibli_seller_connections")
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq("id", String((actives[0] as { id: string }).id));
    }

    return blibliSellerJson({ ok: true }, 200);
  }

  if (action === "setDefault") {
    const connectionId = String(body.connection_id ?? "").trim();
    if (!connectionId) return blibliSellerJson({ error: "Missing connection_id" }, 400);

    const { data: row } = await admin
      .from("organization_blibli_seller_connections")
      .select("id")
      .eq("id", connectionId)
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .maybeSingle();
    if (!row) return blibliSellerJson({ error: "Connection not found" }, 404);

    const now = new Date().toISOString();
    await admin
      .from("organization_blibli_seller_connections")
      .update({ is_default: false, updated_at: now })
      .eq("organization_id", organizationId)
      .eq("status", "active");

    const { error } = await admin
      .from("organization_blibli_seller_connections")
      .update({ is_default: true, updated_at: now })
      .eq("id", connectionId);
    if (error) return blibliSellerJson({ error: error.message }, 500);
    return blibliSellerJson({ ok: true }, 200);
  }

  return blibliSellerJson({ error: `Unknown action: ${action}` }, 400);
});
