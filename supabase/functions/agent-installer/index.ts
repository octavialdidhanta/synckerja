/**
 * Office → Content Studio → Agent → "Download installer".
 * The Agent repo is private, so the browser cannot download from GitHub itself. A signed-in user asks this
 * function, which uses the server's read-only GitHub token (AGENT_RELEASE_GITHUB_TOKEN) to get GitHub's
 * pre-signed link for Synckerja-Office.exe of the latest release. The file goes straight from GitHub to the browser.
 *
 *   POST (supabase.functions.invoke("agent-installer")) → { ok, version, url }
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AgentReleaseError, latestAgentRelease } from "../_shared/agentRelease.ts";
import { corsPreflightHeaders, jsonResponse } from "../_shared/cors.ts";
import { getRequestUser } from "../_shared/edgeCallerAuth.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsPreflightHeaders(origin) });
  if (req.method !== "POST") return jsonResponse({ ok: false, code: "method_not_allowed" }, { status: 405 }, origin);

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const user = await getRequestUser(admin, req);
  if (!user) return jsonResponse({ ok: false, code: "unauthorized", message: "Login dulu." }, { status: 401 }, origin);

  try {
    const r = await latestAgentRelease(Deno.env.get("AGENT_RELEASE_GITHUB_TOKEN") ?? "", ["installer"]);
    return jsonResponse({ ok: true, version: r.version, url: r.installerUrl }, { headers: { "Cache-Control": "no-store" } }, origin);
  } catch (e) {
    const code = e instanceof AgentReleaseError ? e.code : "internal_error";
    const message = e instanceof Error ? e.message : String(e);
    console.error("agent-installer", code, message);
    return jsonResponse({ ok: false, code, message }, { status: code === "not_configured" ? 503 : 502 }, origin);
  }
});
