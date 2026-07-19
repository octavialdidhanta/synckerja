/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  blibliSellerCorsHeaders,
  blibliSellerJson,
  getUserFromBearer,
  requireActiveOrg,
  requireBlibliPlatformConfigured,
  requireOrgMember,
} from "../_shared/blibliSeller/blibliSellerAuth.ts";
import { decryptBlibliSecret } from "../_shared/blibliSeller/blibliSellerCrypto.ts";
import {
  filterOrderPackages,
  mapBlibliOrderErrorCode,
  type BlibliOrderPackagesFilterBody,
} from "../_shared/blibliSeller/blibliSellerOrdersApi.ts";
import {
  BLIBLI_ORDER_RATE_LIMIT,
  BLIBLI_ORDER_RATE_WINDOW_MS,
  countEventsInWindow,
  isBlibliOrderRateLimited,
  retryAfterSecondsForWindow,
} from "../_shared/blibliSeller/blibliOrderRateLimit.ts";

const STATUS_TAB_CODES: Record<string, string[] | undefined> = {
  all: undefined,
  new: ["FP"],
  in_process: ["PU", "CX", "BP"],
  delivered: ["D"],
  cancel: ["X", "OS", "CR"],
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

  const action = String(body.action ?? "listPackages").trim();
  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) return blibliSellerJson({ error: "Missing organization_id" }, 400);

  const orgForbidden = await requireActiveOrg(admin, userRes.userId, organizationId);
  if (orgForbidden) return orgForbidden;

  const memberForbidden = await requireOrgMember(admin, userRes.userId, organizationId);
  if (memberForbidden) return memberForbidden;

  const platformForbidden = requireBlibliPlatformConfigured();
  if (platformForbidden) return platformForbidden;

  if (action !== "listPackages" && action !== "getStatusCounts") {
    return blibliSellerJson({ error: `Unknown action: ${action}` }, 400);
  }

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
    | { id: string; store_code: string; store_id: number; username: string }
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

  async function gateRateLimit(): Promise<Response | null> {
    const nowMs = Date.now();
    const windowStartIso = new Date(nowMs - BLIBLI_ORDER_RATE_WINDOW_MS).toISOString();
    const { data: callRows } = await admin
      .from("blibli_seller_order_api_calls")
      .select("created_at")
      .eq("connection_id", connection!.id)
      .gte("created_at", windowStartIso)
      .order("created_at", { ascending: true });

    const stamps = (callRows ?? []).map((r) => String((r as { created_at: string }).created_at));
    const count = countEventsInWindow(stamps, nowMs);
    if (isBlibliOrderRateLimited(count, BLIBLI_ORDER_RATE_LIMIT)) {
      return blibliSellerJson(
        {
          error:
            "Blibli order API rate limit reached (100 requests per 30 minutes per store). Try again later.",
          code: "RATE_LIMIT",
          retryAfterSeconds: retryAfterSecondsForWindow(stamps[0], nowMs),
        },
        429,
      );
    }
    return null;
  }

  async function loadSecrets(): Promise<
    { apiSellerKey: string; signatureKey: string | null } | { error: Response }
  > {
    try {
      const apiSellerKey = await decryptBlibliSecret(String(tokenRow!.api_seller_key_enc));
      let signatureKey: string | null = null;
      if (tokenRow!.signature_key_enc) {
        signatureKey = await decryptBlibliSecret(String(tokenRow!.signature_key_enc));
      }
      return { apiSellerKey, signatureKey };
    } catch (e) {
      return {
        error: blibliSellerJson(
          {
            error: e instanceof Error ? e.message : "Failed to decrypt store credentials",
            code: "DECRYPT_FAILED",
          },
          500,
        ),
      };
    }
  }

  async function recordCall(actionName: string) {
    const nowIso = new Date().toISOString();
    await admin.from("blibli_seller_order_api_calls").insert({
      connection_id: connection!.id,
      organization_id: organizationId,
      action: actionName,
      created_at: nowIso,
    });
    const pruneBefore = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await admin.from("blibli_seller_order_api_calls").delete().lt("created_at", pruneBefore);
  }

  function normalizeFilterBody(raw: unknown): BlibliOrderPackagesFilterBody {
    const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const filter = (src.filter && typeof src.filter === "object"
      ? { ...(src.filter as Record<string, unknown>) }
      : {}) as Record<string, unknown>;
    const sorting = (src.sorting && typeof src.sorting === "object"
      ? { ...(src.sorting as Record<string, unknown>) }
      : { by: "statusFPUpdatedTimestamp", direction: "DESC" }) as {
      by?: string;
      direction?: string;
    };
    let page = Number((src.paging as { page?: number } | undefined)?.page ?? 0);
    let size = Number((src.paging as { size?: number } | undefined)?.size ?? 20);
    if (!Number.isFinite(page) || page < 0) page = 0;
    if (!Number.isFinite(size) || size < 1) size = 20;
    if (size > 50) size = 50;
    return {
      filter,
      sorting: {
        by: String(sorting.by ?? "statusFPUpdatedTimestamp"),
        direction: String(sorting.direction ?? "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC",
      },
      paging: { page, size },
    };
  }

  if (action === "getStatusCounts") {
    const limited = await gateRateLimit();
    if (limited) return limited;
    // getStatusCounts may need up to 5 calls — check capacity first
    const nowMs = Date.now();
    const windowStartIso = new Date(nowMs - BLIBLI_ORDER_RATE_WINDOW_MS).toISOString();
    const { data: callRows } = await admin
      .from("blibli_seller_order_api_calls")
      .select("created_at")
      .eq("connection_id", connection.id)
      .gte("created_at", windowStartIso);
    const used = countEventsInWindow(
      (callRows ?? []).map((r) => String((r as { created_at: string }).created_at)),
      nowMs,
    );
    if (used + 5 > BLIBLI_ORDER_RATE_LIMIT) {
      return blibliSellerJson(
        {
          error: "Not enough Blibli API quota left for status counts. Try again later.",
          code: "RATE_LIMIT",
          retryAfterSeconds: retryAfterSecondsForWindow(
            (callRows ?? [])[0]
              ? String((callRows![0] as { created_at: string }).created_at)
              : null,
            nowMs,
          ),
        },
        429,
      );
    }

    const secrets = await loadSecrets();
    if ("error" in secrets) return secrets.error;

    const baseFilter = normalizeFilterBody(body.request_body ?? body).filter ?? {};
    const dateRange = body.status_fp_date_range ?? baseFilter.statusFPDateRange;
    const counts: Record<string, number> = {};

    for (const tab of Object.keys(STATUS_TAB_CODES)) {
      const statuses = STATUS_TAB_CODES[tab];
      const filter: Record<string, unknown> = { ...baseFilter };
      if (dateRange && typeof dateRange === "object") {
        filter.statusFPDateRange = dateRange;
      }
      if (statuses) filter.orderItemStatuses = statuses;
      else delete filter.orderItemStatuses;

      const result = await filterOrderPackages({
        storeCode: connection.store_code,
        storeId: Number(connection.store_id),
        username: connection.username,
        apiSellerKey: secrets.apiSellerKey,
        signatureKey: secrets.signatureKey,
        body: {
          filter,
          sorting: { by: "statusFPUpdatedTimestamp", direction: "DESC" },
          paging: { page: 0, size: 1 },
        },
      });
      await recordCall("getStatusCounts");
      counts[tab] = result.ok ? result.paging.totalRecord : 0;
    }

    return blibliSellerJson(
      {
        counts,
        connectionId: connection.id,
        storeCode: connection.store_code,
      },
      200,
    );
  }

  // listPackages
  {
    const limited = await gateRateLimit();
    if (limited) return limited;

    const secrets = await loadSecrets();
    if ("error" in secrets) return secrets.error;

    const requestBody = normalizeFilterBody(body.request_body ?? {
      filter: body.filter,
      sorting: body.sorting,
      paging: body.paging,
    });

    // Allow status_tab shortcut from FE
    const statusTab = String(body.status_tab ?? "").trim();
    if (statusTab && statusTab in STATUS_TAB_CODES) {
      const codes = STATUS_TAB_CODES[statusTab];
      if (!requestBody.filter) requestBody.filter = {};
      if (codes) requestBody.filter.orderItemStatuses = codes;
      else delete requestBody.filter.orderItemStatuses;
    }

    const result = await filterOrderPackages({
      storeCode: connection.store_code,
      storeId: Number(connection.store_id),
      username: connection.username,
      apiSellerKey: secrets.apiSellerKey,
      signatureKey: secrets.signatureKey,
      body: requestBody,
    });

    await recordCall("listPackages");

    if (!result.ok) {
      const status = result.status >= 400 && result.status < 600 ? result.status : 502;
      return blibliSellerJson(
        {
          error: result.errorMessage,
          code: mapBlibliOrderErrorCode(result.errorCode, result.status),
          requestId: result.requestId,
        },
        status === 401 || status === 403 ? status : status >= 500 ? 502 : 400,
      );
    }

    return blibliSellerJson(
      {
        packages: result.packages,
        paging: result.paging,
        requestId: result.requestId,
        connectionId: connection.id,
        storeCode: connection.store_code,
      },
      200,
    );
  }
});
