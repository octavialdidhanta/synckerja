/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateOmnichannelApiToken } from "../_shared/omnichannelPublicApi/auth.ts";
import { apiError } from "../_shared/omnichannelPublicApi/response.ts";
import { buildCorsHeaders } from "../_shared/omnichannelPublicApi/response.ts";
import {
  handleClickEvents,
  handlePageViewHeartbeat,
  handleTrafficLogs,
  handleWaLinkClicks,
} from "./handlers/analyticsHandlers.ts";
import { handleLeads } from "./handlers/leadsHandler.ts";
import { handleInvoiceTrigger } from "./handlers/invoiceHandler.ts";

function normalizePath(pathname: string): string {
  const stripped = pathname
    .replace(/^\/functions\/v1\/omnichannel-public-api/, "")
    .replace(/^\/omnichannel-public-api/, "");
  return stripped.endsWith("/") && stripped.length > 1 ? stripped.slice(0, -1) : stripped;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const preflightCors = buildCorsHeaders(origin, []);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: preflightCors });
  }

  if (req.method !== "POST") {
    return apiError("Metode tidak diizinkan.", "VALIDATION_ERROR", 405, preflightCors);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    return apiError("Server belum dikonfigurasi.", "INTERNAL_ERROR", 503, preflightCors);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const authResult = await authenticateOmnichannelApiToken(admin, req);
  if ("error" in authResult) return authResult.error;

  const { ctx, corsHeaders } = authResult;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("Body JSON tidak valid.", "VALIDATION_ERROR", 400, corsHeaders);
  }

  const path = normalizePath(new URL(req.url).pathname);

  switch (path) {
    case "/api/v1/traffic-logs":
      return handleTrafficLogs(admin, ctx, body, corsHeaders);
    case "/api/v1/page-views/heartbeat":
      return handlePageViewHeartbeat(admin, ctx, body, corsHeaders);
    case "/api/v1/click-events":
      return handleClickEvents(admin, ctx, body, corsHeaders);
    case "/api/v1/wa-link-clicks":
      return handleWaLinkClicks(admin, ctx, body, corsHeaders);
    case "/api/v1/leads":
      return handleLeads(admin, ctx, body, corsHeaders);
    case "/api/v1/orders/invoice-trigger":
      return handleInvoiceTrigger(admin, ctx, body, corsHeaders, supabaseUrl, serviceKey);
    default:
      return apiError("Endpoint tidak ditemukan.", "NOT_FOUND", 404, corsHeaders, { path });
  }
});
