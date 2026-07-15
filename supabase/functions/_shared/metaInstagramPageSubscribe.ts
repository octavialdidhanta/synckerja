import { metaGraphVersion } from "./metaPlatformScopes.ts";

/** DM livechat fields for Page Subscribed Apps (includes messaging_seen for Instagram seen receipts). */
export const INSTAGRAM_DM_SUBSCRIBED_FIELDS =
  "messages,messaging_postbacks,message_reads,messaging_seen";

/** Instagram comment webhook field (Manage Comments real-time inbox). */
export const INSTAGRAM_COMMENT_SUBSCRIBED_FIELDS = "comments";

/** Fields for Page Subscribed Apps — DM + Instagram comments. */
export const INSTAGRAM_PAGE_SUBSCRIBED_FIELDS =
  `${INSTAGRAM_DM_SUBSCRIBED_FIELDS},${INSTAGRAM_COMMENT_SUBSCRIBED_FIELDS}`;

export type InstagramPageSubscribeResult = {
  pageId: string;
  instagramBusinessAccountId?: string | null;
  success: boolean;
  error?: string;
  subscribedFields?: string[];
};

export async function subscribeInstagramPageToWebhooks(
  pageId: string,
  pageAccessToken: string,
): Promise<InstagramPageSubscribeResult> {
  const trimmedPageId = pageId.trim();
  const trimmedToken = pageAccessToken.trim();
  if (!trimmedPageId || !trimmedToken) {
    return {
      pageId: trimmedPageId || pageId,
      success: false,
      error: "Missing facebook_page_id or page_access_token.",
    };
  }

  const url =
    `https://graph.facebook.com/${metaGraphVersion()}/${encodeURIComponent(trimmedPageId)}/subscribed_apps` +
    `?subscribed_fields=${encodeURIComponent(INSTAGRAM_PAGE_SUBSCRIBED_FIELDS)}` +
    `&access_token=${encodeURIComponent(trimmedToken)}`;

  try {
    const res = await fetch(url, { method: "POST" });
    const data = await res.json().catch(() => ({})) as {
      success?: boolean;
      error?: { message?: string; code?: number; type?: string };
    };

    if (res.ok && data?.success !== false) {
      return { pageId: trimmedPageId, success: true };
    }

    const errMsg = data?.error?.message ?? `Meta API HTTP ${res.status}`;
    console.error("subscribeInstagramPageToWebhooks failed", trimmedPageId, errMsg);
    return { pageId: trimmedPageId, success: false, error: errMsg };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("subscribeInstagramPageToWebhooks fetch error", trimmedPageId, errMsg);
    return { pageId: trimmedPageId, success: false, error: errMsg };
  }
}

export async function getInstagramPageSubscriptionStatus(
  pageId: string,
  pageAccessToken: string,
): Promise<{ pageId: string; subscribedFields: string[]; error?: string }> {
  const trimmedPageId = pageId.trim();
  const trimmedToken = pageAccessToken.trim();
  if (!trimmedPageId || !trimmedToken) {
    return { pageId: trimmedPageId || pageId, subscribedFields: [], error: "Missing page id or token." };
  }

  const url =
    `https://graph.facebook.com/${metaGraphVersion()}/${encodeURIComponent(trimmedPageId)}/subscribed_apps` +
    `?access_token=${encodeURIComponent(trimmedToken)}`;

  try {
    const res = await fetch(url, { method: "GET" });
    const data = await res.json().catch(() => ({})) as {
      data?: Array<{ subscribed_fields?: string[] }>;
      error?: { message?: string };
    };
    if (!res.ok) {
      return {
        pageId: trimmedPageId,
        subscribedFields: [],
        error: data?.error?.message ?? `Meta API HTTP ${res.status}`,
      };
    }
    const fields = new Set<string>();
    for (const row of data?.data ?? []) {
      for (const f of row?.subscribed_fields ?? []) {
        if (typeof f === "string" && f.trim()) fields.add(f.trim());
      }
    }
    return { pageId: trimmedPageId, subscribedFields: [...fields] };
  } catch (e) {
    return {
      pageId: trimmedPageId,
      subscribedFields: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
