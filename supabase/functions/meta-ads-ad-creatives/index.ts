/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const CREATIVE_FIELDS = [
  "thumbnail_url",
  "image_url",
  "video_id",
  "title",
  "body",
  "object_story_spec",
  "asset_feed_spec",
].join(",");

type CreativePayload = {
  ad_id: string;
  thumbnail_url: string | null;
  image_url: string | null;
  video_url: string | null;
  preview_url: string | null;
  headline: string | null;
  description: string | null;
  images: string[];
  media_type: "image" | "video" | "carousel" | "unknown";
};

function json(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function decodeKey(raw: string): Uint8Array {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("META_ADS_CONFIG_ENCRYPTION_KEY is not set");
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) bytes[i] = parseInt(trimmed.slice(i * 2, i * 2 + 2), 16);
    return bytes;
  }
  const bin = atob(trimmed);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (bytes.length !== 32) throw new Error("META_ADS_CONFIG_ENCRYPTION_KEY must be 32 bytes");
  return bytes;
}

async function decryptToken(ciphertextB64: string): Promise<string> {
  const keyBytes = decodeKey(Deno.env.get("META_ADS_CONFIG_ENCRYPTION_KEY") ?? "");
  const bin = atob(ciphertextB64.trim());
  const combined = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) combined[i] = bin.charCodeAt(i);
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
  const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, data);
  return new TextDecoder().decode(dec);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s || null;
}

function digitsOnly(value: string): string {
  let out = "";
  for (const ch of value) {
    if (ch >= "0" && ch <= "9") out += ch;
  }
  return out;
}

function isDigits(value: string): boolean {
  return value.length > 0 && digitsOnly(value) === value;
}

async function graphGet(
  graphVersion: string,
  path: string,
  accessToken: string,
): Promise<Record<string, unknown>> {
  const url = `https://graph.facebook.com/${graphVersion}/${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body as Record<string, unknown>;
}

function collectVideoId(creative: Record<string, unknown>): string | null {
  const direct = text(creative.video_id);
  if (direct) return direct;
  const story = asRecord(creative.object_story_spec);
  const videoData = asRecord(story?.video_data);
  const fromVideo = text(videoData?.video_id);
  if (fromVideo) return fromVideo;
  const link = asRecord(story?.link_data);
  const fromLink = text(link?.video_id);
  if (fromLink) return fromLink;
  const children = Array.isArray(link?.child_attachments) ? link.child_attachments : [];
  for (const child of children) {
    const id = text(asRecord(child)?.video_id);
    if (id) return id;
  }
  const feed = asRecord(creative.asset_feed_spec);
  const videos = Array.isArray(feed?.videos) ? feed.videos : [];
  for (const item of videos) {
    const id = text(asRecord(item)?.video_id);
    if (id) return id;
  }
  return null;
}

function collectImages(creative: Record<string, unknown>): string[] {
  const images: string[] = [];
  const push = (value: unknown) => {
    const url = text(value);
    if (url && !images.includes(url)) images.push(url);
  };
  push(creative.image_url);
  const story = asRecord(creative.object_story_spec);
  push(asRecord(story?.video_data)?.image_url);
  const link = asRecord(story?.link_data);
  push(link?.picture);
  push(asRecord(story?.photo_data)?.url);
  const children = Array.isArray(link?.child_attachments) ? link.child_attachments : [];
  for (const child of children) {
    const row = asRecord(child);
    push(row?.picture);
    push(row?.image_url);
  }
  const feed = asRecord(creative.asset_feed_spec);
  const feedVideos = Array.isArray(feed?.videos) ? feed.videos : [];
  for (const item of feedVideos) push(asRecord(item)?.thumbnail_url);
  return images;
}

function firstFeedText(feed: Record<string, unknown> | null, key: string): string | null {
  const list = Array.isArray(feed?.[key]) ? feed[key] : [];
  for (const item of list) {
    const value = text(asRecord(item)?.text);
    if (value) return value;
  }
  return null;
}

function collectCopy(creative: Record<string, unknown>): { headline: string | null; description: string | null } {
  const story = asRecord(creative.object_story_spec);
  const video = asRecord(story?.video_data);
  const link = asRecord(story?.link_data);
  const template = asRecord(story?.template_data);
  const feed = asRecord(creative.asset_feed_spec);
  const child = asRecord(Array.isArray(link?.child_attachments) ? link.child_attachments[0] : null);
  const headline = text(creative.title)
    ?? text(video?.title)
    ?? text(link?.name)
    ?? text(template?.name)
    ?? text(child?.name)
    ?? firstFeedText(feed, "titles");
  const primary = text(creative.body)
    ?? text(video?.message)
    ?? text(link?.message)
    ?? text(template?.message)
    ?? firstFeedText(feed, "bodies");
  const extra = text(video?.link_description)
    ?? text(link?.description)
    ?? text(template?.description)
    ?? text(child?.description)
    ?? firstFeedText(feed, "descriptions");
  let description = primary;
  if (extra && extra !== primary && extra !== headline) {
    description = description ? `${description}\n\n${extra}` : extra;
  }
  if (description === headline) description = extra && extra !== headline ? extra : null;
  return { headline, description };
}

function emptyCreative(adId: string): CreativePayload {
  return {
    ad_id: adId,
    thumbnail_url: null,
    image_url: null,
    video_url: null,
    preview_url: null,
    headline: null,
    description: null,
    images: [],
    media_type: "unknown",
  };
}

function playableUrl(value: unknown): string | null {
  const url = text(value);
  if (!url || !url.toLowerCase().startsWith("https://")) return null;
  if (url.toLowerCase().includes("access_token=")) return null;
  return url;
}

function pickVideoUrl(video: Record<string, unknown> | null): string | null {
  if (!video) return null;
  const source = playableUrl(video.source);
  if (source) return source;
  const formats = Array.isArray(video.format) ? video.format : [];
  let best: { src: string; height: number } | null = null;
  for (const item of formats) {
    const row = asRecord(item);
    const src = playableUrl(row?.src);
    if (!src) continue;
    const height = Number(row?.height ?? 0);
    if (!best || height > best.height) best = { src, height: Number.isFinite(height) ? height : 0 };
  }
  return best?.src ?? null;
}

function iframeSrc(html: unknown): string | null {
  const body = text(html);
  if (!body) return null;
  const marker = "src=";
  const start = body.toLowerCase().indexOf(marker);
  if (start < 0) return null;
  const quote = body[start + marker.length];
  if (quote !== '"' && quote !== "'") return null;
  const end = body.indexOf(quote, start + marker.length + 1);
  if (end < 0) return null;
  return playableUrl(body.slice(start + marker.length + 1, end).split("&amp;").join("&"));
}

async function mapPool<T>(items: T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await task(items[index]);
    }
  });
  await Promise.all(workers);
}

async function readVideoNode(
  graphVersion: string,
  accessToken: string,
  path: string,
): Promise<Record<string, unknown> | null> {
  try {
    return await graphGet(graphVersion, path, accessToken);
  } catch (e) {
    console.warn("meta-ads-ad-creatives video:", e);
    return null;
  }
}

async function fetchVideoFiles(
  graphVersion: string,
  accessToken: string,
  adAccountId: string,
  videoIds: string[],
): Promise<{ sourceByVideo: Map<string, string>; pictureByVideo: Map<string, string> }> {
  const sourceByVideo = new Map<string, string>();
  const pictureByVideo = new Map<string, string>();
  const unique = [...new Set(videoIds)];
  const remember = (row: Record<string, unknown> | null, fallbackId?: string) => {
    if (!row || row.error) return;
    const id = text(row.id) ?? fallbackId ?? null;
    if (!id) return;
    const source = pickVideoUrl(row);
    const picture = playableUrl(row.picture) ?? playableUrl(asRecord(Array.isArray(row.format) ? row.format[0] : null)?.picture);
    if (source) sourceByVideo.set(id, source);
    if (picture) pictureByVideo.set(id, picture);
  };

  const missing = () => unique.filter((id) => !sourceByVideo.has(id));

  for (let i = 0; i < unique.length; i += 25) {
    const slice = unique.slice(i, i + 25);
    const filtering = encodeURIComponent(JSON.stringify([{ field: "id", operator: "IN", value: slice }]));
    const listed = await readVideoNode(
      graphVersion,
      accessToken,
      `act_${adAccountId}/advideos?fields=id,source,picture,format&limit=25&filtering=${filtering}`,
    );
    const rows = Array.isArray(listed?.data) ? listed.data : [];
    for (const item of rows) remember(asRecord(item));
  }

  await mapPool(missing(), 8, async (id) => {
    const fromAccount = await readVideoNode(
      graphVersion,
      accessToken,
      `act_${adAccountId}/advideos/${id}?fields=id,source,picture,format`,
    );
    remember(fromAccount, id);
    if (sourceByVideo.has(id)) return;
    const direct = await readVideoNode(
      graphVersion,
      accessToken,
      `${id}?fields=id,source,picture,format`,
    );
    remember(direct, id);
  });

  return { sourceByVideo, pictureByVideo };
}

const BACKSLASH = String.fromCharCode(92);

function unescapeMetaUrl(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === BACKSLASH && value[i + 1] === "/") {
      out += "/";
      i += 1;
      continue;
    }
    if (ch === BACKSLASH && value[i + 1] === "u" && value.slice(i + 2, i + 6) === "0026") {
      out += "&";
      i += 5;
      continue;
    }
    out += ch;
  }
  return out.split("&amp;").join("&");
}

function readUrlAfterKey(html: string, key: string): string | null {
  let from = 0;
  while (from < html.length) {
    const at = html.indexOf(key, from);
    if (at < 0) return null;
    const https = html.indexOf("https://", at);
    if (https < 0 || https - at > 80) {
      from = at + key.length;
      continue;
    }
    let end = https + "https://".length;
    while (end < html.length) {
      const ch = html[end];
      if (ch === '"' || ch === "'" || ch === " " || ch === "<" || ch === "," || ch === BACKSLASH) break;
      end += 1;
    }
    const url = playableUrl(html.slice(https, end));
    if (url) return url;
    from = at + key.length;
  }
  return null;
}

function findMp4(html: string): string | null {
  const decoded = unescapeMetaUrl(html);
  const marker = ".mp4";
  let from = 0;
  let best: string | null = null;
  while (from < decoded.length) {
    const at = decoded.indexOf(marker, from);
    if (at < 0) break;
    const https = decoded.lastIndexOf("https://", at);
    if (https >= 0 && at - https < 2500) {
      let end = at + marker.length;
      while (end < decoded.length) {
        const ch = decoded[end];
        if (ch === '"' || ch === "'" || ch === " " || ch === "<" || ch === BACKSLASH) break;
        end += 1;
      }
      const url = playableUrl(decoded.slice(https, end));
      if (url && (!best || url.length > best.length)) best = url;
    }
    from = at + marker.length;
  }
  return best;
}

async function extractPlayableFile(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      redirect: "follow",
      headers: {
        Accept: "text/html",
        "User-Agent": "Mozilla/5.0",
      },
    });
    if (!res.ok) return null;
    const html = unescapeMetaUrl(await res.text());
    for (const key of [
      "browser_native_hd_url",
      "playable_url_quality_hd",
      "hd_src",
      "browser_native_sd_url",
      "playable_url",
      "sd_src",
    ]) {
      const url = readUrlAfterKey(html, key);
      if (url) return url;
    }
    return findMp4(html);
  } catch (e) {
    console.warn("meta-ads-ad-creatives preview file:", e);
    return null;
  }
}

async function instagramVideoUrl(
  graphVersion: string,
  accessToken: string,
  adId: string,
): Promise<string | null> {
  const ad = await readVideoNode(
    graphVersion,
    accessToken,
    `${adId}?fields=${encodeURIComponent("creative{effective_instagram_media_id}")}`,
  );
  const igId = text(asRecord(asRecord(ad)?.creative)?.effective_instagram_media_id);
  if (!igId) return null;
  const media = await readVideoNode(
    graphVersion,
    accessToken,
    `${igId}?fields=media_url,media_type`,
  );
  if (text(media?.media_type)?.toUpperCase() === "IMAGE") return null;
  return playableUrl(media?.media_url);
}

async function fetchPreviewUrls(
  graphVersion: string,
  accessToken: string,
  adIds: string[],
): Promise<Map<string, string>> {
  const previews = new Map<string, string>();
  await mapPool(adIds, 8, async (id) => {
    const body = await readVideoNode(
      graphVersion,
      accessToken,
      `${id}/previews?ad_format=DESKTOP_FEED_STANDARD`,
    );
    const first = asRecord(Array.isArray(body?.data) ? body.data[0] : null);
    const src = iframeSrc(first?.body);
    if (src) previews.set(id, src);
  });
  return previews;
}

async function fetchCreatives(
  graphVersion: string,
  accessToken: string,
  adAccountId: string,
  adIds: string[],
  resolvePlayback: boolean,
): Promise<CreativePayload[]> {
  const byId = new Map<string, CreativePayload>();
  const videoIdByAd = new Map<string, string>();
  for (const id of adIds) byId.set(id, emptyCreative(id));

  for (let i = 0; i < adIds.length; i += 40) {
    const slice = adIds.slice(i, i + 40);
    const path = `?ids=${encodeURIComponent(slice.join(","))}&fields=${encodeURIComponent(`creative{${CREATIVE_FIELDS}}`)}`;
    const body = await graphGet(graphVersion, path, accessToken);
    for (const id of slice) {
      const ad = asRecord(body[id]);
      const creative = asRecord(ad?.creative);
      if (!creative) continue;
      const images = collectImages(creative);
      const videoId = collectVideoId(creative);
      const copy = collectCopy(creative);
      const thumbnail = text(creative.thumbnail_url) ?? images[0] ?? null;
      const attachments = asRecord(asRecord(creative.object_story_spec)?.link_data)?.child_attachments;
      const childCount = Array.isArray(attachments) ? attachments.length : 0;
      if (videoId) videoIdByAd.set(id, videoId);
      byId.set(id, {
        ad_id: id,
        thumbnail_url: thumbnail,
        image_url: images[0] ?? thumbnail,
        video_url: null,
        preview_url: null,
        headline: copy.headline,
        description: copy.description,
        images,
        media_type: videoId ? "video" : childCount > 1 ? "carousel" : images.length > 0 ? "image" : "unknown",
      });
    }
  }

  const { sourceByVideo, pictureByVideo } = await fetchVideoFiles(
    graphVersion,
    accessToken,
    adAccountId,
    [...videoIdByAd.values()],
  );
  const fileByAd = new Map<string, string>();
  if (resolvePlayback) {
    const pending = adIds.filter((id) => {
      const videoId = videoIdByAd.get(id);
      return Boolean(videoId) && !sourceByVideo.has(videoId ?? "");
    });
    await mapPool(pending, 3, async (id) => {
      const fromInstagram = await instagramVideoUrl(graphVersion, accessToken, id);
      if (fromInstagram) {
        fileByAd.set(id, fromInstagram);
        return;
      }
      const previews = await fetchPreviewUrls(graphVersion, accessToken, [id]);
      const page = previews.get(id);
      if (!page) return;
      const file = await extractPlayableFile(page);
      if (file) fileByAd.set(id, file);
    });
  }

  return adIds.map((id) => {
    const row = byId.get(id) ?? emptyCreative(id);
    const videoId = videoIdByAd.get(id) ?? null;
    const videoUrl = (videoId ? sourceByVideo.get(videoId) ?? null : null) ?? fileByAd.get(id) ?? null;
    const picture = videoId ? pictureByVideo.get(videoId) ?? null : null;
    return {
      ...row,
      thumbnail_url: row.thumbnail_url ?? picture ?? row.image_url,
      image_url: row.image_url ?? picture ?? row.thumbnail_url,
      video_url: videoUrl,
      preview_url: null,
      media_type: videoId || videoUrl ? "video" : row.media_type,
    };
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Server misconfigured" }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) return json({ error: "Unauthorized" }, 401);
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user?.id) return json({ error: "Invalid token" }, 401);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const organizationId = String(body.organization_id ?? "").trim();
  if (!organizationId) return json({ error: "Missing organization_id" }, 400);

  const { data: profile } = await admin
    .from("profiles")
    .select("active_organization_id")
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  const activeOrg = profile?.active_organization_id != null ? String(profile.active_organization_id) : "";
  if (!activeOrg || activeOrg !== organizationId) return json({ error: "Forbidden" }, 403);

  const requestedAccount = digitsOnly(String(body.ad_account_id ?? ""));
  if (!requestedAccount) return json({ error: "ad_account_id required" }, 400);

  const adIds = [...new Set(
    (Array.isArray(body.ad_ids) ? body.ad_ids : [])
      .map((id) => String(id ?? "").trim())
      .filter((id) => isDigits(id)),
  )].slice(0, 100);
  if (adIds.length === 0) return json({ creatives: [] }, 200);

  const { data: account } = await admin
    .from("organization_meta_ads_accounts")
    .select("ad_account_id")
    .eq("organization_id", organizationId)
    .eq("ad_account_id", requestedAccount)
    .eq("is_active", true)
    .maybeSingle();
  if (!account?.ad_account_id) return json({ error: "Meta Ads not connected or no account configured" }, 400);

  const { data: tokenRow } = await admin
    .from("organization_meta_ads_connection_tokens")
    .select("access_token_enc")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!tokenRow?.access_token_enc) return json({ error: "Meta Ads not connected or no account configured" }, 400);

  const { data: connection } = await admin
    .from("organization_meta_ads_connections")
    .select("oauth_connected_at")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!connection?.oauth_connected_at) return json({ error: "Meta Ads not connected or no account configured" }, 400);

  let accessToken: string;
  try {
    accessToken = await decryptToken(String(tokenRow.access_token_enc));
  } catch (e) {
    console.error("meta-ads-ad-creatives decrypt:", e);
    return json({ error: "Meta Ads not connected or no account configured" }, 400);
  }

  const graphVersion = Deno.env.get("META_GRAPH_API_VERSION")?.trim() || "v22.0";
  try {
    const creatives = await fetchCreatives(
      graphVersion,
      accessToken,
      requestedAccount,
      adIds,
      body.resolve_playback === true,
    );
    return json({ creatives }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load ad creatives";
    return json({ error: msg }, 400);
  }
});
