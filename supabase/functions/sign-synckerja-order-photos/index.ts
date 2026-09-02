import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const BUCKET = "catalog-product-photos";

function normalizePath(raw: unknown): string {
  return String(raw ?? "").trim().replace(/^\/+/, "");
}

/** Public outlet codes are lowercase a-z0-9 (see publicCode.ts). */
function normalizeCode(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "server_misconfigured" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let body: { code?: string; paths?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const code = normalizeCode(body.code);
  const paths = [...new Set((Array.isArray(body.paths) ? body.paths : []).map(normalizePath).filter(Boolean))];
  if (!code || paths.length === 0) {
    return new Response(JSON.stringify({ urls: {} }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: store, error: storeError } = await admin.rpc("get_public_synckerja_order_store", {
    p_code: code,
    p_table_name: null,
  });
  if (storeError || !store?.ok || !store.outlet_id) {
    return new Response(JSON.stringify({ error: "store_not_found" }), {
      status: 404,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { data: outlet, error: outletError } = await admin
    .from("pos_outlets")
    .select("organization_id")
    .eq("id", store.outlet_id)
    .maybeSingle();
  if (outletError || !outlet?.organization_id) {
    return new Response(JSON.stringify({ error: "outlet_not_found" }), {
      status: 404,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const orgPrefix = `${outlet.organization_id}/`;
  const safePaths = paths.filter((path) => path.startsWith(orgPrefix));
  if (safePaths.length === 0) {
    return new Response(JSON.stringify({ urls: {} }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrls(safePaths, 60 * 60);
  if (signError) {
    console.error("sign-synckerja-order-photos", signError);
    return new Response(JSON.stringify({ error: signError.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const urls: Record<string, string> = {};
  for (const row of signed ?? []) {
    if (row.path && row.signedUrl) urls[row.path] = row.signedUrl;
  }

  return new Response(JSON.stringify({ urls }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
