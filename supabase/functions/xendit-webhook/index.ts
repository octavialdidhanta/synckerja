/// <reference path="../edge-runtime.d.ts" />
/**
 * Deprecated: webhook handling merged into xendit-api (function quota).
 * Delete this function from Supabase Dashboard after updating Xendit webhook URL to xendit-api.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { readXenditEnv } from "../_shared/xendit/xenditEnv.ts";
import { xenditCorsHeaders } from "../_shared/xendit/xenditAuth.ts";
import { processXenditWebhook } from "../_shared/xendit/webhooks/processXenditWebhook.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: xenditCorsHeaders });
  }
  const env = readXenditEnv();
  if (!env) {
    return new Response(JSON.stringify({ error: "Xendit not configured" }), { status: 503 });
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const admin = createClient(supabaseUrl, serviceRoleKey);
  return processXenditWebhook(admin, env, req);
});
