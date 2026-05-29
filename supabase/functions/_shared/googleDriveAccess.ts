import type { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type SupabaseAdminClient = ReturnType<typeof createClient>;

type CredentialsRow = {
  access_token: string | null;
  refresh_token: string | null;
  access_token_expires_at: string | null;
};

/** OAuth scope for Drive preview (non-sensitive; per-file access via Picker). */
export const GOOGLE_DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export async function getValidGoogleDriveAccessToken(
  supabaseAdmin: SupabaseAdminClient,
  userId: string,
  logPrefix = "google-drive",
): Promise<{ accessToken: string; error?: string }> {
  const { data: row, error } = await supabaseAdmin
    .from("user_google_oauth_credentials")
    .select("access_token, refresh_token, access_token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error(`${logPrefix}: read credentials`, error.message);
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
    console.error(`${logPrefix}: refresh`, msg);
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

export function mapGoogleDriveApiFailure(
  driveStatus: number,
  driveJson: Record<string, unknown>,
  resourceId: string,
): { httpStatus: number; body: Record<string, unknown> } {
  const errObj = driveJson.error;
  const message =
    typeof errObj === "object" && errObj !== null && "message" in errObj
      ? String((errObj as { message?: string }).message)
      : "Drive API error";
  const reason =
    typeof errObj === "object" && errObj !== null && "errors" in errObj
      ? JSON.stringify((errObj as { errors?: unknown }).errors)
      : typeof errObj === "object" && errObj !== null && "reason" in errObj
        ? String((errObj as { reason?: string }).reason)
        : "";

  const combined = `${message} ${reason}`.toLowerCase();
  const grantRequired =
    driveStatus === 403 ||
    (driveStatus === 404 &&
      (combined.includes("not found") ||
        combined.includes("insufficient") ||
        combined.includes("filenotfound")));

  if (grantRequired || combined.includes("insufficientfilepermissions")) {
    return {
      httpStatus: 403,
      body: {
        error: message,
        code: "DRIVE_GRANT_REQUIRED",
        resourceId,
      },
    };
  }

  return {
    httpStatus: driveStatus === 404 ? 404 : 400,
    body: { error: message },
  };
}

export const DRIVE_GRANT_REQUIRED_HEADER = "x-synckerja-drive-code";
