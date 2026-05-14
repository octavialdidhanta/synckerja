// deno-lint-ignore-file no-explicit-any
/// <reference path="../deno-globals.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Payload = { token?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ valid: false, error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) return json({ valid: false, error: "Server not configured" }, 500);

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const body = (await req.json().catch(() => ({}))) as Payload;
    const token = (body.token ?? "").trim();
    if (!token) return json({ valid: false, error: "Token is required" }, 400);

    const { data: link, error: linkErr } = await supabaseAdmin
      .from("magic_links")
      .select("id,user_id,email,expires_at,used_at,status")
      .eq("token", token)
      .maybeSingle();

    if (linkErr) return json({ valid: false, error: linkErr.message ?? "Query failed" }, 500);
    if (!link) return json({ valid: false, error: "Token tidak ditemukan" }, 404);

    const expiresAt = new Date(link.expires_at as string).getTime();
    if (Number.isFinite(expiresAt) && Date.now() > expiresAt) {
      // Mark expired (best-effort)
      await supabaseAdmin
        .from("magic_links")
        .update({ status: "expired" })
        .eq("id", link.id);
      return json({ valid: false, error: "Token sudah kedaluwarsa" }, 400);
    }

    if (link.used_at || String(link.status ?? "").toLowerCase() === "completed") {
      return json({ valid: false, error: "Token sudah digunakan" }, 400);
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name,active_organization_id")
      .eq("user_id", link.user_id)
      .maybeSingle();

    // Mark clicked (best-effort)
    if (String(link.status ?? "").toLowerCase() === "pending") {
      await supabaseAdmin.from("magic_links").update({ status: "clicked" }).eq("id", link.id);
    }

    return json({
      valid: true,
      email: (link.email ?? "").toString(),
      fullName: (profile?.full_name ?? "").toString(),
      organizationId: profile?.active_organization_id ?? undefined,
    });
  } catch (e: any) {
    console.error("validate-magic-link error:", e);
    return json({ valid: false, error: e?.message ?? "Unexpected error" }, 500);
  }
});

