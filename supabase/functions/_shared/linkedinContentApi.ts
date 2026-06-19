const LINKEDIN_API_BASE = "https://api.linkedin.com";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_API_VERSION = "202411";

export type LinkedInPageRow = {
  page_id: string;
  title: string;
  thumbnail_url: string | null;
  vanity_name: string | null;
};

export type LinkedInPostRow = {
  id?: string;
  title?: string;
  published_at?: string;
  thumbnail_url?: string | null;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
};

type LinkedInTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

function linkedInRestHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "LinkedIn-Version": LINKEDIN_API_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
  };
}

function throwLinkedInError(prefix: string, json: LinkedInTokenResponse, httpStatus: number): never {
  const msg = json.error_description?.trim() || json.error?.trim() || `${prefix} HTTP ${httpStatus}`;
  throw new Error(msg);
}

export function parseOrganizationIdFromUrn(urn: string): string | null {
  const m = /^urn:li:organization:(\d+)$/i.exec(String(urn ?? "").trim());
  return m?.[1] ?? null;
}

export function buildOrganizationUrn(pageId: string): string {
  return `urn:li:organization:${pageId}`;
}

export async function exchangeLinkedInContentAuthCode(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: decodeURIComponent(code),
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = await res.json().catch(() => ({})) as LinkedInTokenResponse;
  const accessToken = json.access_token?.trim() ?? "";
  const refreshToken = json.refresh_token?.trim() ?? "";
  if (!res.ok || !accessToken) {
    throwLinkedInError("token_exchange_failed", json, res.status);
  }
  return {
    access_token: accessToken,
    refresh_token: refreshToken || accessToken,
    expires_in: json.expires_in,
  };
}

export async function refreshLinkedInContentAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
} | null> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = await res.json().catch(() => ({})) as LinkedInTokenResponse;
  const accessToken = json.access_token?.trim() ?? "";
  if (!res.ok || !accessToken) {
    console.error("linkedin content refresh:", json.error_description ?? json.error ?? res.status);
    return null;
  }
  return {
    access_token: accessToken,
    refresh_token: json.refresh_token,
    expires_in: json.expires_in,
  };
}

type LinkedInApiError = { message?: string; status?: number };

async function linkedInRestGet<T>(
  accessToken: string,
  path: string,
  params?: Record<string, string>,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  const res = await fetch(`${LINKEDIN_API_BASE}${path}${qs}`, {
    headers: { ...linkedInRestHeaders(accessToken), ...extraHeaders },
  });
  const json = await res.json().catch(() => ({})) as T & LinkedInApiError & { error?: { message?: string } };
  if (!res.ok) {
    const msg = json.error?.message ?? json.message ?? `LinkedIn API HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

export async function fetchLinkedInAdministeredPages(accessToken: string): Promise<LinkedInPageRow[]> {
  const aclJson = await linkedInRestGet<{
    elements?: Array<{
      organization?: string;
      role?: string;
      state?: string;
    }>;
  }>(
    accessToken,
    "/rest/organizationAcls",
    {
      q: "roleAssignee",
      role: "(ADMINISTRATOR|CONTENT_ADMINISTRATOR)",
      state: "APPROVED",
    },
    { "X-RestLi-Method": "FINDER" },
  );

  const orgIds = new Set<string>();
  for (const el of aclJson.elements ?? []) {
    const orgId = parseOrganizationIdFromUrn(String(el.organization ?? ""));
    if (orgId) orgIds.add(orgId);
  }

  if (orgIds.size === 0) return [];

  const pages: LinkedInPageRow[] = [];
  const idList = [...orgIds];

  for (let i = 0; i < idList.length; i += 25) {
    const batch = idList.slice(i, i + 25);
    const idsParam = `List(${batch.join(",")})`;
    const orgJson = await linkedInRestGet<{
      results?: Record<string, {
        id?: number;
        localizedName?: string;
        vanityName?: string;
        logoV2?: {
          original?: string;
          "original~": { elements?: Array<{ identifiers?: Array<{ identifier?: string }> }> };
        };
      }>;
    }>(
      accessToken,
      "/rest/organizations",
      { ids: idsParam },
      { "X-RestLi-Method": "BATCH_GET" },
    );

    for (const orgId of batch) {
      const org = orgJson.results?.[orgId] ?? orgJson.results?.[`urn:li:organization:${orgId}`];
      const title = String(org?.localizedName ?? "").trim() || `LinkedIn ${orgId}`;
      let thumbnailUrl: string | null = null;
      const logoElements = org?.logoV2?.["original~"]?.elements;
      if (logoElements?.[0]?.identifiers?.[0]?.identifier) {
        thumbnailUrl = String(logoElements[0].identifiers[0].identifier);
      }
      pages.push({
        page_id: orgId,
        title,
        thumbnail_url: thumbnailUrl,
        vanity_name: org?.vanityName != null ? String(org.vanityName) : null,
      });
    }
  }

  pages.sort((a, b) => a.title.localeCompare(b.title));
  return pages;
}

export function buildLinkedInPostUrl(postUrn: string): string {
  const urn = String(postUrn ?? "").trim();
  if (!urn) return "";
  return `https://www.linkedin.com/feed/update/${encodeURIComponent(urn)}/`;
}

type SocialMetadataEntry = {
  commentSummary?: { totalFirstLevelComments?: number; count?: number };
  reactionSummaries?: Record<string, { count?: number }> | Array<{ reactionType?: string; count?: number }>;
  totalShareStatistics?: { shareCount?: number };
};

function sumReactions(reactions: SocialMetadataEntry["reactionSummaries"]): number {
  if (!reactions) return 0;
  if (Array.isArray(reactions)) {
    return reactions.reduce((s, r) => s + (Number(r.count) || 0), 0);
  }
  return Object.values(reactions).reduce((s, r) => s + (Number(r.count) || 0), 0);
}

export async function fetchSocialMetadata(
  accessToken: string,
  postUrns: string[],
): Promise<Map<string, { like_count: number; comment_count: number; share_count: number }>> {
  const map = new Map<string, { like_count: number; comment_count: number; share_count: number }>();
  if (postUrns.length === 0) return map;

  for (let i = 0; i < postUrns.length; i += 25) {
    const batch = postUrns.slice(i, i + 25);
    const encodedUrns = batch.map((u) => encodeURIComponent(u)).join(",");
    const idsParam = `List(${encodedUrns})`;

    try {
      const json = await linkedInRestGet<{
        results?: Record<string, SocialMetadataEntry>;
        elements?: Array<{ target?: string } & SocialMetadataEntry>;
      }>(
        accessToken,
        "/rest/socialMetadata",
        { ids: idsParam },
        { "X-RestLi-Method": "BATCH_GET" },
      );

      if (json.results) {
        for (const [urn, meta] of Object.entries(json.results)) {
          const commentCount = Number(
            meta.commentSummary?.totalFirstLevelComments ?? meta.commentSummary?.count ?? 0,
          ) || 0;
          const likeCount = sumReactions(meta.reactionSummaries);
          const shareCount = Number(meta.totalShareStatistics?.shareCount ?? 0) || 0;
          map.set(urn, { like_count: likeCount, comment_count: commentCount, share_count: shareCount });
        }
      }
    } catch (e) {
      console.warn("linkedin socialMetadata batch:", e);
      for (const urn of batch) {
        try {
          const single = await linkedInRestGet<SocialMetadataEntry>(
            accessToken,
            `/rest/socialMetadata/${encodeURIComponent(urn)}`,
          );
          const commentCount = Number(
            single.commentSummary?.totalFirstLevelComments ?? single.commentSummary?.count ?? 0,
          ) || 0;
          const likeCount = sumReactions(single.reactionSummaries);
          const shareCount = Number(single.totalShareStatistics?.shareCount ?? 0) || 0;
          map.set(urn, { like_count: likeCount, comment_count: commentCount, share_count: shareCount });
        } catch (singleErr) {
          console.warn("linkedin socialMetadata single:", urn, singleErr);
        }
      }
    }
  }

  return map;
}

function extractPostThumbnail(content: unknown): string | null {
  if (!content || typeof content !== "object") return null;
  const c = content as Record<string, unknown>;
  const media = c.media as Record<string, unknown> | undefined;
  if (media?.id && typeof media.id === "string") return null;
  const multiImage = c.multiImage as { images?: Array<{ id?: string }> } | undefined;
  if (multiImage?.images?.[0]?.id) return null;
  const article = c.article as { thumbnail?: string } | undefined;
  if (article?.thumbnail) return String(article.thumbnail);
  return null;
}

export async function fetchLinkedInOrganizationPosts(
  accessToken: string,
  pageId: string,
  dateStartYmd: string,
  dateEndYmd: string,
  maxPages = 20,
): Promise<LinkedInPostRow[]> {
  const startMs = new Date(`${dateStartYmd}T00:00:00.000Z`).getTime();
  const endMs = new Date(`${dateEndYmd}T23:59:59.999Z`).getTime();
  const authorUrn = buildOrganizationUrn(pageId);

  const postsInRange: Array<{
    id: string;
    title: string;
    published_at: string;
    thumbnail_url: string | null;
  }> = [];

  let start = 0;
  const count = 50;

  for (let page = 0; page < maxPages; page++) {
    const json = await linkedInRestGet<{
      elements?: Array<{
        id?: string;
        commentary?: string;
        publishedAt?: number;
        createdAt?: number;
        content?: unknown;
      }>;
      paging?: { start?: number; count?: number; total?: number };
    }>(
      accessToken,
      "/rest/posts",
      {
        q: "author",
        author: authorUrn,
        viewContext: "AUTHOR",
        sortBy: "LAST_MODIFIED",
        start: String(start),
        count: String(count),
      },
      { "X-RestLi-Method": "FINDER" },
    );

    const elements = json.elements ?? [];
    if (elements.length === 0) break;

    let oldestInBatch = Infinity;
    for (const el of elements) {
      const postId = String(el.id ?? "").trim();
      const publishedMs = Number(el.publishedAt ?? el.createdAt ?? 0);
      if (!postId || !Number.isFinite(publishedMs) || publishedMs <= 0) continue;
      oldestInBatch = Math.min(oldestInBatch, publishedMs);
      if (publishedMs >= startMs && publishedMs <= endMs) {
        postsInRange.push({
          id: postId,
          title: String(el.commentary ?? "").trim().slice(0, 500) || postId,
          published_at: new Date(publishedMs).toISOString(),
          thumbnail_url: extractPostThumbnail(el.content),
        });
      }
      if (publishedMs < startMs) {
        page = maxPages;
        break;
      }
    }

    if (elements.length < count) break;
    if (Number.isFinite(oldestInBatch) && oldestInBatch < startMs) break;
    start += count;
    if (json.paging?.total != null && start >= json.paging.total) break;
  }

  const postUrns = postsInRange.map((p) => p.id);
  const metadataMap = await fetchSocialMetadata(accessToken, postUrns);

  const posts: LinkedInPostRow[] = postsInRange.map((p) => {
    const meta = metadataMap.get(p.id);
    return {
      id: p.id,
      title: p.title,
      published_at: p.published_at,
      thumbnail_url: p.thumbnail_url,
      view_count: 0,
      like_count: meta?.like_count ?? 0,
      comment_count: meta?.comment_count ?? 0,
      share_count: meta?.share_count ?? 0,
    };
  });

  posts.sort((a, b) => {
    const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
    const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
    return tb - ta;
  });

  return posts;
}

export async function fetchLinkedInFollowerCount(
  accessToken: string,
  pageId: string,
): Promise<number | null> {
  const orgUrn = buildOrganizationUrn(pageId);
  try {
    const json = await linkedInRestGet<{
      elements?: Array<{
        followerCounts?: { organicFollowerCount?: number; paidFollowerCount?: number };
      }>;
    }>(
      accessToken,
      "/rest/organizationalEntityFollowerStatistics",
      {
        q: "organizationalEntity",
        organizationalEntity: orgUrn,
      },
      { "X-RestLi-Method": "FINDER" },
    );
    const el = json.elements?.[0];
    const organic = Number(el?.followerCounts?.organicFollowerCount ?? 0);
    const paid = Number(el?.followerCounts?.paidFollowerCount ?? 0);
    const total = organic + paid;
    return Number.isFinite(total) && total >= 0 ? total : null;
  } catch (e) {
    console.warn("fetchLinkedInFollowerCount:", e instanceof Error ? e.message : e);
    return null;
  }
}

export type LinkedInContentComment = {
  id: string;
  post_id: string;
  text: string;
  author_name: string | null;
  like_count: number;
  reply_count: number;
  parent_comment_id: string | null;
  published_at: string | null;
  is_owner: boolean;
  can_reply: boolean;
};

async function linkedInRestPost<T>(
  accessToken: string,
  path: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(`${LINKEDIN_API_BASE}${path}`, {
    method: "POST",
    headers: {
      ...linkedInRestHeaders(accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({})) as T & { error?: { message?: string }; message?: string };
  if (!res.ok) {
    const msg = json.error?.message ?? json.message ?? `LinkedIn API HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

function parseLinkedInCommentId(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const m = /comment:(\d+)/.exec(s);
  return m?.[1] ?? s;
}

function mapLinkedInCommentElement(
  el: Record<string, unknown>,
  postUrn: string,
  pageUrn: string,
): LinkedInContentComment {
  const actor = String(el.actor ?? "").trim();
  const id = parseLinkedInCommentId(el.id ?? el.$URN ?? el.urn);
  const parentRaw = el.parentComment != null ? String(el.parentComment) : "";
  const parentId = parentRaw ? parseLinkedInCommentId(parentRaw) : null;
  const message = el.message as { text?: string } | undefined;
  const createdMs = Number(el.created?.time ?? el.createdAt ?? 0);
  return {
    id,
    post_id: postUrn,
    text: String(message?.text ?? "").trim(),
    author_name: actor.includes("organization:") ? null : actor || null,
    like_count: 0,
    reply_count: 0,
    parent_comment_id: parentId,
    published_at: Number.isFinite(createdMs) && createdMs > 0
      ? new Date(createdMs).toISOString()
      : null,
    is_owner: actor === pageUrn,
    can_reply: true,
  };
}

export async function fetchLinkedInComments(
  accessToken: string,
  postUrn: string,
  pageId: string,
): Promise<LinkedInContentComment[]> {
  const pageUrn = buildOrganizationUrn(pageId);
  const encodedUrn = encodeURIComponent(postUrn);
  const json = await linkedInRestGet<{
    elements?: Array<Record<string, unknown>>;
  }>(accessToken, `/rest/socialActions/${encodedUrn}/comments`, {
    q: "comments",
    count: "100",
  });

  const topLevel = (json.elements ?? []).map((el) =>
    mapLinkedInCommentElement(el, postUrn, pageUrn)
  );

  const all: LinkedInContentComment[] = [...topLevel];
  for (const parent of topLevel) {
    if (!parent.id) continue;
    try {
      const parentUrn = `${postUrn},${parent.id}`;
      const encodedParent = encodeURIComponent(parentUrn);
      const nested = await linkedInRestGet<{
        elements?: Array<Record<string, unknown>>;
      }>(accessToken, `/rest/socialActions/${encodedParent}/comments`, {
        q: "comments",
        count: "50",
      });
      for (const el of nested.elements ?? []) {
        all.push(mapLinkedInCommentElement(el, postUrn, pageUrn));
      }
    } catch {
      // nested replies optional
    }
  }

  return all;
}

export async function replyLinkedInComment(
  accessToken: string,
  postUrn: string,
  pageId: string,
  parentCommentId: string,
  text: string,
): Promise<{ id: string }> {
  const pageUrn = buildOrganizationUrn(pageId);
  const encodedUrn = encodeURIComponent(postUrn);
  const parentUrn = parentCommentId.includes(",")
    ? parentCommentId
    : `${postUrn},${parentCommentId}`;

  const body: Record<string, unknown> = {
    actor: pageUrn,
    object: postUrn,
    message: { text: text.trim() },
    parentComment: parentUrn,
  };

  const res = await linkedInRestPost<{ id?: string }>(
    accessToken,
    `/rest/socialActions/${encodedUrn}/comments`,
    body,
  );
  const id = parseLinkedInCommentId(res.id);
  return { id: id || "pending" };
}
