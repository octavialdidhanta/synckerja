/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  BLIBLI_CHAT_IFRAME_SESSION_HOURS,
  BLIBLI_CHAT_OTT_RATE_LIMIT_PER_HOUR,
  blibliSellerCorsHeaders,
  blibliSellerJson,
  getUserFromBearer,
  requireActiveOrg,
  requireBlibliPlatformConfigured,
  requireOrgMember,
} from "../_shared/blibliSeller/blibliSellerAuth.ts";
import { decryptBlibliSecret } from "../_shared/blibliSeller/blibliSellerCrypto.ts";
import { mintBlibliChatOtt } from "../_shared/blibliSeller/blibliSellerChatOtt.ts";
import { mapBlibliOttErrorCode } from "../_shared/blibliSeller/blibliOttErrorMap.ts";
import {
  countEventsInWindow,
  isBlibliOttRateLimited,
  retryAfterSecondsForWindow,
} from "../_shared/blibliSeller/blibliOttRateLimit.ts";

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

  const action = String(body.action ?? "mintOtt").trim();
  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) return blibliSellerJson({ error: "Missing organization_id" }, 400);

  const orgForbidden = await requireActiveOrg(admin, userRes.userId, organizationId);
  if (orgForbidden) return orgForbidden;

  const memberForbidden = await requireOrgMember(admin, userRes.userId, organizationId);
  if (memberForbidden) return memberForbidden;

  if (action !== "mintOtt") {
    return blibliSellerJson({ error: `Unknown action: ${action}` }, 400);
  }

  const platformForbidden = requireBlibliPlatformConfigured();
  if (platformForbidden) return platformForbidden;

  const connectionIdHint = String(body.connection_id ?? "").trim();

  let connQuery = admin
    .from("organization_blibli_seller_connections")
    .select("id, store_code, store_id, username, is_default, status")
    .eq("organization_id", organizationId)
    .eq("status", "active");

  if (connectionIdHint) {
    connQuery = connQuery.eq("id", connectionIdHint);
  } else {
    connQuery = connQuery.order("is_default", { ascending: false }).order("created_at", {
      ascending: true,
    });
  }

  const { data: connections, error: connErr } = await connQuery.limit(1);
  if (connErr) return blibliSellerJson({ error: connErr.message }, 500);

  const connection = (connections ?? [])[0] as
    | {
      id: string;
      store_code: string;
      store_id: number;
      username: string;
    }
    | undefined;

  if (!connection) {
    return blibliSellerJson(
      { error: "No active Blibli store connection", code: "NOT_CONNECTED" },
      400,
    );
  }

  const { data: tokenRow, error: tokErr } = await admin
    .from("organization_blibli_seller_connection_tokens")
    .select("api_seller_key_enc, signature_key_enc")
    .eq("connection_id", connection.id)
    .maybeSingle();

  if (tokErr || !tokenRow?.api_seller_key_enc) {
    return blibliSellerJson(
      { error: "Blibli API Seller Key is missing. Reconnect the store.", code: "NOT_CONNECTED" },
      400,
    );
  }

  const nowMs = Date.now();
  const windowStartIso = new Date(nowMs - 60 * 60 * 1000).toISOString();
  const { data: mintRows } = await admin
    .from("blibli_seller_chat_ott_mints")
    .select("created_at")
    .eq("connection_id", connection.id)
    .gte("created_at", windowStartIso)
    .order("created_at", { ascending: true });

  const mintTimestamps = (mintRows ?? []).map((r) => String((r as { created_at: string }).created_at));
  const mintCount = countEventsInWindow(mintTimestamps, nowMs);
  if (isBlibliOttRateLimited(mintCount, BLIBLI_CHAT_OTT_RATE_LIMIT_PER_HOUR)) {
    const retryAfterSeconds = retryAfterSecondsForWindow(mintTimestamps[0], nowMs);
    return blibliSellerJson(
      {
        error:
          "Blibli OTT rate limit reached (10 requests per hour per store). Try again later or reuse the open chat session.",
        code: "RATE_LIMIT",
        retryAfterSeconds,
      },
      429,
    );
  }

  let apiSellerKey: string;
  let signatureKey: string | null = null;
  try {
    apiSellerKey = await decryptBlibliSecret(String(tokenRow.api_seller_key_enc));
    if (tokenRow.signature_key_enc) {
      signatureKey = await decryptBlibliSecret(String(tokenRow.signature_key_enc));
    }
  } catch (e) {
    return blibliSellerJson(
      {
        error: e instanceof Error ? e.message : "Failed to decrypt store credentials",
        code: "DECRYPT_FAILED",
      },
      500,
    );
  }

  const mint = await mintBlibliChatOtt({
    storeCode: connection.store_code,
    storeId: Number(connection.store_id),
    username: connection.username,
    apiSellerKey,
    signatureKey,
  });

  const nowIso = new Date().toISOString();

  if (!mint.ok) {
    await admin
      .from("organization_blibli_seller_connections")
      .update({
        last_mint_at: nowIso,
        last_mint_ok: false,
        last_mint_error: mint.errorMessage.slice(0, 500),
        updated_at: nowIso,
      })
      .eq("id", connection.id);

    const status = mint.status >= 400 && mint.status < 600 ? mint.status : 502;
    return blibliSellerJson(
      {
        error: mint.errorMessage,
        code: mapBlibliOttErrorCode(mint),
        requestId: mint.requestId,
      },
      status === 401 || status === 403 ? status : status >= 500 ? 502 : 400,
    );
  }

  await admin.from("blibli_seller_chat_ott_mints").insert({
    connection_id: connection.id,
    organization_id: organizationId,
    created_at: nowIso,
  });

  await admin
    .from("organization_blibli_seller_connections")
    .update({
      last_mint_at: nowIso,
      last_mint_ok: true,
      last_mint_error: null,
      updated_at: nowIso,
    })
    .eq("id", connection.id);

  // Prune mint logs older than 24h (best-effort)
  const pruneBefore = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
  await admin.from("blibli_seller_chat_ott_mints").delete().lt("created_at", pruneBefore);

  return blibliSellerJson(
    {
      iframeUrl: mint.iframeUrl,
      sessionHintHours: BLIBLI_CHAT_IFRAME_SESSION_HOURS,
      connectionId: connection.id,
      storeCode: connection.store_code,
      requestId: mint.requestId,
      mintedAt: nowIso,
    },
    200,
  );
});
