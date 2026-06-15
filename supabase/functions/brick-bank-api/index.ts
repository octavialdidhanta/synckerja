/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { readBrickEnvConfig } from "../_shared/brick/brickEnv.ts";
import {
  processBrickWebhook,
  shouldHandleAsBrickWebhook,
} from "../_shared/brick/webhooks/processBrickWebhook.ts";
import {
  brickCorsHeaders,
  brickJson,
  checkBrickDisburseRateLimit,
  checkBrickSyncRateLimit,
  getUserFromBearer,
  recordBrickSyncRateLimit,
  requireActiveOrg,
  requireBrickOrgAdmin,
  shouldApplyBrickSyncRateLimit,
} from "./brickAuth.ts";
import { handleBrickCreateCloseVa } from "./handlers/createCloseVa.ts";
import { handleBrickExecuteDisbursement } from "./handlers/executeDisbursement.ts";
import { handleBrickGetBalance } from "./handlers/getBalance.ts";
import { handleBrickGetDisbursementStatus } from "./handlers/getDisbursementStatus.ts";
import { handleBrickGetVaStatus } from "./handlers/getVaStatus.ts";
import { handleBrickAccountLink } from "./handlers/link.ts";
import { handleBrickBankSync } from "./handlers/sync.ts";
import { handleBrickSimulateVa } from "./handlers/simulateVa.ts";

function normalizeBrickHandlerError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err.trim()) return err.trim();
  return "Brick API request failed";
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: brickCorsHeaders() });
    }

    if (req.method !== "POST") {
      return brickJson({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) {
      return brickJson({ error: "Server misconfigured: missing Supabase credentials" }, 503);
    }
    const admin = createClient(supabaseUrl, serviceKey);

    const rawBody = await req.text();
    let body: Record<string, unknown> = {};
    try {
      body = rawBody ? JSON.parse(rawBody) as Record<string, unknown> : {};
    } catch {
      return brickJson({ error: "Invalid JSON body" }, 400);
    }

    // Brick VA callbacks (X-SIGNATURE + payment payload) — no user JWT.
    if (shouldHandleAsBrickWebhook(req, body)) {
      const envConfig = readBrickEnvConfig();
      if (!envConfig) {
        return brickJson({ error: "Brick is not configured on server" }, 503);
      }
      return await processBrickWebhook(admin, envConfig, req, rawBody, body);
    }

    const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
    if ("error" in userRes) return userRes.error;

    const organizationId = String(body.organizationId ?? "");
    if (!organizationId) return brickJson({ error: "organizationId is required" }, 400);

    const orgErr = await requireActiveOrg(admin, userRes.userId, organizationId);
    if (orgErr) return orgErr;

    const adminErr = await requireBrickOrgAdmin(admin, userRes.userId, organizationId);
    if (adminErr) return adminErr;

    const action = String(body.action ?? "").trim();

    if (action === "sync" || action === "syncAggregation") {
      const skipRateLimit = body.skipRateLimit === true;
      const applyRateLimit = !skipRateLimit &&
        await shouldApplyBrickSyncRateLimit(admin, organizationId);
      if (applyRateLimit) {
        const rateErr = await checkBrickSyncRateLimit(admin, organizationId);
        if (rateErr) return rateErr;
      }
      await recordBrickSyncRateLimit(admin, organizationId);
      return await handleBrickBankSync(admin, body);
    }

    if (action === "link" || action === "unlink" || action === "status" || action === "oauthStart") {
      return await handleBrickAccountLink(admin, body, userRes.userId);
    }

    if (action === "simulateVa") {
      return await handleBrickSimulateVa(body);
    }

    if (action === "createCloseVa") {
      return await handleBrickCreateCloseVa(admin, body);
    }

    if (action === "getVaStatus") {
      return await handleBrickGetVaStatus(admin, body);
    }

    if (action === "executeDisbursement") {
      const rateErr = await checkBrickDisburseRateLimit(admin, organizationId);
      if (rateErr) return rateErr;
      return await handleBrickExecuteDisbursement(admin, userRes.userId, body);
    }

    if (action === "getDisbursementStatus") {
      return await handleBrickGetDisbursementStatus(admin, body);
    }

    if (action === "getBalance") {
      return await handleBrickGetBalance(admin, body);
    }

    return brickJson({
      error: "Unknown action. Use link, oauthStart, unlink, status, sync, syncAggregation, simulateVa, createCloseVa, getVaStatus, executeDisbursement, getDisbursementStatus, or getBalance.",
    }, 400);
  } catch (err) {
    console.error("brick-bank-api:", err);
    return brickJson({ error: normalizeBrickHandlerError(err) }, 500);
  }
});
