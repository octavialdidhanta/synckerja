/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  metaContentCorsHeaders,
  metaContentJson,
  requireActiveOrg,
} from "../_shared/metaContentAuth.ts";
import {
  extractHashtagsFromText,
  extractMentionHandlesFromText,
  normalizeHashtagToken,
  suggestHashtagsFromPlan,
} from "../_shared/captionSuggest/hashtagTokens.ts";
import {
  getOrgPrimaryIgAccountForDiscovery,
  resolveIgBusinessDiscovery,
} from "../_shared/metaContent/resolveIgBusinessDiscovery.ts";

type MentionSource = "curated" | "history" | "meta";

type MentionItem = {
  handle: string;
  displayName: string | null;
  source: MentionSource;
  profilePictureUrl?: string | null;
};

type Body = {
  action?: string;
  organization_id?: string;
  q?: string;
  handle?: string;
  title?: string;
  pillar?: string;
  save?: boolean;
};

function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

function looksLikeExactUsername(q: string): boolean {
  return /^[a-z0-9._]{3,30}$/.test(q);
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { status: 200, headers: metaContentCorsHeaders });
    }
    if (req.method !== "POST") {
      return metaContentJson({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return metaContentJson({ error: "Server misconfigured" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
    if ("error" in userRes) return userRes.error;

    const body = (await req.json().catch(() => ({}))) as Body;
    const organizationId = String(body.organization_id ?? "").trim();
    const action = String(body.action ?? "").trim();
    if (!organizationId) return metaContentJson({ error: "Missing organization_id" }, 400);
    if (!action) return metaContentJson({ error: "Missing action" }, 400);

    const orgForbidden = await requireActiveOrg(admin, userRes.userId, organizationId);
    if (orgForbidden) return orgForbidden;

    if (action === "mentions") {
      const q = normalizeHandle(String(body.q ?? ""));
      const items: MentionItem[] = [];
      const seen = new Set<string>();

      const push = (item: MentionItem) => {
        const key = item.handle.toLowerCase();
        if (!key || seen.has(key)) return;
        if (q && !key.includes(q)) return;
        seen.add(key);
        items.push(item);
      };

      const { data: curated } = await admin
        .from("organization_caption_mention_handles")
        .select("handle, display_name")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .limit(80);

      for (const row of curated ?? []) {
        const r = row as { handle?: string; display_name?: string | null };
        push({
          handle: normalizeHandle(String(r.handle ?? "")),
          displayName: r.display_name ? String(r.display_name) : null,
          source: "curated",
        });
      }

      // History: @handles from recent brief captions in this org.
      const { data: plans } = await admin
        .from("social_media_plans")
        .select("id")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(40);
      const planIds = (plans ?? []).map((p) => String((p as { id: string }).id));
      if (planIds.length > 0) {
        const { data: captions } = await admin
          .from("brief_captions")
          .select("content")
          .in("social_media_plan_id", planIds)
          .limit(40);
        for (const row of captions ?? []) {
          const content = String((row as { content?: string | null }).content ?? "");
          for (const h of extractMentionHandlesFromText(content)) {
            push({ handle: h, displayName: null, source: "history" });
          }
        }
      }

      // Exact-like query → Meta business_discovery enrich.
      if (looksLikeExactUsername(q) && items.filter((i) => i.source === "curated").length < 3) {
        const ig = await getOrgPrimaryIgAccountForDiscovery(admin, organizationId);
        if (ig) {
          const profile = await resolveIgBusinessDiscovery({
            igBusinessAccountId: ig.igBusinessAccountId,
            pageAccessToken: ig.pageAccessToken,
            username: q,
          });
          if (profile) {
            const key = profile.username.toLowerCase();
            for (let i = items.length - 1; i >= 0; i -= 1) {
              if (items[i].handle.toLowerCase() === key) items.splice(i, 1);
            }
            seen.delete(key);
            items.unshift({
              handle: profile.username,
              displayName: profile.name,
              source: "meta",
              profilePictureUrl: profile.profilePictureUrl,
            });
            seen.add(key);
          }
        }
      }

      return metaContentJson({ mentions: items.slice(0, 12) }, 200);
    }

    if (action === "resolve_mention") {
      const handle = normalizeHandle(String(body.handle ?? body.q ?? ""));
      if (!handle) return metaContentJson({ error: "Missing handle" }, 400);

      const { data: curatedRow } = await admin
        .from("organization_caption_mention_handles")
        .select("handle, display_name")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .ilike("handle", handle)
        .maybeSingle();

      let result: MentionItem | null = curatedRow
        ? {
          handle: normalizeHandle(String((curatedRow as { handle: string }).handle)),
          displayName: (curatedRow as { display_name?: string | null }).display_name
            ? String((curatedRow as { display_name: string }).display_name)
            : null,
          source: "curated",
        }
        : null;

      const ig = await getOrgPrimaryIgAccountForDiscovery(admin, organizationId);
      if (ig) {
        const profile = await resolveIgBusinessDiscovery({
          igBusinessAccountId: ig.igBusinessAccountId,
          pageAccessToken: ig.pageAccessToken,
          username: handle,
        });
        if (profile) {
          result = {
            handle: profile.username,
            displayName: profile.name,
            source: "meta",
            profilePictureUrl: profile.profilePictureUrl,
          };
        }
      }

      if (result && body.save === true) {
        const { data: existing } = await admin
          .from("organization_caption_mention_handles")
          .select("id")
          .eq("organization_id", organizationId)
          .ilike("handle", result.handle)
          .maybeSingle();
        if (!existing) {
          await admin.from("organization_caption_mention_handles").insert({
            organization_id: organizationId,
            handle: result.handle.toLowerCase(),
            display_name: result.displayName,
            platform: "instagram",
            is_active: true,
            created_by: userRes.userId,
          });
        } else {
          await admin
            .from("organization_caption_mention_handles")
            .update({
              display_name: result.displayName,
              is_active: true,
              updated_at: new Date().toISOString(),
            })
            .eq("id", (existing as { id: string }).id);
        }
      }

      return metaContentJson({ mention: result }, 200);
    }

    if (action === "hashtags") {
      const q = normalizeHashtagToken(String(body.q ?? "")).toLowerCase();
      const title = String(body.title ?? "");
      const pillar = String(body.pillar ?? "");
      const tags: Array<{ tag: string; source: "curated" | "history" | "plan" }> = [];
      const seen = new Set<string>();

      const push = (raw: string, source: "curated" | "history" | "plan") => {
        const token = normalizeHashtagToken(raw);
        if (!token) return;
        const key = token.toLowerCase();
        if (seen.has(key)) return;
        if (q && !key.includes(q)) return;
        seen.add(key);
        tags.push({ tag: `#${token}`, source });
      };

      const { data: curated } = await admin
        .from("organization_caption_hashtags")
        .select("tag")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .limit(80);
      for (const row of curated ?? []) {
        push(String((row as { tag?: string }).tag ?? ""), "curated");
      }

      const { data: plans } = await admin
        .from("social_media_plans")
        .select("id")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(40);
      const planIds = (plans ?? []).map((p) => String((p as { id: string }).id));
      if (planIds.length > 0) {
        const { data: captions } = await admin
          .from("brief_captions")
          .select("content")
          .in("social_media_plan_id", planIds)
          .limit(40);
        for (const row of captions ?? []) {
          const content = String((row as { content?: string | null }).content ?? "");
          for (const h of extractHashtagsFromText(content)) push(h, "history");
        }
      }

      for (const tag of suggestHashtagsFromPlan({
        title,
        contentPillarName: pillar,
        limit: 8,
      })) {
        push(tag, "plan");
      }

      return metaContentJson({ hashtags: tags.slice(0, 12) }, 200);
    }

    return metaContentJson({ error: "Unknown action" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("share-caption-suggest:", msg);
    return metaContentJson({ error: msg }, 500);
  }
});
