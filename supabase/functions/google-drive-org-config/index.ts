/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserIdFromBearer,
  isActiveOrgMember,
  isOrgOwnerOrAdmin,
  orgDriveCorsHeaders,
  orgDriveJson,
  orgDriveOAuthRedirectUri,
  readGoogleOAuthClient,
} from "../_shared/orgDrive/access.ts";
import { isOrgDriveEncryptionReady } from "../_shared/orgDrive/crypto.ts";
import { ORG_DRIVE_ROOT_FOLDER_NAME } from "../_shared/orgDrive/naming.ts";

/**
 * POST { action: "getSettings" | "disconnect", organization_id }
 * getSettings: any active member (so the upload button knows if the org Drive is ready).
 * disconnect: owner/admin. Stops Synckerja's access; files already in Drive are NOT deleted.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: orgDriveCorsHeaders });
  if (req.method !== "POST") return orgDriveJson({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return orgDriveJson({ error: "Server misconfigured" }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userId = await getUserIdFromBearer(admin, req.headers.get("Authorization"));
  if (!userId) return orgDriveJson({ error: "Unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return orgDriveJson({ error: "Invalid JSON body" }, 400);
  }
  const action = String(body.action ?? "").trim();
  const organizationId = String(body.organization_id ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(organizationId)) return orgDriveJson({ error: "Missing organization_id" }, 400);
  if (!(await isActiveOrgMember(admin, userId, organizationId))) return orgDriveJson({ error: "Forbidden" }, 403);

  if (action === "getSettings") {
    const { data: conn } = await admin
      .from("organization_google_drive_connections")
      .select("google_account_email, is_active, oauth_connected_at, last_error, root_folder_id")
      .eq("organization_id", organizationId)
      .maybeSingle();
    const canManage = await isOrgOwnerOrAdmin(admin, userId, organizationId);
    return orgDriveJson({
      connected: Boolean(conn?.is_active),
      accountEmail: conn?.google_account_email ?? null,
      connectedAt: conn?.oauth_connected_at ?? null,
      lastError: conn?.last_error ?? null,
      rootFolderName: ORG_DRIVE_ROOT_FOLDER_NAME,
      rootFolderUrl: conn?.root_folder_id ? `https://drive.google.com/drive/folders/${conn.root_folder_id}` : null,
      canManage,
      // Setup details are for the people who can fix them.
      ...(canManage
        ? {
          oauthConfigured: Boolean(readGoogleOAuthClient()),
          encryptionReady: isOrgDriveEncryptionReady(),
          redirectUri: orgDriveOAuthRedirectUri(),
        }
        : {}),
    });
  }

  if (action === "disconnect") {
    if (!(await isOrgOwnerOrAdmin(admin, userId, organizationId))) {
      return orgDriveJson({ error: "Hanya owner atau admin yang bisa memutuskan Google Drive org" }, 403);
    }
    // Do NOT revoke at Google: the same Google account + OAuth client may also be a member's personal
    // Drive connection (user_google_oauth_credentials), and revoking would break that one too.
    await admin.from("organization_google_drive_connection_tokens").delete().eq("organization_id", organizationId);
    await admin
      .from("organization_google_drive_connections")
      .update({ is_active: false, root_folder_id: null, last_error: null })
      .eq("organization_id", organizationId);
    return orgDriveJson({ ok: true });
  }

  return orgDriveJson({ error: "Unknown action" }, 400);
});
