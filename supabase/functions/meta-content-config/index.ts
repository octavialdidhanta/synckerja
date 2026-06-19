/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  listMetaContentAccounts,
  metaContentCorsHeaders,
  metaContentJson,
  requireActiveOrg,
} from "../_shared/metaContentAuth.ts";
import {
  META_SCOPE_FEATURE_MAP,
  missingScopesForFeature,
} from "../_shared/metaPlatformScopes.ts";

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { status: 200, headers: metaContentCorsHeaders });
    }
    if (req.method !== "GET" && req.method !== "POST") {
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

    let organizationId = "";
    if (req.method === "GET") {
      const url = new URL(req.url);
      organizationId = url.searchParams.get("organization_id")?.trim() ?? "";
    } else {
      const body = await req.json().catch(() => ({})) as { organization_id?: string };
      organizationId = String(body.organization_id ?? "").trim();
    }
    if (!organizationId) return metaContentJson({ error: "Missing organization_id" }, 400);

    const orgForbidden = await requireActiveOrg(admin, userRes.userId, organizationId);
    if (orgForbidden) return orgForbidden;

    const accounts = await listMetaContentAccounts(admin, organizationId);
    const enriched = accounts.map((acc) => {
      const features = Object.keys(META_SCOPE_FEATURE_MAP) as Array<keyof typeof META_SCOPE_FEATURE_MAP>;
      const featureStatus = Object.fromEntries(
        features.map((f) => [f, {
          ok: missingScopesForFeature(acc.granted_scopes, f).length === 0,
          missing: missingScopesForFeature(acc.granted_scopes, f),
        }]),
      );
      return { ...acc, feature_status: featureStatus };
    });

    return metaContentJson({ accounts: enriched }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("meta-content-config:", msg);
    return metaContentJson({ error: msg }, 500);
  }
});
