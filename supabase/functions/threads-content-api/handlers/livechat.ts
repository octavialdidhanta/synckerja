import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getThreadsAccessToken,
  requireActiveOrg,
  requireThreadsPlatformConfigured,
  resolveThreadsContentAccount,
  threadsContentJson,
} from "../../_shared/threadsContentAuth.ts";
import type { ThreadsWebhookAccount } from "../../_shared/threadsLivechatWebhook.ts";
import { syncThreadsLivechatInboundForOrg } from "../../_shared/threadsLivechatSync.ts";

async function listThreadsWebhookAccounts(
  admin: SupabaseClient,
  organizationId: string,
  threadsUserIdFilter?: string,
): Promise<ThreadsWebhookAccount[]> {
  let query = admin
    .from("organization_instagram_accounts")
    .select("organization_id, threads_user_id, threads_username, instagram_username, instagram_name")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .eq("has_threads", true);

  if (threadsUserIdFilter) {
    query = query.eq("threads_user_id", threadsUserIdFilter);
  }

  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const out: ThreadsWebhookAccount[] = [];
  for (const row of rows ?? []) {
    const r = row as Record<string, unknown>;
    const threadsUserId = String(r.threads_user_id ?? "").trim();
    if (!threadsUserId || seen.has(threadsUserId)) continue;
    seen.add(threadsUserId);
    out.push({
      organization_id: organizationId,
      threads_user_id: threadsUserId,
      threads_username: typeof r.threads_username === "string" ? r.threads_username : null,
      instagram_username: typeof r.instagram_username === "string" ? r.instagram_username : null,
      instagram_name: typeof r.instagram_name === "string" ? r.instagram_name : null,
    });
  }
  return out;
}

export async function handleThreadsLivechat(
  admin: SupabaseClient,
  userId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  try {
    const platformForbidden = requireThreadsPlatformConfigured();
    if (platformForbidden) return platformForbidden;

    const action = String(body.action ?? "").trim();
    if (action !== "syncLivechatInbound") {
      return threadsContentJson({ error: "Unknown action", action }, 400);
    }

    const organizationId = String(body.organization_id ?? "").trim();
    if (!organizationId) return threadsContentJson({ error: "Missing organization_id" }, 400);

    const orgForbidden = await requireActiveOrg(admin, userId, organizationId);
    if (orgForbidden) return orgForbidden;

    let threadsUserIdFilter = body.threads_user_id != null
      ? String(body.threads_user_id).trim()
      : "";
    if (!threadsUserIdFilter && body.account_id != null) {
      const accountId = String(body.account_id).trim();
      if (accountId) {
        const resolved = await resolveThreadsContentAccount(admin, organizationId, accountId);
        threadsUserIdFilter = resolved?.threadsUserId ?? accountId;
      }
    }

    const accounts = await listThreadsWebhookAccounts(
      admin,
      organizationId,
      threadsUserIdFilter || undefined,
    );
    if (accounts.length === 0) {
      return threadsContentJson({ error: "No Threads account connected for this organization" }, 404);
    }

    const lookbackDays = Number(body.lookback_days ?? 60);
    const maxPosts = Number(body.max_posts ?? 40);

    const result = await syncThreadsLivechatInboundForOrg(
      admin,
      organizationId,
      (id) => getThreadsAccessToken(admin, organizationId, id),
      accounts,
      {
        lookbackDays: Number.isFinite(lookbackDays) && lookbackDays > 0 ? lookbackDays : 60,
        maxPosts: Number.isFinite(maxPosts) && maxPosts > 0 ? Math.min(maxPosts, 50) : 40,
      },
    );

    return threadsContentJson({ ok: true, ...result }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("threads-content-api livechat:", msg);
    return threadsContentJson({ error: msg, code: "THREADS_LIVECHAT_SYNC_ERROR" }, 400);
  }
}
