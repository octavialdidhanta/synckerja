import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { TikTokVideoRow } from "./tiktokContentApi.ts";

export type PlanMatchInfo = {
  plan_id: string | null;
  service_name: string | null;
  content_pillar: string | null;
  pic_name: string | null;
  actual_post_date: string | null;
  match_type: "share_url" | "video_id" | null;
  link_id: string | null;
};

type LinkRow = {
  id: string;
  url: string;
  external_post_id: string | null;
  social_media_plan_id: string;
};

type PlanRow = {
  id: string;
  actual_post_date: string | null;
  pic_id: string | null;
  service_id: string | null;
  content_pillar_id: string | null;
  services?: { name?: string } | { name?: string }[] | null;
  content_pillars?: { name?: string } | { name?: string }[] | null;
  employees?: { full_name?: string } | { full_name?: string }[] | null;
};

export function parseTikTokVideoIdFromUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const patterns = [
    /\/video\/(\d+)/i,
    /tiktok\.com\/@[^/]+\/video\/(\d+)/i,
    /vm\.tiktok\.com\/(\w+)/i,
  ];
  for (const re of patterns) {
    const m = re.exec(trimmed);
    if (m?.[1] && /^\d+$/.test(m[1])) return m[1];
  }
  return null;
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    u.search = "";
    u.hash = "";
    return u.toString().replace(/\/+$/, "");
  } catch {
    return url.trim().replace(/\/+$/, "");
  }
}

function pickName(rel: { name?: string } | { name?: string }[] | null | undefined): string | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0]?.name ? String(rel[0].name) : null;
  return rel.name ? String(rel.name) : null;
}

function pickEmployeeName(
  rel: { full_name?: string } | { full_name?: string }[] | null | undefined,
): string | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0]?.full_name ? String(rel[0].full_name) : null;
  return rel.full_name ? String(rel.full_name) : null;
}

export async function loadTikTokPlanLinks(
  admin: SupabaseClient,
  organizationId: string,
): Promise<LinkRow[]> {
  const { data: links } = await admin
    .from("social_media_links")
    .select("id, url, external_post_id, social_media_plan_id, platform")
    .ilike("platform", "tiktok");

  const rows = (links ?? []).filter((l) => {
    const platform = String((l as { platform?: string }).platform ?? "").toLowerCase();
    return platform.includes("tiktok");
  }) as LinkRow[];

  if (rows.length === 0) return [];

  const planIds = [...new Set(rows.map((r) => r.social_media_plan_id))];
  const { data: plans } = await admin
    .from("social_media_plans")
    .select("id, organization_id")
    .eq("organization_id", organizationId)
    .in("id", planIds);

  const orgPlanSet = new Set((plans ?? []).map((p) => String((p as { id: string }).id)));
  return rows.filter((r) => orgPlanSet.has(r.social_media_plan_id));
}

export function buildPlanMatchIndex(links: LinkRow[]): {
  byVideoId: Map<string, LinkRow>;
  byShareUrl: Map<string, LinkRow>;
} {
  const byVideoId = new Map<string, LinkRow>();
  const byShareUrl = new Map<string, LinkRow>();
  for (const link of links) {
    const vid = link.external_post_id?.trim() || parseTikTokVideoIdFromUrl(link.url);
    if (vid) byVideoId.set(vid, link);
    byShareUrl.set(normalizeUrl(link.url), link);
  }
  return { byVideoId, byShareUrl };
}

export async function loadPlanDetails(
  admin: SupabaseClient,
  planIds: string[],
): Promise<Map<string, PlanRow>> {
  if (planIds.length === 0) return new Map();
  const { data } = await admin
    .from("social_media_plans")
    .select(`
      id,
      actual_post_date,
      pic_id,
      service_id,
      content_pillar_id,
      services ( name ),
      content_pillars ( name )
    `)
    .in("id", planIds);

  const picIds = [...new Set((data ?? []).map((r) => (r as PlanRow).pic_id).filter(Boolean))];
  const picNameById = new Map<string, string>();
  if (picIds.length > 0) {
    const { data: employees } = await admin
      .from("employees")
      .select("id, full_name")
      .in("id", picIds as string[]);
    for (const e of employees ?? []) {
      const id = String((e as { id: string }).id);
      const name = String((e as { full_name?: string }).full_name ?? "").trim();
      if (name) picNameById.set(id, name);
    }
  }

  const map = new Map<string, PlanRow>();
  for (const row of data ?? []) {
    const plan = row as PlanRow;
    const picId = plan.pic_id != null ? String(plan.pic_id) : "";
    if (picId && picNameById.has(picId)) {
      plan.employees = { full_name: picNameById.get(picId) };
    }
    map.set(String(plan.id), plan);
  }
  return map;
}

export function matchVideoToPlan(
  video: TikTokVideoRow,
  index: { byVideoId: Map<string, LinkRow>; byShareUrl: Map<string, LinkRow> },
  planMap: Map<string, PlanRow>,
): PlanMatchInfo {
  const videoId = String(video.id ?? "").trim();
  const shareUrl = video.share_url ? normalizeUrl(video.share_url) : "";

  let link: LinkRow | undefined;
  let matchType: PlanMatchInfo["match_type"] = null;

  if (shareUrl && index.byShareUrl.has(shareUrl)) {
    link = index.byShareUrl.get(shareUrl);
    matchType = "share_url";
  } else if (videoId && index.byVideoId.has(videoId)) {
    link = index.byVideoId.get(videoId);
    matchType = "video_id";
  }

  if (!link) {
    return {
      plan_id: null,
      service_name: null,
      content_pillar: null,
      pic_name: null,
      actual_post_date: null,
      match_type: null,
      link_id: null,
    };
  }

  const plan = planMap.get(link.social_media_plan_id);
  return {
    plan_id: link.social_media_plan_id,
    service_name: pickName(plan?.services ?? null),
    content_pillar: pickName(plan?.content_pillars ?? null),
    pic_name: pickEmployeeName(plan?.employees ?? null),
    actual_post_date: plan?.actual_post_date != null ? String(plan.actual_post_date) : null,
    match_type: matchType,
    link_id: link.id,
  };
}

export function computeEngagementRate(video: TikTokVideoRow): number | null {
  const views = Number(video.view_count ?? 0);
  if (!Number.isFinite(views) || views <= 0) return null;
  const likes = Number(video.like_count ?? 0) || 0;
  const comments = Number(video.comment_count ?? 0) || 0;
  const shares = Number(video.share_count ?? 0) || 0;
  return ((likes + comments + shares) / views) * 100;
}

export async function backfillLinkVideoIds(
  admin: SupabaseClient,
  organizationId: string,
  openId: string,
  matches: Array<{ link_id: string; video_id: string }>,
): Promise<void> {
  const now = new Date().toISOString();
  for (const m of matches) {
    await admin
      .from("social_media_links")
      .update({
        external_post_id: m.video_id,
        platform_account_open_id: openId,
        last_insights_sync_at: now,
      })
      .eq("id", m.link_id);
  }
}
