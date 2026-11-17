/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  DRIVE_MEDIA_TOKEN_TTL_SECONDS,
  getDriveMediaTokenKey,
  mintDriveMediaToken,
} from "../_shared/driveMediaToken.ts";

/**
 * Mints a short-lived, file-scoped `media_token` for google-drive-file-media / -thumbnail URLs.
 * The Supabase session is accepted ONLY in the Authorization header (never in the query string),
 * so the session JWT no longer ends up in edge-function request logs.
 *
 * POST { file_id } -> { media_token, expires_at }
 */
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const LOG_PREFIX = "google-drive-media-token";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
    if (!jwt) return json({ error: "Unauthorized" }, 401);

    let fileId = "";
    try {
      const body = (await req.json()) as { file_id?: unknown };
      fileId = typeof body.file_id === "string" ? body.file_id.trim() : "";
    } catch {
      /* invalid body */
    }
    if (!fileId || !/^[a-zA-Z0-9-_]+$/.test(fileId)) {
      return json({ error: "Invalid or missing file_id" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const key = await getDriveMediaTokenKey();
    if (!supabaseUrl || !serviceRoleKey || !key) {
      console.error(`${LOG_PREFIX}: server misconfigured`);
      return json({ error: "Server configuration error" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(jwt);
    if (error || !user) return json({ error: "Invalid or expired session" }, 401);

    const { token, expiresAt } = await mintDriveMediaToken(
      key,
      user.id,
      fileId,
      DRIVE_MEDIA_TOKEN_TTL_SECONDS,
    );
    return json({ media_token: token, expires_at: expiresAt });
  } catch (e) {
    console.error(`${LOG_PREFIX}:`, (e as Error).message);
    return json({ error: "Internal server error" }, 500);
  }
});
