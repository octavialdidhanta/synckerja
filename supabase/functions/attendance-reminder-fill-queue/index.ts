/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const DEFAULT_SHIFT_TIMEZONE_OFFSET_MINUTES = 7 * 60; // Asia/Jakarta
const TZ_OFFSET_MINUTES: Record<string, number> = {
  "Asia/Jakarta": 7 * 60,
  "Asia/Makassar": 8 * 60,
  "Asia/Jayapura": 9 * 60,
};

type ResolvedScheduleRow = {
  source: string;
  shift_id: string | null;
  employee_shift_id: string | null;
  work_schedule_id: string | null;
  schedule_name: string;
  start_time: string;
  end_time: string;
  late_tolerance_minutes: number;
  overtime_threshold_minutes: number;
  timezone: string;
  working_days: number[] | null;
  is_working_day: boolean;
};

type ResolvedSchedule = {
  source: "shift" | "work_schedule";
  schedule_id: string;
  schedule_name: string;
  start_time: string;
  offsetMinutes: number;
};

type VisitDayModeRow = {
  mode?: string;
};

async function resolveVisitDayMode(
  supabase: ReturnType<typeof createClient>,
  employeeId: string,
  organizationId: string,
  effectiveDate: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("resolve_visit_day_mode", {
    p_employee_id: employeeId,
    p_organization_id: organizationId,
    p_date: effectiveDate,
  });

  if (error) {
    console.warn("resolve_visit_day_mode error", employeeId, effectiveDate, error.message);
    return "normal";
  }

  const row = (typeof data === "object" && data !== null ? data : {}) as VisitDayModeRow;
  return row.mode ?? "normal";
}

function getOffsetMinutes(timezone: string): number {
  return TZ_OFFSET_MINUTES[timezone] ?? DEFAULT_SHIFT_TIMEZONE_OFFSET_MINUTES;
}

function parseStartTime(startTime: string): { hour: number; minute: number } {
  const parts = startTime.trim().split(":");
  const hour = parseInt(parts[0] ?? "0", 10) || 0;
  const minute = parseInt(parts[1] ?? "0", 10) || 0;
  return { hour, minute };
}

async function resolveScheduleForEmployee(
  supabase: ReturnType<typeof createClient>,
  employeeId: string,
  organizationId: string,
  effectiveDate: string,
): Promise<ResolvedSchedule | null> {
  const { data, error } = await supabase.rpc("resolve_effective_schedule", {
    p_employee_id: employeeId,
    p_organization_id: organizationId,
    p_effective_date: effectiveDate,
  });

  if (error) {
    console.warn("resolve_effective_schedule error", employeeId, error.message);
    return null;
  }

  const row = (Array.isArray(data) ? data[0] : data) as ResolvedScheduleRow | null | undefined;
  if (!row?.start_time) return null;
  if (!row.is_working_day) return null;

  const scheduleId =
    row.source === "shift"
      ? row.shift_id ?? row.work_schedule_id
      : row.work_schedule_id;
  if (!scheduleId) return null;

  return {
    source: row.source === "shift" ? "shift" : "work_schedule",
    schedule_id: scheduleId,
    schedule_name: row.schedule_name ?? (row.source === "shift" ? "Shift" : "Jadwal Kerja"),
    start_time: row.start_time ?? "08:00",
    offsetMinutes: getOffsetMinutes(row.timezone ?? "Asia/Jakarta"),
  };
}

function localToUtcMs(
  dateStr: string,
  hour: number,
  minute: number,
  offsetMinutes: number
): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utcMs = Date.UTC(y, m - 1, d, hour, minute, 0);
  return utcMs - offsetMinutes * 60 * 1000;
}

Deno.serve(async (req: Request) => {
  console.log("attendance-reminder-fill-queue: request", req.method, req.url);

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing or invalid Authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!serviceRoleKey || auth.slice(7) !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const formatDate = (d: Date) =>
    d.getUTCFullYear() +
    "-" +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getUTCDate()).padStart(2, "0");
  const dates: string[] = [formatDate(today), formatDate(tomorrow)];

  const { data: orgRows } = await supabase
    .from("work_schedule_settings")
    .select("organization_id")
    .eq("is_active", true);
  const orgIdsFromWss = new Set((orgRows ?? []).map((r: { organization_id: string }) => r.organization_id));

  const { data: shiftOrgRows } = await supabase.from("shifts").select("organization_id").eq("is_active", true);
  const orgIdsFromShifts = new Set((shiftOrgRows ?? []).map((r: { organization_id: string }) => r.organization_id));
  const allOrgIds = [...new Set([...orgIdsFromWss, ...orgIdsFromShifts])];

  let totalInserted = 0;
  const errors: string[] = [];

  for (const organizationId of allOrgIds) {
    for (const effectiveDate of dates) {
      const { data: employees } = await supabase
        .from("employees")
        .select("id, user_id, work_schedule_id")
        .eq("organization_id", organizationId)
        .not("user_id", "is", null);

      if (!employees?.length) continue;

      const holidayCheck = await supabase
        .from("national_holidays")
        .select("id")
        .eq("date", effectiveDate)
        .eq("is_active", true)
        .or(`organization_id.is.null,organization_id.eq.${organizationId}`);
      const isHoliday = (holidayCheck.data ?? []).length > 0;
      if (isHoliday) continue;

      const { data: alreadyCheckedInRows } = await supabase
        .from("attendance_records")
        .select("employee_id")
        .eq("organization_id", organizationId)
        .eq("attendance_date", effectiveDate)
        .not("check_in_time", "is", null);
      const alreadyCheckedInIds = new Set(
        (alreadyCheckedInRows ?? []).map((r: { employee_id: string }) => r.employee_id)
      );

      for (const emp of employees as { id: string; user_id: string; work_schedule_id: string | null }[]) {
        if (alreadyCheckedInIds.has(emp.id)) continue;

        const schedule = await resolveScheduleForEmployee(
          supabase,
          emp.id,
          organizationId,
          effectiveDate,
        );

        if (!schedule) continue;

        const visitDayMode = await resolveVisitDayMode(
          supabase,
          emp.id,
          organizationId,
          effectiveDate,
        );
        if (visitDayMode === "field_first" || visitDayMode === "travel_field") {
          continue;
        }

        const { hour, minute } = parseStartTime(schedule.start_time);
        const offsetMin = schedule.offsetMinutes;
        const startUtcMs = localToUtcMs(effectiveDate, hour, minute, offsetMin);

        const slots: { reminder_type: "before_30m" | "before_15m" | "after_15m" | "after_30m"; scheduled_at: string }[] = [
          { reminder_type: "before_30m", scheduled_at: new Date(startUtcMs - 30 * 60 * 1000).toISOString() },
          { reminder_type: "before_15m", scheduled_at: new Date(startUtcMs - 15 * 60 * 1000).toISOString() },
          { reminder_type: "after_15m", scheduled_at: new Date(startUtcMs + 15 * 60 * 1000).toISOString() },
          { reminder_type: "after_30m", scheduled_at: new Date(startUtcMs + 30 * 60 * 1000).toISOString() },
        ];

        for (const slot of slots) {
          const row = {
            organization_id: organizationId,
            user_id: emp.user_id,
            employee_id: emp.id,
            source: schedule.source,
            schedule_id: schedule.schedule_id,
            schedule_name: schedule.schedule_name,
            start_time: schedule.start_time,
            reminder_type: slot.reminder_type,
            effective_date: effectiveDate,
            scheduled_at: slot.scheduled_at,
          };
          const { error } = await supabase.from("attendance_reminder_queue").upsert(row, {
            onConflict: "user_id,effective_date,reminder_type",
            ignoreDuplicates: true,
          });
          if (error) errors.push(`${emp.id}/${effectiveDate}/${slot.reminder_type}: ${error.message}`);
          else totalInserted++;
        }
      }
    }
  }

  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const { data: deletedRows, error: deleteError } = await supabase
    .from("attendance_reminder_queue")
    .delete()
    .not("sent_at", "is", null)
    .lt("sent_at", twoDaysAgo)
    .select("id");
  const deletedCount = deleteError ? 0 : (deletedRows?.length ?? 0);
  if (deleteError) console.warn("attendance-reminder-fill-queue: cleanup delete error", deleteError.message);

  console.log("attendance-reminder-fill-queue: done", { orgs: allOrgIds.length, inserted: totalInserted, deleted: deletedCount, errors: errors.length });
  return new Response(
    JSON.stringify({
      ok: true,
      orgs: allOrgIds.length,
      inserted: totalInserted,
      deleted: deletedCount,
      errors: errors.slice(0, 10),
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
