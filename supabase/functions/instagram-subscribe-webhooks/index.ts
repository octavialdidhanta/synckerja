/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getInstagramPageSubscriptionStatus,
  subscribeInstagramPageToWebhooks,
  type InstagramPageSubscribeResult,
} from "../_shared/metaInstagramPageSubscribe.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: { ...corsHeaders, "Content-Length": "2" } });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseWithUser = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await supabaseWithUser.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_organization_id")
      .eq("user_id", user.id)
      .single();

    const orgId = profile?.active_organization_id ?? null;
    if (!orgId) {
      return new Response(JSON.stringify({ error: "No active organization." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({})) as {
      account_id?: string;
      facebook_page_row_id?: string;
      channel?: string;
    };
    const accountIdFilter = typeof body.account_id === "string" ? body.account_id.trim() : "";
    const fbPageRowIdFilter = typeof body.facebook_page_row_id === "string"
      ? body.facebook_page_row_id.trim()
      : "";
    const channelFilter = typeof body.channel === "string" ? body.channel.trim().toLowerCase() : "";

    type PageTarget = {
      pageId: string;
      pageToken: string;
      label: string;
      igId?: string | null;
    };
    const pageTargets = new Map<string, PageTarget>();

    if (channelFilter !== "facebook") {
      let query = supabaseAdmin
        .from("organization_instagram_accounts")
        .select("id, facebook_page_id, page_access_token, instagram_business_account_id, instagram_username")
        .eq("organization_id", orgId)
        .eq("is_active", true);

      if (accountIdFilter) {
        query = query.eq("id", accountIdFilter);
      }

      const { data: accounts, error: accountsError } = await query;
      if (accountsError) {
        return new Response(JSON.stringify({ error: accountsError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      for (const acc of accounts ?? []) {
        const pageId = (acc.facebook_page_id ?? "").trim();
        const pageToken = (acc.page_access_token ?? "").trim();
        if (!pageId || !pageToken) continue;
        pageTargets.set(pageId, {
          pageId,
          pageToken,
          label: (acc.instagram_username as string | null) ? `@${acc.instagram_username}` : pageId,
          igId: acc.instagram_business_account_id as string,
        });
      }
    }

    if (channelFilter !== "instagram") {
      let fbQuery = supabaseAdmin
        .from("organization_facebook_pages")
        .select("id, facebook_page_id, page_name, page_access_token")
        .eq("organization_id", orgId)
        .eq("is_active", true);

      if (fbPageRowIdFilter) {
        fbQuery = fbQuery.eq("id", fbPageRowIdFilter);
      }

      const { data: fbPages, error: fbPagesError } = await fbQuery;
      if (fbPagesError) {
        return new Response(JSON.stringify({ error: fbPagesError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      for (const page of fbPages ?? []) {
        const pageId = (page.facebook_page_id ?? "").trim();
        const pageToken = (page.page_access_token ?? "").trim();
        if (!pageId || !pageToken) continue;
        if (!pageTargets.has(pageId)) {
          pageTargets.set(pageId, {
            pageId,
            pageToken,
            label: (page.page_name as string | null)?.trim() || pageId,
          });
        }
      }
    }

    if (pageTargets.size === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No connected Facebook Pages found.",
          subscribed_count: 0,
          results: [],
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: Array<
      InstagramPageSubscribeResult & {
        page_label?: string;
        instagram_username?: string | null;
        before_subscribed_fields?: string[];
      }
    > = [];

    for (const target of pageTargets.values()) {
      const { pageId, pageToken, label, igId } = target;

      const before = await getInstagramPageSubscriptionStatus(pageId, pageToken);

      const subscribeResult = await subscribeInstagramPageToWebhooks(pageId, pageToken);

      const after = subscribeResult.success
        ? await getInstagramPageSubscriptionStatus(pageId, pageToken)
        : before;

      results.push({
        ...subscribeResult,
        instagramBusinessAccountId: igId ?? null,
        page_label: label,
        instagram_username: label.startsWith("@") ? label.slice(1) : null,
        before_subscribed_fields: before.subscribedFields,
        subscribedFields: after.subscribedFields,
      });
    }

    const subscribedCount = results.filter((r) => r.success).length;
    const allOk = subscribedCount === results.length;

    return new Response(
      JSON.stringify({
        success: allOk,
        subscribed_count: subscribedCount,
        total: results.length,
        results,
        hint: allOk
          ? "Page webhook subscription enabled."
          : "Some pages failed. Reconnect Facebook and try again, or contact Synckerja support.",
      }),
      {
        status: allOk ? 200 : 207,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("instagram-subscribe-webhooks error", err);
    return new Response(JSON.stringify({ error: "Internal error." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
