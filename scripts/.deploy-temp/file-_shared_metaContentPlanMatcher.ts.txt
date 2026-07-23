import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { MetaContentPlatform } from "./metaContentAuth.ts";

export type PlanMatchInfo = {
  plan_id: string | null;
  service_name: string | null;
  content_pillar: string | null;
  pic_name: string | null;
  actual_post_date: string | null;
  match_type: "share_url" | "media_id" | null;
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

export type MetaContentPostMatchInput = {
  id: string;
  permalink: string | null;
};

export function parseInstagramMediaIdFromUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const patterns = [
    /instagram\.com\/(?:p|reel|tv)\/([^/?#]+)/i,
    /\/(?:p|reel|tv)\/([^/?#]+)/i,
  ];
  for (const re of patterns) {
    const m = re.exec(trimmed);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function parseFacebookPostIdFromUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    const storyFbid = u.searchParams.get("story_fbid")?.trim();
    if (storyFbid) return storyFbid;
    const fbid = u.searchParams.get("fbid")?.trim();
    if (fbid) return fbid;
  } catch {
    // fall through to regex
  }
  const patterns = [
    /facebook\.com\/[^/]+\/posts\/(\d+)/i,
    /facebook\.com\/photo\.php\?.*fbid=(\d+)/i,
    /\/posts\/(\d+)/i,
  ];
  for (const re of patterns) {
    const m = re.exec(trimmed);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function parseMetaMediaIdFromUrl(platform: MetaContentPlatform, url: string): string | null {
  return platform === "instagram"
    ? parseInstagramMediaIdFromUrl(url)
    : parseFacebookPostIdFromUrl(url);
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

export async function loadMetaPlanLinks(
  admin: SupabaseClient,
  organizationId: string,
  platform: MetaContentPlatform,
): Promise<LinkRow[]> {
  const { data: links } = await admin
    .from("social_media_links")
    .select("id, url, external_post_id, social_media_plan_id, platform")
    .ilike("platform", platform);

  const rows = (links ?? []).filter((l) => {
    const p = String((l as { platform?: string }).platform ?? "").toLowerCase();
    return p.includes(platform);
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

export function buildPlanMatchIndex(
  links: LinkRow[],
  platform: MetaContentPlatform,
): {
  byMediaId: Map<string, LinkRow>;
  byShareUrl: Map<string, LinkRow>;
} {
  const byMediaId = new Map<string, LinkRow>();
  const byShareUrl = new Map<string, LinkRow>();
  for (const link of links) {
    const mediaId = link.external_post_id?.trim() || parseMetaMediaIdFromUrl(platform, link.url);
    if (mediaId) byMediaId.set(mediaId, link);
    byShareUrl.set(normalizeUrl(link.url), link);
  }
  return { byMediaId, byShareUrl };
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

export function matchPostToPlan(
  post: MetaContentPostMatchInput,
  index: { byMediaId: Map<string, LinkRow>; byShareUrl: Map<string, LinkRow> },
  planMap: Map<string, PlanRow>,
): PlanMatchInfo {
  const mediaId = String(post.id ?? "").trim();
  const shareUrl = post.permalink ? normalizeUrl(post.permalink) : "";

  let link: LinkRow | undefined;
  let matchType: PlanMatchInfo["match_type"] = null;

  if (shareUrl && index.byShareUrl.has(shareUrl)) {
    link = index.byShareUrl.get(shareUrl);
    matchType = "share_url";
  } else if (mediaId && index.byMediaId.has(mediaId)) {
    link = index.byMediaId.get(mediaId);
    matchType = "media_id";
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

export async function backfillLinkMediaIds(
  admin: SupabaseClient,
  accountId: string,
  matches: Array<{ link_id: string; media_id: string }>,
): Promise<void> {
  const now = new Date().toISOString();
  for (const m of matches) {
    await admin
      .from("social_media_links")
      .update({
        external_post_id: m.media_id,
        platform_account_open_id: accountId,
        last_insights_sync_at: now,
      })
      .eq("id", m.link_id);
  }
}
