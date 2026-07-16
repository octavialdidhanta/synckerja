/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  fetchMetaMediaPreviewById,
  resolveFacebookPostsForMetrics,
  resolveInstagramPostsForMetrics,
} from "../_shared/metaContentApi.ts";
import {
  getUserFromBearer,
  metaContentCorsHeaders,
  metaContentJson,
  requireActiveOrg,
  resolveMetaContentAccount,
} from "../_shared/metaContentAuth.ts";
import { LEAD_MAGNET_DEFAULT_MESSAGES } from "../_shared/leadMagnet/types.ts";
import { resolveLeadMagnetEntitlement } from "../_shared/leadMagnet/leadMagnetEntitlement.ts";
import {
  buildLeadMagnetAssetPublicUrl,
  isAllowedLeadMagnetDeliveryMime,
  LEAD_MAGNET_DELIVERY_MAX_BYTES,
  parseLeadMagnetDeliveryMode,
} from "../_shared/leadMagnet/deliveryAsset.ts";

const CAMPAIGN_SELECT =
  "*, lead_magnet_campaign_posts(*), lead_magnet_campaign_accounts(*)";

type CampaignMetrics = {
  new_followers: number;
  non_follower_at_start: number;
  total_enrollments: number;
};

const EMPTY_METRICS: CampaignMetrics = {
  new_followers: 0,
  non_follower_at_start: 0,
  total_enrollments: 0,
};

async function fetchCampaignMetricsByOrg(
  admin: ReturnType<typeof createClient>,
  organizationId: string,
): Promise<Map<string, CampaignMetrics>> {
  const { data, error } = await admin
    .from("lead_magnet_enrollments")
    .select("campaign_id, is_follower_at_start, became_follower_at")
    .eq("organization_id", organizationId);
  if (error) throw error;

  const map = new Map<string, CampaignMetrics>();
  for (const row of data ?? []) {
    const campaignId = String(row.campaign_id);
    const current = map.get(campaignId) ?? { ...EMPTY_METRICS };
    current.total_enrollments += 1;
    if (row.is_follower_at_start === false) {
      current.non_follower_at_start += 1;
    }
    if (row.became_follower_at != null) {
      current.new_followers += 1;
    }
    map.set(campaignId, current);
  }
  return map;
}

function metricsForCampaign(
  metricsMap: Map<string, CampaignMetrics>,
  campaignId: string,
): CampaignMetrics {
  return metricsMap.get(campaignId) ?? { ...EMPTY_METRICS };
}

type CampaignAccountRow = { platform: string; account_id: string };
type CampaignPostRow = {
  id?: string;
  platform: string;
  media_id: string;
  media_permalink?: string | null;
  media_caption?: string | null;
  media_thumbnail_url?: string | null;
};

type CampaignListRow = Record<string, unknown> & {
  id: string;
  lead_magnet_campaign_posts?: CampaignPostRow[];
  lead_magnet_campaign_accounts?: CampaignAccountRow[];
};

async function enrichCampaignsPostPreviews(
  admin: ReturnType<typeof createClient>,
  organizationId: string,
  campaigns: CampaignListRow[],
): Promise<CampaignListRow[]> {
  type EnrichTarget = {
    platform: "instagram" | "facebook";
    accountId: string;
    mediaId: string;
  };

  const uniqueTargets = new Map<string, EnrichTarget>();
  for (const campaign of campaigns) {
    const accounts = campaign.lead_magnet_campaign_accounts ?? [];
    for (const post of campaign.lead_magnet_campaign_posts ?? []) {
      const caption = String(post.media_caption ?? "").trim();
      const thumb = String(post.media_thumbnail_url ?? "").trim();
      if (caption && thumb) continue;
      const platform = parsePlatform(post.platform);
      const mediaId = String(post.media_id ?? "").trim();
      if (!platform || !mediaId) continue;
      const account = accounts.find((a) => parsePlatform(a.platform) === platform);
      if (!account?.account_id) continue;
      const key = `${platform}:${mediaId}`;
      if (!uniqueTargets.has(key)) {
        uniqueTargets.set(key, { platform, accountId: String(account.account_id), mediaId });
      }
    }
  }

  if (uniqueTargets.size === 0) return campaigns;

  const tokenCache = new Map<string, { token: string | null; pageId: string | null }>();
  const previewByKey = new Map<string, Awaited<ReturnType<typeof fetchMetaMediaPreviewById>>>();

  await Promise.all([...uniqueTargets.entries()].map(async ([key, target]) => {
    const tokenKey = `${target.platform}:${target.accountId}`;
    if (!tokenCache.has(tokenKey)) {
      tokenCache.set(
        tokenKey,
        await resolveAccountToken(admin, organizationId, target.platform, target.accountId),
      );
    }
    const { token } = tokenCache.get(tokenKey)!;
    if (!token) return;
    const preview = await fetchMetaMediaPreviewById(target.mediaId, target.platform, token);
    if (preview) previewByKey.set(key, preview);
  }));

  if (previewByKey.size === 0) return campaigns;

  const persistUpdates: Promise<unknown>[] = [];

  const enriched = campaigns.map((campaign) => {
    const posts = campaign.lead_magnet_campaign_posts ?? [];
    const enrichedPosts = posts.map((post) => {
      const platform = parsePlatform(post.platform);
      const mediaId = String(post.media_id ?? "").trim();
      if (!platform || !mediaId) return post;
      const preview = previewByKey.get(`${platform}:${mediaId}`);
      if (!preview) return post;

      const caption = String(post.media_caption ?? "").trim()
        || preview.caption?.trim().slice(0, 500)
        || null;
      const thumbnail = String(post.media_thumbnail_url ?? "").trim()
        || preview.thumbnail_url?.trim()
        || null;
      const permalink = String(post.media_permalink ?? "").trim()
        || preview.permalink?.trim()
        || null;

      if (
        caption === (post.media_caption ?? null)
        && thumbnail === (post.media_thumbnail_url ?? null)
        && permalink === (post.media_permalink ?? null)
      ) {
        return post;
      }

      if (post.id) {
        persistUpdates.push(
          admin.from("lead_magnet_campaign_posts").update({
            media_caption: caption,
            media_thumbnail_url: thumbnail,
            media_permalink: permalink,
          }).eq("id", post.id).then(() => undefined),
        );
      }

      return {
        ...post,
        media_caption: caption,
        media_thumbnail_url: thumbnail,
        media_permalink: permalink,
      };
    });

    return { ...campaign, lead_magnet_campaign_posts: enrichedPosts };
  });

  void Promise.allSettled(persistUpdates);
  return enriched;
}

function parsePlatform(raw: unknown): "instagram" | "facebook" | null {
  const p = String(raw ?? "").trim().toLowerCase();
  if (p === "instagram" || p === "facebook") return p;
  return null;
}

function isValidHttpsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

type AccountPayload = { platform: "instagram" | "facebook"; account_id: string };
type PostPayload = {
  platform: "instagram" | "facebook";
  media_id: string;
  media_permalink?: string | null;
  media_caption?: string | null;
  media_thumbnail_url?: string | null;
};

type CampaignPayload = {
  name?: string;
  platform?: string;
  account_id?: string;
  accounts?: AccountPayload[];
  keyword?: string;
  comment_reply_text?: string;
  follow_gate_text?: string;
  follow_button_label?: string;
  framework_offer_text?: string;
  framework_button_label?: string;
  delivery_text?: string;
  delivery_button_label?: string;
  delivery_url?: string;
  delivery_mode?: string;
  delivery_storage_path?: string | null;
  delivery_file_name?: string | null;
  delivery_file_mime?: string | null;
  delivery_file_size_bytes?: number | null;
  skip_follow_gate_if_follower?: boolean;
  skip_material_offer?: boolean;
  posts?: PostPayload[];
};

function normalizeAccounts(body: CampaignPayload): AccountPayload[] {
  if (Array.isArray(body.accounts) && body.accounts.length > 0) {
    const seen = new Set<string>();
    const out: AccountPayload[] = [];
    for (const raw of body.accounts) {
      const platform = parsePlatform(raw?.platform);
      const account_id = String(raw?.account_id ?? "").trim();
      if (!platform || !account_id || seen.has(platform)) continue;
      seen.add(platform);
      out.push({ platform, account_id });
    }
    return out;
  }
  const platform = parsePlatform(body.platform);
  const account_id = String(body.account_id ?? "").trim();
  if (platform && account_id) return [{ platform, account_id }];
  return [];
}

function normalizePosts(body: CampaignPayload): PostPayload[] {
  if (!Array.isArray(body.posts)) return [];
  return body.posts
    .map((p) => {
      const platform = parsePlatform(p?.platform);
      const media_id = String(p?.media_id ?? "").trim();
      if (!platform || !media_id) return null;
      return {
        platform,
        media_id,
        media_permalink: p.media_permalink ? String(p.media_permalink).trim() : null,
        media_caption: p.media_caption ? String(p.media_caption).trim().slice(0, 500) : null,
        media_thumbnail_url: p.media_thumbnail_url ? String(p.media_thumbnail_url).trim() : null,
      };
    })
    .filter((p): p is PostPayload => p != null);
}

function normalizeCampaignPayload(body: CampaignPayload) {
  const accounts = normalizeAccounts(body);
  const deliveryMode = parseLeadMagnetDeliveryMode(body.delivery_mode);
  const storagePath = body.delivery_storage_path != null
    ? String(body.delivery_storage_path).trim()
    : null;
  const fileSizeRaw = body.delivery_file_size_bytes;
  const fileSize = fileSizeRaw != null && Number.isFinite(Number(fileSizeRaw))
    ? Math.round(Number(fileSizeRaw))
    : null;

  return {
    name: String(body.name ?? "").trim(),
    accounts,
    keyword: String(body.keyword ?? "").trim(),
    comment_reply_text: String(body.comment_reply_text ?? LEAD_MAGNET_DEFAULT_MESSAGES.comment_reply_text).trim(),
    follow_gate_text: String(body.follow_gate_text ?? LEAD_MAGNET_DEFAULT_MESSAGES.follow_gate_text).trim(),
    follow_button_label: String(body.follow_button_label ?? LEAD_MAGNET_DEFAULT_MESSAGES.follow_button_label).trim(),
    framework_offer_text: String(body.framework_offer_text ?? LEAD_MAGNET_DEFAULT_MESSAGES.framework_offer_text).trim(),
    framework_button_label: String(body.framework_button_label ?? LEAD_MAGNET_DEFAULT_MESSAGES.framework_button_label).trim(),
    delivery_text: String(body.delivery_text ?? LEAD_MAGNET_DEFAULT_MESSAGES.delivery_text).trim(),
    delivery_button_label: String(body.delivery_button_label ?? LEAD_MAGNET_DEFAULT_MESSAGES.delivery_button_label).trim(),
    delivery_url: String(body.delivery_url ?? "").trim(),
    delivery_mode: deliveryMode,
    delivery_storage_path: storagePath || null,
    delivery_file_name: body.delivery_file_name != null
      ? String(body.delivery_file_name).trim() || null
      : null,
    delivery_file_mime: body.delivery_file_mime != null
      ? String(body.delivery_file_mime).trim().toLowerCase() || null
      : null,
    delivery_file_size_bytes: fileSize,
    skip_follow_gate_if_follower: body.skip_follow_gate_if_follower === true,
    skip_material_offer: body.skip_material_offer === true,
    posts: normalizePosts(body),
  };
}

function validateDeliveryAsset(
  payload: ReturnType<typeof normalizeCampaignPayload>,
  orgId: string,
  campaignId: string | null,
  supabaseUrl: string,
  strict: boolean,
): string | null {
  if (payload.delivery_mode === "link") {
    if (strict) {
      if (!payload.delivery_url || !isValidHttpsUrl(payload.delivery_url)) {
        return "delivery_url harus HTTPS valid";
      }
    } else if (payload.delivery_url && !isValidHttpsUrl(payload.delivery_url)) {
      return "delivery_url harus HTTPS valid";
    }
    return null;
  }

  if (!strict) {
    if (payload.delivery_url && !isValidHttpsUrl(payload.delivery_url)) {
      return "delivery_url harus HTTPS valid";
    }
    return null;
  }

  if (!campaignId) return "Campaign ID diperlukan untuk delivery upload";
  if (!payload.delivery_storage_path) return "File framework wajib di-upload";
  const parts = payload.delivery_storage_path.split("/").filter(Boolean);
  if (parts.length < 3 || parts[0] !== orgId) {
    return "Path file delivery tidak valid";
  }
  if (!payload.delivery_file_name) return "Nama file delivery wajib diisi";
  if (!payload.delivery_file_mime || !isAllowedLeadMagnetDeliveryMime(payload.delivery_file_mime)) {
    return "Tipe file tidak didukung (PDF, DOCX, XLSX, PPTX saja)";
  }
  if (
    payload.delivery_file_size_bytes == null
    || payload.delivery_file_size_bytes <= 0
    || payload.delivery_file_size_bytes > LEAD_MAGNET_DELIVERY_MAX_BYTES
  ) {
    return "Ukuran file maksimal 25 MB";
  }
  if (!payload.delivery_url || !isValidHttpsUrl(payload.delivery_url)) {
    return "delivery_url harus HTTPS valid";
  }
  const expectedUrl = buildLeadMagnetAssetPublicUrl(supabaseUrl, payload.delivery_storage_path);
  if (payload.delivery_url !== expectedUrl) {
    return "delivery_url tidak sesuai dengan file yang di-upload";
  }
  return null;
}

function validateCampaignPayload(
  payload: ReturnType<typeof normalizeCampaignPayload>,
  requirePosts: boolean,
  orgId: string,
  campaignId: string | null,
  supabaseUrl: string,
): string | null {
  if (!payload.name) return "name wajib diisi";
  if (payload.accounts.length === 0) return "Minimal satu platform dengan akun wajib dipilih";
  if (!payload.keyword) return "keyword wajib diisi";
  if (!payload.comment_reply_text || !payload.follow_gate_text || !payload.delivery_text) {
    return "Semua teks pesan wajib diisi";
  }
  if (!payload.skip_material_offer) {
    if (!payload.framework_offer_text || !payload.framework_button_label) {
      return "Teks dan label material offer wajib diisi";
    }
  }
  const deliveryErr = validateDeliveryAsset(payload, orgId, campaignId, supabaseUrl, requirePosts);
  if (deliveryErr) return deliveryErr;

  const activePlatforms = new Set(payload.accounts.map((a) => a.platform));
  if (requirePosts) {
    for (const platform of activePlatforms) {
      const count = payload.posts.filter((p) => p.platform === platform).length;
      if (count === 0) {
        return platform === "instagram"
          ? "Minimal satu post Instagram harus dipilih"
          : "Minimal satu post Facebook harus dipilih";
      }
    }
  }

  for (const p of payload.posts) {
    if (!p.media_id) return "media_id post tidak valid";
    if (!activePlatforms.has(p.platform)) {
      return "Post platform harus sesuai platform yang aktif";
    }
  }
  return null;
}

function legacyMirrorFromAccounts(accounts: AccountPayload[]): {
  platform: "instagram" | "facebook" | null;
  account_id: string | null;
} {
  const ig = accounts.find((a) => a.platform === "instagram");
  const fb = accounts.find((a) => a.platform === "facebook");
  const primary = ig ?? fb ?? null;
  return {
    platform: primary?.platform ?? null,
    account_id: primary?.account_id ?? null,
  };
}

async function upsertCampaignAccounts(
  admin: ReturnType<typeof createClient>,
  campaignId: string,
  accounts: AccountPayload[],
): Promise<void> {
  await admin.from("lead_magnet_campaign_accounts").delete().eq("campaign_id", campaignId);
  if (accounts.length === 0) return;
  await admin.from("lead_magnet_campaign_accounts").insert(
    accounts.map((a) => ({
      campaign_id: campaignId,
      platform: a.platform,
      account_id: a.account_id,
    })),
  );
}

async function upsertCampaignPosts(
  admin: ReturnType<typeof createClient>,
  campaignId: string,
  posts: PostPayload[],
): Promise<void> {
  await admin.from("lead_magnet_campaign_posts").delete().eq("campaign_id", campaignId);
  if (posts.length === 0) return;
  await admin.from("lead_magnet_campaign_posts").insert(
    posts.map((p) => ({
      campaign_id: campaignId,
      platform: p.platform,
      media_id: p.media_id,
      media_permalink: p.media_permalink ?? null,
      media_caption: p.media_caption ?? null,
      media_thumbnail_url: p.media_thumbnail_url ?? null,
    })),
  );
}

async function fetchCampaignFull(
  admin: ReturnType<typeof createClient>,
  campaignId: string,
) {
  const { data, error } = await admin
    .from("lead_magnet_campaigns")
    .select(CAMPAIGN_SELECT)
    .eq("id", campaignId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function resolveAccountToken(
  admin: ReturnType<typeof createClient>,
  organizationId: string,
  platform: "instagram" | "facebook",
  accountId: string,
): Promise<{ token: string | null; pageId: string | null }> {
  const resolved = await resolveMetaContentAccount(admin, organizationId, platform, accountId);
  if (!resolved) return { token: null, pageId: null };
  return {
    token: resolved.pageAccessToken,
    pageId: resolved.pageId,
  };
}

function campaignDeliveryDbFields(payload: ReturnType<typeof normalizeCampaignPayload>) {
  if (payload.delivery_mode === "link") {
    return {
      delivery_mode: "link" as const,
      delivery_url: payload.delivery_url,
      delivery_storage_path: null,
      delivery_file_name: null,
      delivery_file_mime: null,
      delivery_file_size_bytes: null,
    };
  }
  return {
    delivery_mode: "upload" as const,
    delivery_url: payload.delivery_url,
    delivery_storage_path: payload.delivery_storage_path,
    delivery_file_name: payload.delivery_file_name,
    delivery_file_mime: payload.delivery_file_mime,
    delivery_file_size_bytes: payload.delivery_file_size_bytes,
  };
}

function campaignPayloadFromRow(row: Record<string, unknown>): CampaignPayload {
  const accounts = (row.lead_magnet_campaign_accounts as AccountPayload[] | null) ?? [];
  const posts = (row.lead_magnet_campaign_posts as PostPayload[] | null) ?? [];
  return {
    name: String(row.name ?? ""),
    accounts: accounts.length
      ? accounts.map((a) => ({ platform: a.platform, account_id: String(a.account_id) }))
      : row.platform && row.account_id
      ? [{ platform: parsePlatform(row.platform)!, account_id: String(row.account_id) }]
      : [],
    keyword: String(row.keyword ?? ""),
    comment_reply_text: String(row.comment_reply_text ?? ""),
    follow_gate_text: String(row.follow_gate_text ?? ""),
    follow_button_label: String(row.follow_button_label ?? ""),
    framework_offer_text: String(row.framework_offer_text ?? ""),
    framework_button_label: String(row.framework_button_label ?? ""),
    delivery_text: String(row.delivery_text ?? ""),
    delivery_button_label: String(row.delivery_button_label ?? ""),
    delivery_url: String(row.delivery_url ?? ""),
    delivery_mode: parseLeadMagnetDeliveryMode(row.delivery_mode),
    delivery_storage_path: row.delivery_storage_path != null
      ? String(row.delivery_storage_path)
      : null,
    delivery_file_name: row.delivery_file_name != null ? String(row.delivery_file_name) : null,
    delivery_file_mime: row.delivery_file_mime != null ? String(row.delivery_file_mime) : null,
    delivery_file_size_bytes: row.delivery_file_size_bytes != null
      ? Number(row.delivery_file_size_bytes)
      : null,
    skip_follow_gate_if_follower: row.skip_follow_gate_if_follower === true,
    skip_material_offer: row.skip_material_offer === true,
    posts: posts.map((p) => ({
      platform: parsePlatform(p.platform) ?? "instagram",
      media_id: String(p.media_id),
      media_permalink: p.media_permalink ?? null,
      media_caption: (p as { media_caption?: string | null }).media_caption ?? null,
      media_thumbnail_url: (p as { media_thumbnail_url?: string | null }).media_thumbnail_url ?? null,
    })),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: metaContentCorsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return metaContentJson({ error: "Server misconfigured" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
    if ("error" in userRes) return userRes.error;

    const { data: profile } = await admin
      .from("profiles")
      .select("active_organization_id")
      .eq("user_id", userRes.userId)
      .maybeSingle();
    const orgId = profile?.active_organization_id as string | null;
    if (!orgId) return metaContentJson({ error: "No active organization" }, 400);

    const entitlement = await resolveLeadMagnetEntitlement(admin, orgId);
    if (!entitlement.entitled) {
      return metaContentJson(
        { error: "Lead Magnet add-on is not activated", code: "LEAD_MAGNET_NOT_ENTITLED" },
        403,
      );
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const fnIndex = pathParts.indexOf("lead-magnet-api");
    const subPath = fnIndex >= 0 ? pathParts.slice(fnIndex + 1) : [];
    const campaignId = subPath[0] ?? null;
    const action = subPath[1] ?? null;

    if (req.method === "GET" && !campaignId) {
      const [{ data, error }, metricsMap] = await Promise.all([
        admin
          .from("lead_magnet_campaigns")
          .select(CAMPAIGN_SELECT)
          .eq("organization_id", orgId)
          .order("updated_at", { ascending: false }),
        fetchCampaignMetricsByOrg(admin, orgId),
      ]);
      if (error) return metaContentJson({ error: error.message }, 500);
      const enriched = await enrichCampaignsPostPreviews(admin, orgId, (data ?? []) as CampaignListRow[]);
      const campaigns = enriched.map((row) => ({
        ...row,
        metrics: metricsForCampaign(metricsMap, String(row.id)),
      }));
      return metaContentJson({ campaigns }, 200);
    }

    if (req.method === "GET" && campaignId && action === "analytics") {
      const { data: events, error: evErr } = await admin
        .from("lead_magnet_funnel_events")
        .select("event_type")
        .eq("campaign_id", campaignId)
        .eq("organization_id", orgId);
      if (evErr) return metaContentJson({ error: evErr.message }, 500);

      const counts: Record<string, number> = {};
      for (const e of events ?? []) {
        const t = String(e.event_type);
        counts[t] = (counts[t] ?? 0) + 1;
      }

      const [{ data: enrollments, error: enErr }, { data: metricRows, error: metricErr }] = await Promise.all([
        admin
          .from("lead_magnet_enrollments")
          .select("*")
          .eq("campaign_id", campaignId)
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .limit(200),
        admin
          .from("lead_magnet_enrollments")
          .select("is_follower_at_start, became_follower_at")
          .eq("campaign_id", campaignId)
          .eq("organization_id", orgId),
      ]);
      if (enErr) return metaContentJson({ error: enErr.message }, 500);
      if (metricErr) return metaContentJson({ error: metricErr.message }, 500);

      const metrics = {
        new_followers: (metricRows ?? []).filter((e) => e.became_follower_at != null).length,
        non_follower_at_start: (metricRows ?? []).filter((e) => e.is_follower_at_start === false).length,
        total_enrollments: metricRows?.length ?? 0,
      };

      return metaContentJson({ funnel: counts, enrollments: enrollments ?? [], metrics }, 200);
    }

    if (req.method === "GET" && campaignId && !action) {
      const { data, error } = await admin
        .from("lead_magnet_campaigns")
        .select(CAMPAIGN_SELECT)
        .eq("id", campaignId)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) return metaContentJson({ error: error.message }, 500);
      if (!data) return metaContentJson({ error: "Not found" }, 404);
      const [enriched] = await enrichCampaignsPostPreviews(admin, orgId, [data as CampaignListRow]);
      return metaContentJson({ campaign: enriched ?? data }, 200);
    }

    let body: Record<string, unknown> = {};
    if (req.method !== "GET" && req.method !== "HEAD") {
      const raw = await req.text();
      if (raw.trim()) {
        try {
          body = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return metaContentJson({ error: "Invalid JSON" }, 400);
        }
      }
    }

    if (req.method === "POST" && campaignId === "listMedia") {
      const platform = parsePlatform(body.platform);
      const accountId = String(body.account_id ?? "").trim();
      if (!platform || !accountId) return metaContentJson({ error: "platform and account_id required" }, 400);

      const forbidden = await requireActiveOrg(admin, userRes.userId, orgId);
      if (forbidden) return forbidden;

      const { token, pageId } = await resolveAccountToken(admin, orgId, platform, accountId);
      if (!token) return metaContentJson({ error: "Account token not found" }, 404);

      const posts = platform === "instagram"
        ? await resolveInstagramPostsForMetrics(accountId, token, 50, undefined, { allTime: true })
        : pageId
        ? await resolveFacebookPostsForMetrics(pageId, token, 50, undefined, { allTime: true })
        : [];

      return metaContentJson({
        posts: posts.map((p) => ({
          media_id: p.id,
          caption: p.caption ?? null,
          permalink: p.permalink ?? null,
          timestamp: p.timestamp ?? null,
          media_type: p.media_type ?? null,
          media_url: p.media_url ?? null,
          thumbnail_url: p.thumbnail_url ?? p.media_url ?? null,
        })),
      }, 200);
    }

    if (req.method === "POST" && !campaignId) {
      const payload = normalizeCampaignPayload(body as CampaignPayload);
      const errMsg = validateCampaignPayload(payload, false, orgId, null, supabaseUrl);
      if (errMsg) return metaContentJson({ error: errMsg }, 400);

      const legacy = legacyMirrorFromAccounts(payload.accounts);

      const { data, error } = await admin
        .from("lead_magnet_campaigns")
        .insert({
          organization_id: orgId,
          name: payload.name,
          platform: legacy.platform,
          account_id: legacy.account_id,
          keyword: payload.keyword,
          status: "draft",
          comment_reply_text: payload.comment_reply_text,
          follow_gate_text: payload.follow_gate_text,
          follow_button_label: payload.follow_button_label,
          framework_offer_text: payload.framework_offer_text,
          framework_button_label: payload.framework_button_label,
          delivery_text: payload.delivery_text,
          delivery_button_label: payload.delivery_button_label,
          ...campaignDeliveryDbFields(payload),
          skip_follow_gate_if_follower: payload.skip_follow_gate_if_follower,
          skip_material_offer: payload.skip_material_offer,
          created_by: userRes.userId,
        })
        .select("*")
        .single();

      if (error) return metaContentJson({ error: error.message }, 500);
      const id = data.id as string;
      await upsertCampaignAccounts(admin, id, payload.accounts);
      if (payload.posts.length) {
        await upsertCampaignPosts(admin, id, payload.posts);
      }

      const full = await fetchCampaignFull(admin, id);
      return metaContentJson({ campaign: full ?? data }, 201);
    }

    if (req.method === "PATCH" && campaignId && !action) {
      const payload = normalizeCampaignPayload(body as CampaignPayload);
      const errMsg = validateCampaignPayload(payload, false, orgId, campaignId, supabaseUrl);
      if (errMsg) return metaContentJson({ error: errMsg }, 400);

      const { data: existing } = await admin
        .from("lead_magnet_campaigns")
        .select("id")
        .eq("id", campaignId)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (!existing) return metaContentJson({ error: "Not found" }, 404);

      const legacy = legacyMirrorFromAccounts(payload.accounts);

      const { error } = await admin
        .from("lead_magnet_campaigns")
        .update({
          name: payload.name,
          platform: legacy.platform,
          account_id: legacy.account_id,
          keyword: payload.keyword,
          comment_reply_text: payload.comment_reply_text,
          follow_gate_text: payload.follow_gate_text,
          follow_button_label: payload.follow_button_label,
          framework_offer_text: payload.framework_offer_text,
          framework_button_label: payload.framework_button_label,
          delivery_text: payload.delivery_text,
          delivery_button_label: payload.delivery_button_label,
          ...campaignDeliveryDbFields(payload),
          skip_follow_gate_if_follower: payload.skip_follow_gate_if_follower,
          skip_material_offer: payload.skip_material_offer,
        })
        .eq("id", campaignId);

      if (error) return metaContentJson({ error: error.message }, 500);
      await upsertCampaignAccounts(admin, campaignId, payload.accounts);
      if (Array.isArray(body.posts)) {
        await upsertCampaignPosts(admin, campaignId, payload.posts);
      }

      const full = await fetchCampaignFull(admin, campaignId);
      return metaContentJson({ campaign: full }, 200);
    }

    if (req.method === "POST" && campaignId && action === "publish") {
      const { data: existing, error: fetchErr } = await admin
        .from("lead_magnet_campaigns")
        .select(CAMPAIGN_SELECT)
        .eq("id", campaignId)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (fetchErr) return metaContentJson({ error: fetchErr.message }, 500);
      if (!existing) return metaContentJson({ error: "Not found" }, 404);

      const errMsg = validateCampaignPayload(
        normalizeCampaignPayload(campaignPayloadFromRow(existing as Record<string, unknown>)),
        true,
        orgId,
        campaignId,
        supabaseUrl,
      );
      if (errMsg) return metaContentJson({ error: errMsg }, 400);

      const { error } = await admin
        .from("lead_magnet_campaigns")
        .update({ status: "active", published_at: new Date().toISOString() })
        .eq("id", campaignId);
      if (error) return metaContentJson({ error: error.message }, 500);

      const full = await fetchCampaignFull(admin, campaignId);
      return metaContentJson({ campaign: full }, 200);
    }

    if (req.method === "POST" && campaignId && action === "pause") {
      const { error } = await admin
        .from("lead_magnet_campaigns")
        .update({ status: "paused" })
        .eq("id", campaignId)
        .eq("organization_id", orgId);
      if (error) return metaContentJson({ error: error.message }, 500);
      return metaContentJson({ success: true }, 200);
    }

    if (req.method === "DELETE" && campaignId) {
      const { error } = await admin
        .from("lead_magnet_campaigns")
        .delete()
        .eq("id", campaignId)
        .eq("organization_id", orgId);
      if (error) return metaContentJson({ error: error.message }, 500);
      return metaContentJson({ success: true }, 200);
    }

    return metaContentJson({ error: "Not found" }, 404);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("lead-magnet-api error:", msg);
    return metaContentJson({ error: msg }, 500);
  }
});
