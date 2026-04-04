/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SupabaseAdminClient = ReturnType<typeof createClient>;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

type CredentialsRow = {
  access_token: string | null;
  refresh_token: string | null;
  access_token_expires_at: string | null;
};

async function getValidAccessToken(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
): Promise<{ accessToken: string; error?: string }> {
  const { data: row, error } = await supabaseAdmin
    .from("user_google_oauth_credentials")
    .select("access_token, refresh_token, access_token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("google-drive-file-meta: read credentials", error.message);
    return { accessToken: "", error: "Failed to read Google credentials" };
  }
  const r = row as CredentialsRow | null;
  if (!r) {
    return { accessToken: "", error: "Google account not connected" };
  }

  const expiresMs = r.access_token_expires_at ? new Date(r.access_token_expires_at).getTime() : 0;
  const fresh = r.access_token && expiresMs > Date.now() + 60_000;
  if (fresh) {
    return { accessToken: r.access_token! };
  }

  if (!r.refresh_token) {
    if (r.access_token) {
      return { accessToken: r.access_token };
    }
    return { accessToken: "", error: "Google session expired; connect Google again" };
  }

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
  if (!clientId || !clientSecret) {
    return { accessToken: "", error: "Google OAuth not configured" };
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: r.refresh_token,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const tokenJson = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      typeof tokenJson.error_description === "string"
        ? tokenJson.error_description
        : typeof tokenJson.error === "string"
          ? tokenJson.error
          : "Token refresh failed";
    console.error("google-drive-file-meta: refresh", msg);
    return { accessToken: "", error: msg };
  }

  const accessToken = typeof tokenJson.access_token === "string" ? tokenJson.access_token : "";
  if (!accessToken) {
    return { accessToken: "", error: "No access token from refresh" };
  }

  const expiresIn = typeof tokenJson.expires_in === "number" ? tokenJson.expires_in : 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const nowIso = new Date().toISOString();

  await supabaseAdmin
    .from("user_google_oauth_credentials")
    .update({
      access_token: accessToken,
      access_token_expires_at: expiresAt,
      updated_at: nowIso,
    })
    .eq("user_id", userId);

  return { accessToken };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const json = (body: object, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!serviceRoleKey) {
      console.error("google-drive-file-meta: SUPABASE_SERVICE_ROLE_KEY missing");
      return json({ error: "Server configuration error" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !user) {
      console.error("google-drive-file-meta: getUser failed", userError?.message ?? userError);
      return json({ error: "Invalid or expired session. Please sign in again." }, 401);
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const fileIdRaw = body.file_id != null ? String(body.file_id).trim() : "";
    if (!fileIdRaw || !/^[a-zA-Z0-9-_]+$/.test(fileIdRaw)) {
      return json({ error: "Invalid or missing file_id" }, 400);
    }

    const { accessToken, error: tokenErr } = await getValidAccessToken(supabaseAdmin, user.id);
    if (!accessToken) {
      return json({ error: tokenErr ?? "No Google access" }, 400);
    }

    const fields = encodeURIComponent("id,name,mimeType,thumbnailLink,iconLink");
    const driveUrl =
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileIdRaw)}?fields=${fields}&supportsAllDrives=true`;

    const driveRes = await fetch(driveUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const meta = (await driveRes.json()) as Record<string, unknown>;
    if (!driveRes.ok) {
      const errMsg =
        typeof meta.error === "object" && meta.error !== null && "message" in meta.error
          ? String((meta.error as { message?: string }).message)
          : "Drive API error";
      console.error("google-drive-file-meta: Drive API", errMsg);
      return json({ error: errMsg }, driveRes.status === 404 ? 404 : 400);
    }

    const thumbnailLink = typeof meta.thumbnailLink === "string" ? meta.thumbnailLink : null;
    const iconLink = typeof meta.iconLink === "string" ? meta.iconLink : null;
    const name = typeof meta.name === "string" ? meta.name : null;
    const mimeType = typeof meta.mimeType === "string" ? meta.mimeType : null;

    const fallbackThumbnailUrl = `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileIdRaw)}&sz=w2000`;

    return json(
      {
        id: fileIdRaw,
        name,
        mimeType,
        thumbnailLink,
        iconLink,
        /** Client may try if thumbnailLink fails in &lt;img&gt; (sharing-dependent). */
        fallbackThumbnailUrl,
      },
      200,
    );
  } catch (e) {
    const err = e as Error;
    console.error("google-drive-file-meta:", err.message);
    return json({ error: "Internal server error" }, 500);
  }
});
