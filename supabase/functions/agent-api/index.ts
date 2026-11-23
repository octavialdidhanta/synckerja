/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractAgentToken, parseAuthRow, parseHeartbeat, routePath, sha256Hex } from "./logic.ts";

/**
 * API for the Synckerja Agent (laptop program). Spec: github.com/octavialdidhanta/synckerja-agent SPEC.md.
 *
 * Auth: Authorization: Bearer sk_agent_<prefix>_<secret> (created in Office → Settings → Agent).
 * The organization always comes from the token, never from the request.
 * Server-to-server only: requests carrying a browser Origin are refused.
 *
 *   GET  /v1/whoami      → organization, scopes, token expiry
 *   POST /v1/heartbeat   → { device_name, agent_version, platform, tools, last_error } + X-Agent-Device: <uuid>
 */

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function fail(status: number, code: string, message: string): Response {
  return json({ ok: false, code, message }, status);
}

Deno.serve(async (req) => {
  if (req.headers.get("Origin")) {
    return fail(403, "browser_request_rejected", "agent-api hanya untuk program Agent, bukan browser.");
  }

  const token = extractAgentToken(req.headers.get("Authorization"));
  if (!token) return fail(401, "unauthorized", "Token Agent tidak ada atau formatnya salah.");

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: authRow, error: authError } = await admin.rpc("agent_auth", { p_token_hash: await sha256Hex(token) });
  if (authError) {
    console.error("agent_auth failed", authError.message);
    return fail(500, "internal_error", "Gagal cek token.");
  }
  const ctx = parseAuthRow(authRow);
  if (!ctx) return fail(401, "unauthorized", "Token Agent tidak dikenali, dicabut, atau kadaluarsa.");

  const path = routePath(new URL(req.url).pathname);

  try {
    if (req.method === "GET" && path === "/v1/whoami") {
      const { data: org } = await admin.from("organizations").select("name").eq("id", ctx.organizationId).maybeSingle();
      return json({
        ok: true,
        organization_id: ctx.organizationId,
        organization_name: (org as { name?: string } | null)?.name ?? null,
        scopes: ctx.scopes,
        expires_at: ctx.expiresAt,
      });
    }

    if (req.method === "POST" && path === "/v1/heartbeat") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return fail(400, "invalid_json", "Body harus JSON.");
      }
      const parsed = parseHeartbeat(body, req.headers.get("X-Agent-Device"));
      if (!parsed.ok) return fail(400, "invalid_input", parsed.error);
      const h = parsed.value;
      const { data, error } = await admin.rpc("agent_heartbeat", {
        p_token_id: ctx.tokenId,
        p_device_key: h.deviceKey,
        p_name: h.name,
        p_agent_version: h.agentVersion,
        p_platform: h.platform,
        p_tools: h.tools,
        p_last_error: h.lastError,
      });
      if (error) {
        if (error.message.includes("token_inactive")) return fail(401, "unauthorized", "Token sudah tidak aktif.");
        if (error.message.includes("invalid_input")) return fail(400, "invalid_input", "Data heartbeat tidak valid.");
        console.error("agent_heartbeat failed", error.message);
        return fail(500, "internal_error", "Gagal simpan heartbeat.");
      }
      return json({ ok: true, ...(data as Record<string, unknown>) });
    }

    return fail(404, "not_found", `Endpoint ${req.method} ${path} tidak ada.`);
  } catch (e) {
    console.error("agent-api error", e instanceof Error ? e.message : String(e));
    return fail(500, "internal_error", "Terjadi kesalahan.");
  }
});
