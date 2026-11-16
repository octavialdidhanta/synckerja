import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { saveLinkedInPageConnection } from "../../_shared/linkedinContentConnectionSave.ts";
import { linkedinContentOAuthScopes } from "../../_shared/linkedinContentAuth.ts";
import { decryptLinkedInContentToken } from "../../_shared/linkedinContentConfigCrypto.ts";
import type { LinkedInPageRow } from "../../_shared/linkedinContentApi.ts";
import {
  buildPersonUrn,
  fetchLinkedInPostsByAuthor,
  fetchMemberCreatorPostAnalytics,
} from "../../_shared/linkedinContentApi.ts";
import { getLinkedInContentAccessToken } from "../../_shared/linkedinContentOrgResolver.ts";
import {
  isLinkedInContentPlatformConfigured,
  requireActiveOrg,
  requireOrgAdmin,
  requireLinkedInContentPlatformConfigured,
  linkedinContentJson,
} from "../../_shared/linkedinContentAuth.ts";

export async function handleLinkedInConfig(
  admin: SupabaseClient,
  userId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const action = String(body.action ?? "").trim();
  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) return linkedinContentJson({ error: "Missing organization_id" }, 400);

  const orgForbidden = await requireActiveOrg(admin, userId, organizationId);
  if (orgForbidden) return orgForbidden;

  if (action === "getSettings") {
    const { data: connection } = await admin
      .from("organization_linkedin_content_connections")
      .select("organization_id, is_active, oauth_connected_at, updated_at")
      .eq("organization_id", organizationId)
      .maybeSingle();

    const { data: accounts } = await admin
      .from("organization_linkedin_content_accounts")
      .select("id, page_id, account_kind, label, display_name, thumbnail_url, is_default, sort_order, is_active, granted_scopes, created_at, updated_at")
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: true });

    const { data: tokenRows } = await admin
      .from("organization_linkedin_content_connection_tokens")
      .select("page_id, updated_at, access_token_expires_at")
      .eq("organization_id", organizationId);

    const tokenByPage = new Map(
      (tokenRows ?? []).map((row) => [String((row as { page_id?: string }).page_id ?? ""), row]),
    );
    const accountsWithTokens = (accounts ?? []).map((acc) => {
      const pageId = String((acc as { page_id?: string }).page_id ?? "");
      const token = tokenByPage.get(pageId) as
        | { updated_at?: string | null; access_token_expires_at?: string | null }
        | undefined;
      return {
        ...acc,
        token_updated_at: token?.updated_at ?? null,
        access_token_expires_at: token?.access_token_expires_at ?? null,
      };
    });

    return linkedinContentJson({
      connection: connection ?? null,
      oauthConnected: (tokenRows ?? []).length > 0,
      accounts: accountsWithTokens,
      serverConfigured: isLinkedInContentPlatformConfigured(),
    }, 200);
  }

  if (action === "spikeMemberInsights") {
    const adminForbidden = await requireOrgAdmin(admin, userId, organizationId);
    if (adminForbidden) return adminForbidden;

    const pageId = String(body.page_id ?? "").trim();
    const { data: personAcc } = await admin
      .from("organization_linkedin_content_accounts")
      .select("page_id, account_kind, granted_scopes, label")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .eq("account_kind", "person")
      .maybeSingle();
    const subjectId = pageId || String(personAcc?.page_id ?? "").trim();
    if (!subjectId) {
      return linkedinContentJson({ error: "No person LinkedIn account connected" }, 400);
    }

    const accessToken = await getLinkedInContentAccessToken(admin, organizationId, subjectId);
    if (!accessToken) {
      return linkedinContentJson({ error: "Person token missing — reconnect personal profile" }, 400);
    }

    const authorUrn = buildPersonUrn(subjectId);
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 29);
    const ymd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    let postsError: string | null = null;
    let posts: Array<{ id: string }> = [];
    try {
      posts = await fetchLinkedInPostsByAuthor(
        accessToken,
        authorUrn,
        ymd(start),
        ymd(end),
        2,
      );
    } catch (e) {
      postsError = e instanceof Error ? e.message : String(e);
    }

    let analyticsError: string | null = null;
    let analyticsSample: number | null = null;
    const sampleUrn = posts[0]?.id;
    if (sampleUrn) {
      try {
        const map = await fetchMemberCreatorPostAnalytics(accessToken, [sampleUrn], "IMPRESSION");
        analyticsSample = map.get(sampleUrn) ?? 0;
      } catch (e) {
        analyticsError = e instanceof Error ? e.message : String(e);
      }
    }

    const ok = !postsError;
    return linkedinContentJson({
      ok,
      page_id: subjectId,
      author_urn: authorUrn,
      granted_scopes: personAcc?.granted_scopes ?? null,
      posts_count: posts.length,
      posts_error: postsError,
      sample_post_id: sampleUrn ?? null,
      analytics_impression: analyticsSample,
      analytics_error: analyticsError,
    }, 200);
  }

  if (action === "getPendingPages") {
    const adminForbidden = await requireOrgAdmin(admin, userId, organizationId);
    if (adminForbidden) return adminForbidden;

    const now = new Date().toISOString();
    const { data: pending } = await admin
      .from("linkedin_content_pending_connections")
      .select("id, pages_json, expires_at")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .gt("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!pending?.id) {
      return linkedinContentJson({ pending: false, pages: [] }, 200);
    }

    const pages = (pending.pages_json ?? []) as LinkedInPageRow[];
    return linkedinContentJson({ pending: true, pages }, 200);
  }

  const adminForbidden = await requireOrgAdmin(admin, userId, organizationId);
  if (adminForbidden) return adminForbidden;

  const platformForbidden = requireLinkedInContentPlatformConfigured();
  if (platformForbidden && action !== "disconnect") return platformForbidden;

  if (action === "completePageConnect") {
    const pageId = String(body.page_id ?? "").trim();
    if (!pageId) return linkedinContentJson({ error: "Missing page_id" }, 400);

    const now = new Date().toISOString();
    const { data: pending } = await admin
      .from("linkedin_content_pending_connections")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .gt("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!pending?.id) {
      return linkedinContentJson({ error: "No pending LinkedIn connection" }, 400);
    }

    const pages = (pending.pages_json ?? []) as LinkedInPageRow[];
    const page = pages.find((p) => p.page_id === pageId);
    if (!page) {
      return linkedinContentJson({ error: "Page not found in pending connection" }, 400);
    }

    let accessToken: string;
    let refreshToken: string;
    try {
      accessToken = await decryptLinkedInContentToken(String(pending.access_token_enc));
      refreshToken = await decryptLinkedInContentToken(String(pending.refresh_token_enc));
    } catch (e) {
      console.error("linkedin-content-api completePageConnect decrypt:", e);
      return linkedinContentJson({ error: "Failed to decrypt pending tokens" }, 500);
    }

    try {
      const { isExistingAccount } = await saveLinkedInPageConnection(admin, {
        organizationId,
        userId,
        page,
        accessToken,
        refreshToken,
        expiresIn: pending.access_token_expires_at
          ? Math.max(
            0,
            Math.floor(
              (new Date(String(pending.access_token_expires_at)).getTime() - Date.now()) / 1000,
            ),
          )
          : undefined,
        grantedScopes: linkedinContentOAuthScopes().split(/\s+/).filter(Boolean),
      });

      await admin.from("linkedin_content_pending_connections").delete().eq("id", pending.id);

      return linkedinContentJson({ ok: true, isExistingAccount }, 200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "save_failed";
      console.error("linkedin-content-api completePageConnect save:", msg);
      return linkedinContentJson({ error: msg }, 500);
    }
  }

  if (action === "disconnect") {
    const pageId = body.page_id != null ? String(body.page_id).trim() : "";
    if (pageId) {
      await admin.from("organization_linkedin_content_connection_tokens")
        .delete()
        .eq("organization_id", organizationId)
        .eq("page_id", pageId);
      await admin.from("organization_linkedin_content_accounts")
        .delete()
        .eq("organization_id", organizationId)
        .eq("page_id", pageId);
    } else {
      await admin.from("organization_linkedin_content_connection_tokens")
        .delete()
        .eq("organization_id", organizationId);
      await admin.from("organization_linkedin_content_accounts")
        .delete()
        .eq("organization_id", organizationId);
    }

    await admin.from("linkedin_content_pending_connections")
      .delete()
      .eq("organization_id", organizationId);

    const { data: remaining } = await admin
      .from("organization_linkedin_content_connection_tokens")
      .select("page_id")
      .eq("organization_id", organizationId);

    if ((remaining ?? []).length === 0) {
      await admin.from("organization_linkedin_content_connections").upsert({
        organization_id: organizationId,
        oauth_connected_at: null,
        is_active: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: "organization_id" });
    }

    return linkedinContentJson({ ok: true }, 200);
  }

  if (action === "setDefaultAccount") {
    const accountId = String(body.account_id ?? "").trim();
    if (!accountId) return linkedinContentJson({ error: "Missing account_id" }, 400);
    const { data: target } = await admin
      .from("organization_linkedin_content_accounts")
      .select("id, account_kind")
      .eq("id", accountId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!target?.id) return linkedinContentJson({ error: "Account not found" }, 404);
    const accountKind = String(target.account_kind ?? "organization") === "person"
      ? "person"
      : "organization";
    await admin.from("organization_linkedin_content_accounts")
      .update({ is_default: false })
      .eq("organization_id", organizationId)
      .eq("account_kind", accountKind);
    const { error } = await admin
      .from("organization_linkedin_content_accounts")
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq("id", accountId)
      .eq("organization_id", organizationId);
    if (error) return linkedinContentJson({ error: error.message }, 500);
    return linkedinContentJson({ ok: true }, 200);
  }

  if (action === "deleteAccount") {
    const accountId = String(body.account_id ?? "").trim();
    if (!accountId) return linkedinContentJson({ error: "Missing account_id" }, 400);
    const { data: acc } = await admin
      .from("organization_linkedin_content_accounts")
      .select("page_id")
      .eq("id", accountId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (acc?.page_id) {
      await admin.from("organization_linkedin_content_connection_tokens")
        .delete()
        .eq("organization_id", organizationId)
        .eq("page_id", String(acc.page_id));
    }
    const { error } = await admin
      .from("organization_linkedin_content_accounts")
      .delete()
      .eq("id", accountId)
      .eq("organization_id", organizationId);
    if (error) return linkedinContentJson({ error: error.message }, 500);
    return linkedinContentJson({ ok: true }, 200);
  }

  return linkedinContentJson({ error: "Unknown action" }, 400);
}
