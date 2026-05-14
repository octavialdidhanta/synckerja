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

/** Error shape dari supabase-js / PostgREST */
type PgLikeErr = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Response error terstruktur supaya Network / log jelas langkah yang gagal */
function fail(step: string, err: PgLikeErr | null | undefined, status = 500) {
  const message = err?.message ?? "unknown error";
  const extra: Record<string, unknown> = {
    ok: false,
    step,
    message,
    code: err?.code ?? null,
    details: err?.details ?? null,
    hint: err?.hint ?? null,
  };
  if (message.toLowerCase().includes("duplicate key")) {
    extra.hint_sql =
      "Cek constraint di analytics_daily_utm (duplikat pkey/pkey1) atau perbaiki refresh_analytics_daily_rollups dengan ON CONFLICT.";
  }
  console.error(`traffic-refresh-rollups [${step}]`, JSON.stringify(extra));
  return json(status, extra);
}

function normalizeWebId(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

function isValidDateStr(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isMissingPostgresRoutine(err: PgLikeErr | null): boolean {
  if (!err?.message) return false;
  const m = err.message.toLowerCase();
  const c = String(err.code ?? "");
  if (c === "P0001") return false;
  if (c === "42883") return true;
  if (m.includes("could not find") && m.includes("function")) return true;
  if (m.includes("does not exist") && m.includes("function")) return true;
  return false;
}

type WibBounds = { day_min?: string; day_max?: string };

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (req.method !== "POST") return json(405, { ok: false, step: "method", message: "Method not allowed" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json(500, { ok: false, step: "env", message: "Missing Supabase env" });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
    if (!token) return json(401, { ok: false, step: "auth", message: "Missing auth token" });

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return json(401, { ok: false, step: "auth.getUser", message: userErr?.message ?? "Invalid auth token" });
    }
    const userId = userRes.user.id;

    let parsed: Body = {};
    try {
      parsed = (await req.json()) as Body;
    } catch {
      return json(400, { ok: false, step: "body", message: "Invalid JSON" });
    }

    const webId = normalizeWebId(parsed.web_id);
    const fromRaw = parsed.from;
    const toRaw = parsed.to;
    const from =
      fromRaw === null || fromRaw === undefined ? null : String(fromRaw).trim() === "" ? null : String(fromRaw).trim();
    const to = toRaw === null || toRaw === undefined ? null : String(toRaw).trim() === "" ? null : String(toRaw).trim();

    if (!webId) return json(400, { ok: false, step: "validate", message: "web_id is required" });

    if (from !== null || to !== null) {
      if (!from || !to) {
        return json(400, { ok: false, step: "validate", message: "from/to are required unless both are omitted/null (Maximum)" });
      }
      if (!isValidDateStr(from) || !isValidDateStr(to)) {
        return json(400, { ok: false, step: "validate", message: "Invalid from/to format" });
      }
      if (to < from) return json(400, { ok: false, step: "validate", message: "Invalid range" });
    }

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("active_organization_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileErr) return fail("profiles", profileErr);
    const orgId = (profile as { active_organization_id?: string } | null)?.active_organization_id ?? null;
    if (!orgId) return json(403, { ok: false, step: "org", message: "No active organization" });

    const { data: roleRow, error: roleErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .limit(50);
    if (roleErr) return fail("user_roles", roleErr);

    const roles = (roleRow ?? []) as Array<{ role?: string }>;
    const role =
      roles.find((r) => r.role === "owner")?.role ??
      roles.find((r) => r.role === "admin")?.role ??
      null;
    let canRefresh = role === "owner" || role === "admin";
    if (!canRefresh) {
      const { data: orgGate, error: orgGateErr } = await admin
        .from("organizations")
        .select("id")
        .eq("id", orgId)
        .or(`user_id.eq.${userId},created_by.eq.${userId}`)
        .maybeSingle();
      if (orgGateErr) return fail("organizations", orgGateErr);
      canRefresh = Boolean(orgGate?.id);
    }
    if (!canRefresh) {
      return json(403, { ok: false, step: "permission", message: "Only owner/admin can refresh rollups" });
    }

    const { data: mapping, error: mapErr } = await admin
      .from("analytics_web_access")
      .select("web_id,is_approved")
      .eq("organization_id", orgId)
      .eq("web_id", webId)
      .maybeSingle();
    if (mapErr) return fail("analytics_web_access", mapErr);
    if (!mapping?.web_id) {
      return json(403, { ok: false, step: "analytics_web_access", message: "web_id is not connected for this org" });
    }
    if (mapping.is_approved !== true) {
      return json(403, { ok: false, step: "analytics_web_access", message: "web_id is waiting for approval" });
    }

    const canonicalWebId = String(mapping.web_id).trim();

    let rf: string;
    let rt: string;
    const maximumMode = from === null && to === null;

    if (maximumMode) {
      const { data: boundsRaw, error: boundsErr } = await admin.rpc("get_traffic_raw_wib_bounds", {
        p_web_id: canonicalWebId,
      });
      if (boundsErr) return fail("get_traffic_raw_wib_bounds", boundsErr);
      const bounds = boundsRaw as WibBounds | null;
      const dmin = bounds?.day_min ? String(bounds.day_min).slice(0, 10) : "";
      const dmax = bounds?.day_max ? String(bounds.day_max).slice(0, 10) : "";
      if (!isValidDateStr(dmin) || !isValidDateStr(dmax)) {
        return json(400, {
          ok: false,
          step: "bounds",
          message: "No raw analytics events for this web_id; nothing to roll up.",
        });
      }
      rf = dmin;
      rt = dmax;
    } else {
      rf = from as string;
      rt = to as string;
    }

    const { error: fullRefreshErr } = await admin.rpc("refresh_analytics_rollups", {
      p_web_id: canonicalWebId,
      p_from: rf,
      p_to: rt,
    });
    if (fullRefreshErr && !isMissingPostgresRoutine(fullRefreshErr)) {
      return fail("refresh_analytics_rollups", fullRefreshErr);
    }

    const { error: clearRpcErr } = await admin.rpc("clear_analytics_rollups_slice_for_traffic_sync", {
      p_web_id: canonicalWebId,
      p_from: rf,
      p_to: rt,
    });
    if (clearRpcErr) {
      if (!isMissingPostgresRoutine(clearRpcErr)) {
        return fail("clear_analytics_rollups_slice_for_traffic_sync", clearRpcErr);
      }
      const { error: clearUtmErr } = await admin
        .from("analytics_daily_utm")
        .delete()
        .eq("web_id", canonicalWebId)
        .gte("day", rf)
        .lte("day", rt);
      if (clearUtmErr) return fail("rest_delete_analytics_daily_utm", clearUtmErr);
      const { error: clearSbErr } = await admin
        .from("analytics_daily_source_breakdown")
        .delete()
        .eq("web_id", canonicalWebId)
        .gte("day", rf)
        .lte("day", rt);
      if (clearSbErr) return fail("rest_delete_analytics_daily_source_breakdown", clearSbErr);
    }

    const { error: dailyRollupsErr } = await admin.rpc("refresh_analytics_daily_rollups", {
      p_from: rf,
      p_to: rt,
      p_web_id: canonicalWebId,
    });
    if (dailyRollupsErr) return fail("refresh_analytics_daily_rollups", dailyRollupsErr);

    return json(200, {
      ok: true,
      success: true,
      web_id: canonicalWebId,
      from: rf,
      to: rt,
      mode: maximumMode ? "maximum" : "explicit",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("traffic-refresh-rollups unhandled:", e);
    return json(500, { ok: false, step: "unhandled", message: msg });
  }
});
