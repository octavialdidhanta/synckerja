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

type CreateUserPayload = {
  email?: string;
  name?: string;
  organizationId?: string;
  role?: string;
};

const ALLOWED_ROLES = ["employee", "hr", "admin", "owner"] as const;

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ success: false, error: "Server not configured" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace(/Bearer\s+/i, "");
    const {
      data: { user: caller },
      error: callerErr,
    } = await supabaseAdmin.auth.getUser(token);

    if (callerErr || !caller) {
      return json({ success: false, error: "Invalid session" }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as CreateUserPayload;
    const email = (body.email ?? "").trim().toLowerCase();
    const name = (body.name ?? "").trim();
    const organizationId = (body.organizationId ?? "").trim();
    const roleRaw = (body.role ?? "employee").trim().toLowerCase();
    const role = (ALLOWED_ROLES as readonly string[]).includes(roleRaw) ? roleRaw : "employee";

    if (!email || !email.includes("@")) {
      return json({ success: false, error: "Invalid email" }, 400);
    }
    if (!name) {
      return json({ success: false, error: "Name is required" }, 400);
    }
    if (!organizationId) {
      return json({ success: false, error: "organizationId is required" }, 400);
    }

    // Permission guard: only privileged roles can create users in an org.
    const { data: callerRoleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    const callerRole = (callerRoleRow?.role ?? "").toString().trim().toLowerCase();
    if (!["owner", "admin", "hr"].includes(callerRole)) {
      return json({ success: false, error: "Insufficient permissions" }, 403);
    }

    // Lookup existing user by profile email (app convention)
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("email", email)
      .maybeSingle();

    let userId = existingProfile?.user_id ? String(existingProfile.user_id) : null;
    let isNewUser = false;

    if (!userId) {
      // Create Auth user (admin)
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: name },
      });
      if (createErr || !created?.user?.id) {
        return json({ success: false, error: createErr?.message ?? "Failed to create user" }, 400);
      }
      userId = created.user.id;
      isNewUser = true;
    }

    // Ensure profile exists
    await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          user_id: userId,
          email,
          full_name: name,
          active_organization_id: organizationId,
        },
        { onConflict: "user_id" }
      );

    // Ensure membership exists
    const { data: userOrgRow } = await supabaseAdmin
      .from("user_organizations")
      .upsert(
        {
          user_id: userId,
          organization_id: organizationId,
        },
        { onConflict: "user_id,organization_id" }
      )
      .select("id")
      .maybeSingle();

    // Ensure role row exists for this org
    await supabaseAdmin
      .from("user_roles")
      .upsert(
        {
          user_id: userId,
          organization_id: organizationId,
          role,
        },
        { onConflict: "user_id,organization_id" }
      );

    // Optional: generate a magiclink for the new user (best-effort; ignore errors)
    let magicLink: string | null = null;
    try {
      const redirectTo = Deno.env.get("SITE_URL") ?? undefined;
      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: redirectTo ? { redirectTo } : undefined,
      } as any);
      magicLink = (linkData as any)?.properties?.action_link ?? null;
    } catch (_e) {
      magicLink = null;
    }

    return json({
      success: true,
      userId,
      isNewUser,
      userOrganization: userOrgRow ?? null,
      magicLink,
    });
  } catch (e: any) {
    console.error("create-user error:", e);
    return json({ success: false, error: e?.message ?? "Unexpected error" }, 500);
  }
});

