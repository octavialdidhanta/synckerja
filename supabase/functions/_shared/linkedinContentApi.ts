const LINKEDIN_API_BASE = "https://api.linkedin.com";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_API_VERSION = "202610";

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

export function buildPersonUrn(personId: string): string {
  return `urn:li:person:${personId}`;
}

/** Author URN for UGC / posts — org page vs personal member. */
export function buildLinkedInAuthorUrn(
  accountKind: "organization" | "person",
  subjectId: string,
): string {
  return accountKind === "person"
    ? buildPersonUrn(subjectId)
    : buildOrganizationUrn(subjectId);
}

type LinkedInMeResponse = {
  id?: string;
  localizedFirstName?: string;
  localizedLastName?: string;
  firstName?: { localized?: Record<string, string> };
  lastName?: { localized?: Record<string, string> };
  profilePicture?: {
    "displayImage~"?: {
      elements?: Array<{ identifiers?: Array<{ identifier?: string }> }>;
    };
  };
  message?: string;
  status?: number;
};

function localizedNamePart(
  localized: string | undefined,
  nested: { localized?: Record<string, string> } | undefined,
): string {
  if (localized?.trim()) return localized.trim();
  const values = nested?.localized ? Object.values(nested.localized) : [];
  return String(values[0] ?? "").trim();
}

function profilePictureUrlFromMe(me: LinkedInMeResponse): string | null {
  const elements = me.profilePicture?.["displayImage~"]?.elements ?? [];
  for (let i = elements.length - 1; i >= 0; i--) {
    const id = elements[i]?.identifiers?.[0]?.identifier?.trim();
    if (id) return id;
  }
  return null;
}

/** Authenticated member profile for personal connect (r_basicprofile / Share on LinkedIn). */
export async function fetchLinkedInAuthenticatedMember(
  accessToken: string,
): Promise<LinkedInPageRow> {
  const projection =
    "(id,localizedFirstName,localizedLastName,firstName,lastName,profilePicture(displayImage~:playableStreams))";
  const url = `${LINKEDIN_API_BASE}/v2/me?projection=${encodeURIComponent(projection)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Restli-Protocol-Version": "2.0.0",
    },
  });
  const json = (await res.json().catch(() => ({}))) as LinkedInMeResponse;
  if (!res.ok) {
    const msg = String(json.message ?? "").trim() || `LinkedIn /v2/me HTTP ${res.status}`;
    throw new Error(msg);
  }
  const personId = String(json.id ?? "").trim();
  if (!personId) throw new Error("LinkedIn member id missing");

  const first = localizedNamePart(json.localizedFirstName, json.firstName);
  const last = localizedNamePart(json.localizedLastName, json.lastName);
  const title = [first, last].filter(Boolean).join(" ") || `LinkedIn ${personId.slice(0, 8)}`;

  return {
    page_id: personId,
    title,
    thumbnail_url: profilePictureUrlFromMe(json),
    vanity_name: null,
  };
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

type LinkedInApiError = {
  message?: string;
  status?: number;
  errorDetails?: unknown;
  code?: string;
};

const LINKEDIN_PAGE_ADMIN_ROLES = new Set([
  "ADMINISTRATOR",
  "CONTENT_ADMINISTRATOR",
]);

function linkedInErrorMessage(json: LinkedInApiError & { error?: { message?: string; errorDetails?: unknown } }, httpStatus: number): string {
  const details = json.errorDetails ?? json.error?.errorDetails;
  const detailText =
    typeof details === "string"
      ? details
      : details != null
        ? JSON.stringify(details)
        : "";
  const base =
    json.error?.message?.trim() ||
    json.message?.trim() ||
    json.code?.trim() ||
    `LinkedIn API HTTP ${httpStatus}`;
  return detailText ? `${base} (${detailText})` : base;
}

/** Build query string; keep Rest.li `List(...)` unencoded (URLSearchParams breaks LinkedIn `ids`). */
function linkedInQueryString(params?: Record<string, string>): string {
  if (!params || Object.keys(params).length === 0) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    const encodedKey = encodeURIComponent(key);
    if (/^List\(/i.test(value)) {
      parts.push(`${encodedKey}=${value}`);
    } else {
      parts.push(`${encodedKey}=${encodeURIComponent(value)}`);
    }
  }
  return `?${parts.join("&")}`;
}

export async function linkedInRestGet<T>(
  accessToken: string,
  path: string,
  params?: Record<string, string>,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const qs = linkedInQueryString(params);
  const res = await fetch(`${LINKEDIN_API_BASE}${path}${qs}`, {
    headers: { ...linkedInRestHeaders(accessToken), ...extraHeaders },
  });
  const json = await res.json().catch(() => ({})) as T & LinkedInApiError & {
    error?: { message?: string; errorDetails?: unknown };
  };
  if (!res.ok) {
    throw new Error(linkedInErrorMessage(json, res.status));
  }
  return json;
}

export async function fetchLinkedInAdministeredPages(accessToken: string): Promise<LinkedInPageRow[]> {
  // LinkedIn rejects OR-lists in `role` (e.g. "(ADMINISTRATOR|CONTENT_ADMINISTRATOR)") as Invalid param.
  // Fetch approved ACLs for the member, then keep page-admin roles client-side.
  const aclJson = await linkedInRestGet<{
    elements?: Array<{
      organization?: string;
      organizationTarget?: string;
      role?: string;
      state?: string;
    }>;
  }>(
    accessToken,
    "/rest/organizationAcls",
    {
      q: "roleAssignee",
      state: "APPROVED",
    },
  );

  const orgIds = new Set<string>();
  for (const el of aclJson.elements ?? []) {
    const role = String(el.role ?? "").trim().toUpperCase();
    if (!LINKEDIN_PAGE_ADMIN_ROLES.has(role)) continue;
    const orgUrn = String(el.organization ?? el.organizationTarget ?? "").trim();
    const orgId = parseOrganizationIdFromUrn(orgUrn);
    if (orgId) orgIds.add(orgId);
  }

  if (orgIds.size === 0) return [];

  type OrgLookup = {
    id?: number;
    localizedName?: string;
    vanityName?: string;
    logoV2?: {
      original?: string;
      "original~": { elements?: Array<{ identifiers?: Array<{ identifier?: string }> }> };
    };
  };

  const pages: LinkedInPageRow[] = [];
  const idList = [...orgIds];

  // Prefer per-id GET — batch `ids=List(...)` via URLSearchParams was rejected as
  // "Invalid value type for parameter ids" on LinkedIn-Version 202610.
  for (const orgId of idList) {
    try {
      const org = await linkedInRestGet<OrgLookup>(
        accessToken,
        `/rest/organizations/${encodeURIComponent(orgId)}`,
      );
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
    } catch (e) {
      console.warn(
        "linkedin organization lookup failed:",
        orgId,
        e instanceof Error ? e.message : e,
      );
      pages.push({
        page_id: orgId,
        title: `LinkedIn ${orgId}`,
        thumbnail_url: null,
        vanity_name: null,
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

type ShareStatisticsElement = {
  share?: string;
  ugcPost?: string;
  totalShareStatistics?: { impressionCount?: number };
};

/**
 * Lifetime organic impressions per post via organizationalEntityShareStatistics.
 * Missing elements ⇒ treat as 0. Soft-fails per batch (does not throw).
 */
export async function fetchShareImpressionCounts(
  accessToken: string,
  pageId: string,
  postUrns: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const unique = [...new Set(postUrns.map((u) => String(u ?? "").trim()).filter(Boolean))];
  for (const urn of unique) map.set(urn, 0);
  if (unique.length === 0) return map;

  const orgUrn = buildOrganizationUrn(pageId);
  const ugcPosts = unique.filter((u) => /^urn:li:ugcPost:/i.test(u));
  const shares = unique.filter((u) => /^urn:li:share:/i.test(u));
  const other = unique.filter(
    (u) => !/^urn:li:ugcPost:/i.test(u) && !/^urn:li:share:/i.test(u),
  );
  if (other.length > 0) {
    console.warn(
      "fetchShareImpressionCounts: unsupported urn types (skipped):",
      other.slice(0, 5),
    );
  }

  async function fetchBatch(
    paramKey: "ugcPosts" | "shares",
    batch: string[],
  ): Promise<void> {
    if (batch.length === 0) return;
    const encoded = batch.map((u) => encodeURIComponent(u)).join(",");
    const listParam = `List(${encoded})`;
    try {
      const json = await linkedInRestGet<{ elements?: ShareStatisticsElement[] }>(
        accessToken,
        "/rest/organizationalEntityShareStatistics",
        {
          q: "organizationalEntity",
          organizationalEntity: orgUrn,
          [paramKey]: listParam,
        },
        { "X-RestLi-Method": "FINDER" },
      );
      for (const el of json.elements ?? []) {
        const urn = String(el.ugcPost ?? el.share ?? "").trim();
        if (!urn) continue;
        const impressions = Number(el.totalShareStatistics?.impressionCount ?? 0);
        map.set(urn, Number.isFinite(impressions) && impressions > 0 ? impressions : 0);
      }
    } catch (e) {
      console.warn(
        `fetchShareImpressionCounts ${paramKey} batch:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  const BATCH = 20;
  for (let i = 0; i < ugcPosts.length; i += BATCH) {
    await fetchBatch("ugcPosts", ugcPosts.slice(i, i + BATCH));
  }
  for (let i = 0; i < shares.length; i += BATCH) {
    await fetchBatch("shares", shares.slice(i, i + BATCH));
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

type LinkedInAuthorPostDraft = {
  id: string;
  title: string;
  published_at: string;
  thumbnail_url: string | null;
};

/** List posts for an author URN (organization or person) within a date range. */
export async function fetchLinkedInPostsByAuthor(
  accessToken: string,
  authorUrn: string,
  dateStartYmd: string,
  dateEndYmd: string,
  maxPages = 20,
): Promise<LinkedInAuthorPostDraft[]> {
  const startMs = new Date(`${dateStartYmd}T00:00:00.000Z`).getTime();
  const endMs = new Date(`${dateEndYmd}T23:59:59.999Z`).getTime();
  const postsInRange: LinkedInAuthorPostDraft[] = [];

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

  return postsInRange;
}

type MemberAnalyticsQueryType = "IMPRESSION" | "REACTION" | "COMMENT" | "RESHARE";

/**
 * Member creator post analytics (TOTAL aggregation). Soft-fails to 0 per post.
 * Docs: GET /rest/memberCreatorPostAnalytics?q=entity&entity=(ugc:…|share:…)&queryType=…&aggregation=TOTAL
 */
export async function fetchMemberCreatorPostAnalytics(
  accessToken: string,
  postUrns: string[],
  queryType: MemberAnalyticsQueryType,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const unique = [...new Set(postUrns.map((u) => String(u ?? "").trim()).filter(Boolean))];
  for (const urn of unique) map.set(urn, 0);
  if (unique.length === 0) return map;

  for (const urn of unique) {
    try {
      const entityParam = urn.startsWith("urn:li:share:")
        ? `(share:${encodeURIComponent(urn)})`
        : `(ugc:${encodeURIComponent(urn)})`;
      const json = await linkedInRestGet<{
        elements?: Array<{ count?: number; totalCount?: number; value?: number }>;
      }>(accessToken, "/rest/memberCreatorPostAnalytics", {
        q: "entity",
        entity: entityParam,
        queryType,
        aggregation: "TOTAL",
      });
      const el = json.elements?.[0];
      const count = Number(el?.count ?? el?.totalCount ?? el?.value ?? 0) || 0;
      map.set(urn, count);
    } catch (e) {
      console.warn("linkedin memberCreatorPostAnalytics:", queryType, urn, e);
    }
  }
  return map;
}

export async function fetchLinkedInOrganizationPosts(
  accessToken: string,
  pageId: string,
  dateStartYmd: string,
  dateEndYmd: string,
  maxPages = 20,
): Promise<LinkedInPostRow[]> {
  const postsInRange = await fetchLinkedInPostsByAuthor(
    accessToken,
    buildOrganizationUrn(pageId),
    dateStartYmd,
    dateEndYmd,
    maxPages,
  );

  const postUrns = postsInRange.map((p) => p.id);
  const [metadataMap, impressionMap] = await Promise.all([
    fetchSocialMetadata(accessToken, postUrns),
    fetchShareImpressionCounts(accessToken, pageId, postUrns),
  ]);

  const posts: LinkedInPostRow[] = postsInRange.map((p) => {
    const meta = metadataMap.get(p.id);
    return {
      id: p.id,
      title: p.title,
      published_at: p.published_at,
      thumbnail_url: p.thumbnail_url,
      view_count: impressionMap.get(p.id) ?? 0,
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

/** Personal profile posts + member analytics (views); engagement via socialMetadata with analytics fallback. */
export async function fetchLinkedInMemberPosts(
  accessToken: string,
  personId: string,
  dateStartYmd: string,
  dateEndYmd: string,
  maxPages = 20,
): Promise<LinkedInPostRow[]> {
  const postsInRange = await fetchLinkedInPostsByAuthor(
    accessToken,
    buildPersonUrn(personId),
    dateStartYmd,
    dateEndYmd,
    maxPages,
  );

  const postUrns = postsInRange.map((p) => p.id);
  const [metadataMap, impressionMap, reactionMap, commentMap, reshareMap] = await Promise.all([
    fetchSocialMetadata(accessToken, postUrns),
    fetchMemberCreatorPostAnalytics(accessToken, postUrns, "IMPRESSION"),
    fetchMemberCreatorPostAnalytics(accessToken, postUrns, "REACTION"),
    fetchMemberCreatorPostAnalytics(accessToken, postUrns, "COMMENT"),
    fetchMemberCreatorPostAnalytics(accessToken, postUrns, "RESHARE"),
  ]);

  const posts: LinkedInPostRow[] = postsInRange.map((p) => {
    const meta = metadataMap.get(p.id);
    return {
      id: p.id,
      title: p.title,
      published_at: p.published_at,
      thumbnail_url: p.thumbnail_url,
      view_count: impressionMap.get(p.id) ?? 0,
      like_count: meta?.like_count || reactionMap.get(p.id) || 0,
      comment_count: meta?.comment_count || commentMap.get(p.id) || 0,
      share_count: meta?.share_count || reshareMap.get(p.id) || 0,
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
  /** Resolved display name after hydrate; never a raw URN. */
  author_name: string | null;
  author_avatar_url: string | null;
  /** Raw LinkedIn actor URN (person / organization) for hydrate. */
  actor_urn: string | null;
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
  const json = await res.json().catch(() => ({})) as T & LinkedInApiError & {
    error?: { message?: string; errorDetails?: unknown };
  };
  if (!res.ok) {
    throw new Error(linkedInErrorMessage(json, res.status));
  }
  return json;
}

function parseLinkedInCommentId(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  // urn:li:comment:(urn:li:activity:123,456) → 456
  const composite = /,\s*(\d+)\)\s*$/.exec(s);
  if (composite?.[1]) return composite[1];
  const m = /comment[:(](\d+)/.exec(s);
  return m?.[1] ?? s;
}

function linkedInCommentRawUrn(el: Record<string, unknown>): string {
  return String(el.$URN ?? el.commentUrn ?? el.urn ?? "").trim();
}

/** Extract thread URN (activity/share/ugcPost) from a composite comment URN. */
function parseThreadUrnFromCommentUrn(raw: string): string | null {
  const m = /urn:li:comment:\((urn:li:(?:activity|share|ugcPost):[^,]+)\s*,/i.exec(raw);
  return m?.[1]?.trim() || null;
}

function buildLinkedInCommentUrn(activityOrShareUrn: string, commentId: string): string {
  const trimmed = String(commentId ?? "").trim();
  if (trimmed.includes("urn:li:comment:")) return trimmed;
  const id = parseLinkedInCommentId(trimmed);
  return `urn:li:comment:(${activityOrShareUrn},${id})`;
}

function resolveActivityUrnFromCommentElements(
  elements: Array<Record<string, unknown>>,
  fallbackUrn: string,
): string {
  for (const el of elements) {
    const obj = String(el.object ?? "").trim();
    if (obj.startsWith("urn:li:activity:")) return obj;
    const fromUrn = parseThreadUrnFromCommentUrn(linkedInCommentRawUrn(el));
    if (fromUrn?.startsWith("urn:li:activity:")) return fromUrn;
  }
  for (const el of elements) {
    const fromUrn = parseThreadUrnFromCommentUrn(linkedInCommentRawUrn(el));
    if (fromUrn) return fromUrn;
  }
  return fallbackUrn;
}

function mapLinkedInCommentElement(
  el: Record<string, unknown>,
  postUrn: string,
  pageUrn: string,
  forcedParentId?: string | null,
): LinkedInContentComment {
  const actor = String(el.actor ?? "").trim();
  const rawId = linkedInCommentRawUrn(el) || el.id;
  const id = parseLinkedInCommentId(rawId);
  const parentRaw = el.parentComment != null ? String(el.parentComment) : "";
  const parentId = forcedParentId != null && forcedParentId !== ""
    ? parseLinkedInCommentId(forcedParentId)
    : parentRaw
    ? parseLinkedInCommentId(parentRaw)
    : null;
  const message = el.message as { text?: string } | undefined;
  const createdMs = Number(
    (el.created as { time?: number } | undefined)?.time ?? el.createdAt ?? 0,
  );
  const commentsSummary = el.commentsSummary as { count?: number; totalFirstLevelComments?: number } | undefined;
  const replyCount = Number(commentsSummary?.count ?? commentsSummary?.totalFirstLevelComments ?? 0) || 0;
  return {
    id,
    post_id: postUrn,
    text: String(message?.text ?? "").trim(),
    // Name/avatar filled by hydrateLinkedInCommentAuthors — never pass raw URN here.
    author_name: null,
    author_avatar_url: null,
    actor_urn: actor || null,
    like_count: 0,
    reply_count: replyCount,
    parent_comment_id: parentId,
    published_at: Number.isFinite(createdMs) && createdMs > 0
      ? new Date(createdMs).toISOString()
      : null,
    is_owner: actor === pageUrn,
    can_reply: true,
  };
}

/** Rest.li 2.0 resource keys: encodeURIComponent leaves `()` intact — LinkedIn requires %28/%29. */
export function encodeLinkedInRestliUrn(urn: string): string {
  return encodeURIComponent(urn).replace(/\(/g, "%28").replace(/\)/g, "%29");
}

async function linkedInRestGetCommentsOrEmpty(
  accessToken: string,
  targetUrn: string,
  count: number,
): Promise<Array<Record<string, unknown>>> {
  const encodedUrn = encodeLinkedInRestliUrn(targetUrn);
  try {
    // Docs: GET /rest/socialActions/{urn}/comments — no `q=` finder param.
    const json = await linkedInRestGet<{
      elements?: Array<Record<string, unknown>>;
    }>(accessToken, `/rest/socialActions/${encodedUrn}/comments`, {
      count: String(count),
    });
    return json.elements ?? [];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // LinkedIn returns 404 / RESOURCE_NOT_FOUND when a share has no socialActions yet.
    if (/404|not found|RESOURCE_NOT_FOUND|No virtual resource found/i.test(msg)) {
      return [];
    }
    throw e;
  }
}

async function fetchNestedRepliesForParent(
  accessToken: string,
  postUrn: string,
  pageUrn: string,
  parentEl: Record<string, unknown>,
  parentId: string,
  activityUrn: string,
): Promise<LinkedInContentComment[]> {
  const rawUrn = linkedInCommentRawUrn(parentEl);
  const threadFromRaw = rawUrn ? parseThreadUrnFromCommentUrn(rawUrn) : null;
  const candidateUrns = Array.from(
    new Set(
      [
        rawUrn.includes("urn:li:comment:") ? rawUrn : "",
        threadFromRaw ? buildLinkedInCommentUrn(threadFromRaw, parentId) : "",
        activityUrn ? buildLinkedInCommentUrn(activityUrn, parentId) : "",
        postUrn && postUrn !== activityUrn ? buildLinkedInCommentUrn(postUrn, parentId) : "",
      ].filter(Boolean),
    ),
  );

  for (const parentUrn of candidateUrns) {
    try {
      const nested = await linkedInRestGetCommentsOrEmpty(accessToken, parentUrn, 50);
      if (nested.length === 0) continue;
      return nested.map((el) => mapLinkedInCommentElement(el, postUrn, pageUrn, parentId));
    } catch {
      // try next candidate URN
    }
  }
  return [];
}

export async function fetchLinkedInComments(
  accessToken: string,
  postUrn: string,
  pageId: string,
): Promise<LinkedInContentComment[]> {
  const pageUrn = buildOrganizationUrn(pageId);
  const elements = await linkedInRestGetCommentsOrEmpty(accessToken, postUrn, 100);
  const activityUrn = resolveActivityUrnFromCommentElements(elements, postUrn);

  const topLevelEls = elements.filter((el) => el.parentComment == null || String(el.parentComment).trim() === "");
  const inlineNestedEls = elements.filter((el) => el.parentComment != null && String(el.parentComment).trim() !== "");

  const topLevel = topLevelEls.map((el) => mapLinkedInCommentElement(el, postUrn, pageUrn));
  const all: LinkedInContentComment[] = [...topLevel];

  for (const el of inlineNestedEls) {
    all.push(mapLinkedInCommentElement(el, postUrn, pageUrn));
  }

  const seenIds = new Set(all.map((c) => c.id).filter(Boolean));

  for (let i = 0; i < topLevelEls.length; i++) {
    const parentEl = topLevelEls[i];
    const parent = topLevel[i];
    if (!parent?.id) continue;
    const nested = await fetchNestedRepliesForParent(
      accessToken,
      postUrn,
      pageUrn,
      parentEl,
      parent.id,
      activityUrn,
    );
    for (const reply of nested) {
      if (!reply.id || seenIds.has(reply.id)) continue;
      seenIds.add(reply.id);
      all.push(reply);
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

  // Resolve activity URN from existing comments when possible (required for parentComment composite URN).
  let activityUrn = postUrn;
  try {
    const existing = await linkedInRestGetCommentsOrEmpty(accessToken, postUrn, 10);
    activityUrn = resolveActivityUrnFromCommentElements(existing, postUrn);
  } catch {
    // fall back to postUrn
  }

  const parentComment = buildLinkedInCommentUrn(activityUrn, parentCommentId);

  const body: Record<string, unknown> = {
    actor: pageUrn,
    object: activityUrn.startsWith("urn:li:activity:") ? activityUrn : postUrn,
    message: { text: text.trim() },
    parentComment,
  };

  const res = await linkedInRestPost<{ id?: string; commentUrn?: string }>(
    accessToken,
    `/rest/socialActions/${encodedUrn}/comments`,
    body,
  );
  const id = parseLinkedInCommentId(res.commentUrn ?? res.id);
  return { id: id || "pending" };
}
