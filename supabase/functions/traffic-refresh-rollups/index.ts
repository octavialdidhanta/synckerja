import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Body = {
  web_id?: string;
  /** yyyy-mm-dd, or null/omitted for "Maximum" (derive bounds server-side) */
  from?: string | null;
  to?: string | null;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeWebId(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

function isValidDateStr(s: string): boolean {
  // minimal yyyy-mm-dd validation
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json(500, { error: "Missing Supabase env" });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
    if (!token) return json(401, { error: "Missing auth token" });

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes?.user) return json(401, { error: "Invalid auth token" });
    const userId = userRes.user.id;

    let parsed: Body = {};
    try {
      parsed = (await req.json()) as Body;
    } catch {
      return json(400, { error: "Invalid JSON" });
    }

    const webId = normalizeWebId(parsed.web_id);
    const fromRaw = parsed.from;
    const toRaw = parsed.to;
    const from =
      fromRaw === null || fromRaw === undefined ? null : String(fromRaw).trim() === "" ? null : String(fromRaw).trim();
    const to = toRaw === null || toRaw === undefined ? null : String(toRaw).trim() === "" ? null : String(toRaw).trim();

    if (!webId) return json(400, { error: "web_id is required" });

    // Explicit range: both must be valid yyyy-mm-dd
    if (from !== null || to !== null) {
      if (!from || !to) return json(400, { error: "from/to are required unless both are omitted/null (Maximum)" });
      if (!isValidDateStr(from) || !isValidDateStr(to)) return json(400, { error: "Invalid from/to format" });
      if (to < from) return json(400, { error: "Invalid range" });
    }

    // Resolve active org and role for the user.
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("active_organization_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileErr) return json(500, { error: profileErr.message });
    const orgId = (profile as { active_organization_id?: string } | null)?.active_organization_id ?? null;
    if (!orgId) return json(403, { error: "No active organization" });

    const { data: roleRow, error: roleErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .limit(50);
    if (roleErr) return json(500, { error: roleErr.message });

    const roles = (roleRow ?? []) as Array<{ role?: string }>;
    const role =
      roles.find((r) => r.role === "owner")?.role ??
      roles.find((r) => r.role === "admin")?.role ??
      null;
    if (role !== "owner" && role !== "admin") {
      return json(403, { error: "Only owner/admin can refresh rollups" });
    }

    // Verify access mapping exists for (orgId, webId)
    const { data: mapping, error: mapErr } = await admin
      .from("analytics_web_access")
      .select("web_id")
      .eq("organization_id", orgId)
      .eq("web_id", webId)
      .maybeSingle();
    if (mapErr) return json(500, { error: mapErr.message });
    if (!mapping?.web_id) return json(403, { error: "web_id is not connected for this org" });

    const { error: refreshErr } = await admin.rpc("refresh_analytics_rollups", {
      p_web_id: webId,
      p_from: from,
      p_to: to,
    });
    if (refreshErr) return json(500, { error: refreshErr.message });

    return json(200, {
      success: true,
      web_id: webId,
      from,
      to,
      mode: from === null && to === null ? "maximum" : "explicit",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("traffic-refresh-rollups unhandled:", e);
    return json(500, { error: msg });
  }
});

