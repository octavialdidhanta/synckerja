import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const META_GRAPH_VERSION = "v21.0";

interface InstagramBusinessAccount {
  id: string;
  username: string | null;
  name: string | null;
  /** Facebook Page ID linked to this Instagram account; required for Send API (avoids "me" with User token). */
  page_id: string | null;
  /** Page access token for this Page; required for Instagram Messaging API and webhook. */
  access_token: string | null;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight first so browser gets 2xx + CORS headers
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
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

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("active_organization_id")
      .eq("user_id", user.id)
      .single();

    let orgId = profile?.active_organization_id ?? null;

    const { data: userOrgs } = await supabase
      .from("user_organizations")
      .select("organization_id")
      .eq("user_id", user.id);
    const orgIds = (userOrgs ?? []).map((r: { organization_id: string }) => r.organization_id);

    const tryOrg = async (oid: string) => {
      const { data, error } = await supabase
        .from("organization_meta_config")
        .select("meta_access_token, meta_business_manager_id")
        .eq("organization_id", oid)
        .maybeSingle();
      if (!error && data?.meta_access_token?.trim()) {
        return {
          token: data.meta_access_token.trim(),
          businessId: typeof data.meta_business_manager_id === "string" && data.meta_business_manager_id.trim()
            ? data.meta_business_manager_id.trim()
            : null,
          orgId: oid,
        };
      }
      return null;
    };

    let accessToken: string | null = null;
    let businessId: string | null = null;
    let resolvedOrgId: string | null = null;

    if (orgId) {
      const current = await tryOrg(orgId);
      if (current) {
        accessToken = current.token;
        businessId = current.businessId;
        resolvedOrgId = current.orgId;
      }
    }
    if (!accessToken && orgIds.length > 0) {
      for (const oid of orgIds) {
        if (oid === orgId) continue;
        const current = await tryOrg(oid);
        if (current) {
          accessToken = current.token;
          businessId = current.businessId;
          resolvedOrgId = current.orgId;
          break;
        }
      }
    }

    if (!accessToken || !resolvedOrgId) {
      return new Response(
        JSON.stringify({ error: "No active organization or Meta token not configured. Connect Account Connect (WhatsApp) first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fields = "id,name,access_token,instagram_business_account{id,username,name}";
    const accounts: InstagramBusinessAccount[] = [];
    const seenIgIds = new Set<string>();

    function collectFromPages(pages: Array<{ id?: string; access_token?: string; instagram_business_account?: { id?: string; username?: string; name?: string } }>) {
      for (const page of pages) {
        const ig = page?.instagram_business_account;
        const pageId = page?.id ? String(page.id) : null;
        const pageAccessToken = typeof page?.access_token === "string" ? page.access_token.trim() || null : null;
        if (ig?.id) {
          const igId = String(ig.id);
          if (seenIgIds.has(igId)) continue;
          seenIgIds.add(igId);
          accounts.push({
            id: igId,
            username: typeof ig.username === "string" ? ig.username : null,
            name: typeof ig.name === "string" ? ig.name : null,
            page_id: pageId,
            access_token: pageAccessToken,
          });
        }
      }
    }

    // 1) Try me/accounts (User token – returns Pages the user manages)
    const meUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?fields=${encodeURIComponent(fields)}`;
    const metaRes = await fetch(meUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const metaData = await metaRes.json().catch(() => ({})) as {
      data?: Array<{
        id?: string;
        name?: string;
        access_token?: string;
        instagram_business_account?: { id?: string; username?: string; name?: string };
      }>;
      error?: { message?: string };
    };

    if (metaRes.ok && Array.isArray(metaData?.data)) {
      collectFromPages(metaData.data);
    } else if (metaData?.error?.message && !metaRes.ok) {
      // Only fail on first attempt if we have no fallback
      if (!businessId) {
        const msg = metaData.error.message ?? "Meta API error";
        return new Response(JSON.stringify({ error: msg }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 2) If no accounts from me/accounts, try Business Manager owned_pages (when meta_business_manager_id is set)
    if (accounts.length === 0 && businessId) {
      const bizUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(businessId)}/owned_pages?fields=${encodeURIComponent(fields)}`;
      const bizRes = await fetch(bizUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const bizData = await bizRes.json().catch(() => ({})) as {
        data?: Array<{
          id?: string;
          name?: string;
          access_token?: string;
          instagram_business_account?: { id?: string; username?: string; name?: string };
        }>;
        error?: { message?: string };
      };
      if (bizRes.ok && Array.isArray(bizData?.data)) {
        collectFromPages(bizData.data);
      }
    }

    // 3) If still no accounts, try me/businesses (User token with business_management – Pages owned by businesses the user has a role in)
    if (accounts.length === 0) {
      const businessesUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/me/businesses?fields=${encodeURIComponent("owned_pages{" + fields + "}")}`;
      const bizListRes = await fetch(businessesUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const bizListData = await bizListRes.json().catch(() => ({})) as {
        data?: Array<{
          id?: string;
          owned_pages?: {
            data?: Array<{
              id?: string;
              name?: string;
              instagram_business_account?: { id?: string; username?: string; name?: string };
            }>;
          };
        }>;
        error?: { message?: string };
      };
      if (bizListRes.ok && Array.isArray(bizListData?.data)) {
        for (const biz of bizListData.data) {
          const pages = biz?.owned_pages?.data;
          if (Array.isArray(pages)) collectFromPages(pages);
        }
      }
    }

    return new Response(
      JSON.stringify({ accounts }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("list-instagram-accounts error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to list Instagram accounts" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
