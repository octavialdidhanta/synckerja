import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  fetchThreadsFeedPublishLimit,
  fetchThreadsGrantedPermissions,
} from "../../_shared/threadsContentApi.ts";
import { threadsAppId, threadsAppSecret } from "../../_shared/threadsAppCredentials.ts";
import {
  getThreadsAccessToken,
  requireActiveOrg,
  threadsContentJson,
} from "../../_shared/threadsContentAuth.ts";
import { interpretThreadsFeedPublishLimit } from "../../_shared/threadsFeedPublishReadiness.ts";

type AccountRow = {
  threads_user_id: string | null;
  threads_username: string | null;
  instagram_username: string | null;
  instagram_name: string | null;
};

function accountLabel(row: AccountRow, threadsUserId: string): string {
  return String(row.threads_username ?? row.instagram_username ?? row.instagram_name ?? threadsUserId);
}

export async function handleThreadsPublishReadiness(
  admin: SupabaseClient,
  userId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) return threadsContentJson({ error: "Missing organization_id" }, 400);

  const orgForbidden = await requireActiveOrg(admin, userId, organizationId);
  if (orgForbidden) return orgForbidden;

  const { data, error } = await admin
    .from("organization_instagram_accounts")
    .select("threads_user_id, threads_username, instagram_username, instagram_name")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .eq("has_threads", true);

  if (error) return threadsContentJson({ error: error.message }, 500);

  const seen = new Set<string>();
  const accounts = [];
  for (const raw of data ?? []) {
    const row = raw as AccountRow;
    const threadsUserId = String(row.threads_user_id ?? "").trim();
    if (!threadsUserId || seen.has(threadsUserId)) continue;
    seen.add(threadsUserId);
    const label = accountLabel(row, threadsUserId);

    const accessToken = await getThreadsAccessToken(admin, organizationId, threadsUserId);
    if (!accessToken) {
      accounts.push({
        threads_user_id: threadsUserId,
        account_label: label,
        ok: false,
        reason: "no_token",
        detail: null,
        quota_total: null,
        quota_usage: null,
        reply_quota_total: null,
        has_content_publish: false,
        has_delete_scope: false,
      });
      continue;
    }

    const scopes = await fetchThreadsGrantedPermissions(
      accessToken,
      threadsAppId(),
      threadsAppSecret(),
    );
    let apiError: string | null = null;
    let payload = null;
    try {
      payload = await fetchThreadsFeedPublishLimit(threadsUserId, accessToken);
    } catch (probeError) {
      apiError = probeError instanceof Error ? probeError.message : String(probeError);
    }
    const judged = interpretThreadsFeedPublishLimit({ scopes, payload, apiError });
    accounts.push({
      threads_user_id: threadsUserId,
      account_label: label,
      ...judged,
    });
  }

  if (accounts.length === 0) {
    return threadsContentJson({ ok: false, reason: "no_account", accounts: [] }, 200);
  }

  return threadsContentJson({
    ok: accounts.some((account) => account.ok),
    accounts,
  }, 200);
}
