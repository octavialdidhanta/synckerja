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

type ResolvedSchedule =
  | {
      source: "shift";
      schedule_id: string;
      schedule_name: string;
      start_time: string;
      offsetMinutes: number;
    }
  | {
      source: "work_schedule";
      schedule_id: string;
      schedule_name: string;
      start_time: string;
      offsetMinutes: number;
      working_days: number[];
    };

type WorkScheduleRow = {
  id: string;
  name: string | null;
  start_time: string | null;
  timezone: string | null;
  working_days: number[] | null;
};

function getOffsetMinutes(timezone: string): number {
  return TZ_OFFSET_MINUTES[timezone] ?? DEFAULT_SHIFT_TIMEZONE_OFFSET_MINUTES;
}

function parseStartTime(startTime: string): { hour: number; minute: number } {
  const parts = startTime.trim().split(":");
  const hour = parseInt(parts[0] ?? "0", 10) || 0;
  const minute = parseInt(parts[1] ?? "0", 10) || 0;
  return { hour, minute };
}

function getDayOfWeekForDate(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00Z");
  const jsDow = d.getUTCDay();
  return jsDow === 0 ? 7 : jsDow;
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
        let schedule: ResolvedSchedule | null = null;

        const { data: shiftAssign } = await supabase
          .from("employee_shifts")
          .select("shift_id, shifts(id, name, start_time, is_active)")
          .eq("employee_id", emp.id)
          .eq("organization_id", organizationId)
          .lte("effective_from_date", effectiveDate)
          .or(`effective_to_date.is.null,effective_to_date.gte.${effectiveDate}`)
          .eq("is_active", true)
          .order("effective_from_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        const shiftData = shiftAssign as unknown as {
          shift_id: string;
          shifts: { id: string; name: string; start_time: string; is_active: boolean } | { id: string; name: string; start_time: string; is_active: boolean }[] | null;
        } | null;
        const s = shiftData?.shifts == null ? null : Array.isArray(shiftData.shifts) ? shiftData.shifts[0] : shiftData.shifts;
        if (s?.id && s?.is_active !== false) {
          schedule = {
            source: "shift",
            schedule_id: s.id,
            schedule_name: s.name ?? "Shift",
            start_time: s.start_time ?? "08:00",
            offsetMinutes: DEFAULT_SHIFT_TIMEZONE_OFFSET_MINUTES,
          };
        }

        if (!schedule) {
          let wss: WorkScheduleRow | null = null;
          if (emp.work_schedule_id) {
            const { data: empSchedule } = await supabase
              .from("work_schedule_settings")
              .select("id, name, start_time, timezone, working_days")
              .eq("id", emp.work_schedule_id)
              .eq("is_active", true)
              .maybeSingle();
            wss = empSchedule as WorkScheduleRow | null;
          }
          if (!wss) {
            const { data: defaultSchedule } = await supabase
              .from("work_schedule_settings")
              .select("id, name, start_time, timezone, working_days")
              .eq("organization_id", organizationId)
              .eq("is_active", true)
              .order("is_default", { ascending: false })
              .limit(1)
              .maybeSingle();
            wss = defaultSchedule as WorkScheduleRow | null;
          }
          if (wss) {
            const dow = getDayOfWeekForDate(effectiveDate);
            if (!wss.working_days?.includes(dow)) continue;
            schedule = {
              source: "work_schedule",
              schedule_id: wss.id,
              schedule_name: wss.name ?? "Jadwal Kerja",
              start_time: wss.start_time ?? "08:00",
              offsetMinutes: getOffsetMinutes(wss.timezone ?? "Asia/Jakarta"),
              working_days: wss.working_days ?? [],
            };
          }
        }

        if (!schedule) continue;

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
