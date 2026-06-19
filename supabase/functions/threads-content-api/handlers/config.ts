import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  isThreadsPlatformConfigured,
  listThreadsContentAccounts,
  requireActiveOrg,
  threadsContentJson,
} from "../../_shared/threadsContentAuth.ts";

export async function handleThreadsConfig(
  admin: SupabaseClient,
  userId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const action = String(body.action ?? "").trim();
  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) return threadsContentJson({ error: "Missing organization_id" }, 400);

  const orgForbidden = await requireActiveOrg(admin, userId, organizationId);
  if (orgForbidden) return orgForbidden;

  if (action === "getSettings") {
    const accounts = await listThreadsContentAccounts(admin, organizationId);
    return threadsContentJson({
      accounts,
      serverConfigured: isThreadsPlatformConfigured(),
      oauthConnected: accounts.length > 0,
    }, 200);
  }

  return threadsContentJson({ error: "Unknown action" }, 400);
}
