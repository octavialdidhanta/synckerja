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

type Payload = {
  token?: string;
  password?: string;
  email?: string;
  fullName?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) return json({ success: false, error: "Server not configured" }, 500);

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const body = (await req.json().catch(() => ({}))) as Payload;
    const token = (body.token ?? "").trim();
    const password = (body.password ?? "").toString();
    const email = (body.email ?? "").trim().toLowerCase();
    const fullName = (body.fullName ?? "").trim();

    // App-level errors should still return 200 so the client can read `data.error`
    // without having to parse FunctionsHttpError / context.
    if (!token) return json({ success: false, error: "Token is required" }, 200);
    if (!password || password.length < 6) return json({ success: false, error: "Password minimal 6 karakter" }, 200);

    const { data: link, error: linkErr } = await supabaseAdmin
      .from("magic_links")
      .select("id,user_id,email,expires_at,used_at,status")
      .eq("token", token)
      .maybeSingle();

    if (linkErr) return json({ success: false, error: linkErr.message ?? "Query failed" }, 200);
    if (!link) return json({ success: false, error: "Token tidak ditemukan" }, 200);

    const expiresAt = new Date(link.expires_at as string).getTime();
    if (Number.isFinite(expiresAt) && Date.now() > expiresAt) {
      await supabaseAdmin.from("magic_links").update({ status: "expired" }).eq("id", link.id);
      return json({ success: false, error: "Token sudah kedaluwarsa" }, 200);
    }

    if (link.used_at || String(link.status ?? "").toLowerCase() === "completed") {
      return json({ success: false, error: "Token sudah digunakan" }, 200);
    }

    // Extra safety: ensure email matches record when provided by client
    if (email && email !== String(link.email ?? "").toLowerCase()) {
      return json({ success: false, error: "Email tidak cocok dengan token" }, 200);
    }

    // Set password for the invited user
    const { error: updUserErr } = await supabaseAdmin.auth.admin.updateUserById(String(link.user_id), {
      password,
      user_metadata: fullName ? { full_name: fullName } : undefined,
    } as any);
    if (updUserErr) return json({ success: false, error: updUserErr.message ?? "Gagal mengatur password" }, 200);

    // Mark token used + completed
    const now = new Date().toISOString();
    const { error: updLinkErr } = await supabaseAdmin
      .from("magic_links")
      .update({
        used_at: now,
        status: "completed",
        email_verified: true,
      })
      .eq("id", link.id);
    if (updLinkErr) return json({ success: false, error: updLinkErr.message ?? "Gagal menyimpan status token" }, 200);

    // Best-effort: ensure profile has latest name/email
    await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          user_id: link.user_id,
          email: link.email,
          full_name: fullName || undefined,
        },
        { onConflict: "user_id" }
      );

    return json({ success: true });
  } catch (e: any) {
    console.error("complete-magic-link-setup error:", e);
    return json({ success: false, error: e?.message ?? "Unexpected error" }, 500);
  }
});

