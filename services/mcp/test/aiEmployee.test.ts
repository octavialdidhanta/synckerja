import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { McpAuthContext } from "../src/authz/context";
import { MCP_SERVER_INSTRUCTIONS } from "../src/mcp/instructions";
import { MCP_TOOLS } from "../src/mcp/registry";
import { aiEmployeeBriefUpdate, aiEmployeeChat, aiEmployeeCommand, aiEmployeeRoutineUpsert, aiEmployeeRoutinesList, aiEmployeeScheduleUpdate, aiEmployeeStatus, listAiEmployees } from "../src/db/aiEmployee";
import {
  assertOrgOwner,
  assertOrgOwnerOrAdmin,
  chatOutsideReply,
  greetingReply,
  isSimpleChatGreeting,
  judgeJobDesk,
  matchEmployeeName,
  modelAllowance,
  politeAddress,
  resolveReportPeriod,
  validateRoutineUpdate,
  validateScheduleUpdate,
} from "../src/tools/aiEmployee/rules";

const owner = { organizationId: "org-1", roles: ["Owner"] } as McpAuthContext;
const employee = { organizationId: "org-1", roles: ["employee"] } as McpAuthContext;

function recordingAdmin(tables: Record<string, Record<string, unknown>[]>) {
  const calls: { table: string; eqs: [string, unknown][] }[] = [];
  const admin = {
    from(table: string) {
      const eqs: [string, unknown][] = [];
      const builder = {
        select() { return builder; },
        eq(column: string, value: unknown) { eqs.push([column, value]); return builder; },
        in() { return builder; },
        gte() { return builder; },
        lt() { return builder; },
        order() { return builder; },
        limit() { return builder; },
        then(resolve: (value: { data: Record<string, unknown>[]; error: null }) => void) {
          calls.push({ table, eqs: [...eqs] });
          resolve({ data: tables[table] ?? [], error: null });
        },
      };
      return builder;
    },
  };
  return { admin: admin as unknown as SupabaseClient, calls };
}

describe("ai employee access", () => {
  it("allows owner and admin and rejects other roles", () => {
    expect(() => assertOrgOwnerOrAdmin(owner)).not.toThrow();
    expect(() => assertOrgOwnerOrAdmin({ organizationId: "org-1", roles: ["admin"] })).not.toThrow();
    expect(() => assertOrgOwnerOrAdmin(employee)).toThrow("forbidden");
  });

  it("matches one name without caring about letter case", () => {
    const rows = [{ full_name: "Naya" }, { full_name: "Bima" }];
    expect(matchEmployeeName(rows, " naya ").ok).toBe(true);
    const nickname = matchEmployeeName(rows, "Nay");
    expect(nickname.ok).toBe(true);
    if (nickname.ok) expect(nickname.employee.full_name).toBe("Naya");
    const missing = matchEmployeeName(rows, "Sari");
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.names).toEqual(["Naya", "Bima"]);
    const duplicated = matchEmployeeName([{ full_name: "Naya" }, { full_name: "naya" }], "Naya");
    expect(duplicated.ok).toBe(false);
    const ambiguous = matchEmployeeName([{ full_name: "Naya" }, { full_name: "Nayara" }], "Nay");
    expect(ambiguous.ok).toBe(false);
    expect(matchEmployeeName(rows, "N").ok).toBe(false);
  });

  it("rejects work outside the content job and keeps a content request", () => {
    const payroll = judgeJobDesk("Hitung payroll bulan ini");
    expect(payroll.ok).toBe(false);
    if (!payroll.ok) {
      expect(payroll.reason).toContain("payroll");
      expect(payroll.can_do.length).toBeGreaterThan(0);
      expect(payroll.suggestion.length).toBeGreaterThan(0);
    }
    expect(judgeJobDesk("Buatkan 1 content plan untuk Sate Sultan PIK, tema iklan makan malam").ok).toBe(true);
  });

  it("reads the Jakarta day and a month period", () => {
    expect(resolveReportPeriod("today", new Date("2026-11-02T02:00:00.000Z"))).toEqual({
      start: "2026-11-02",
      end: "2026-11-02",
    });
    expect(resolveReportPeriod("2026-11", new Date("2026-11-02T02:00:00.000Z"))?.end).toBe("2026-11-30");
    expect(resolveReportPeriod("bulan ini")).toBeNull();
    expect(modelAllowance("coaching", 3)).toEqual({ cap: 8, used: 3, remaining: 5 });
    expect(modelAllowance("on_track", 15).remaining).toBe(0);
  });
});

describe("ai employee queries", () => {
  it("lists only AI employees in the session organization", async () => {
    const { admin, calls } = recordingAdmin({
      employees: [{ id: "emp-1", full_name: "Naya" }],
      ai_employee_profiles: [{ employee_id: "emp-1", job_title: "Content Planner", performance_status: "on_track", is_active: true }],
    });
    const listed = await listAiEmployees(admin, owner);
    expect(listed).toEqual([{
      name: "Naya",
      job_title: "Content Planner",
      performance_status: "on_track",
      is_active: true,
    }]);
    expect(calls.every((call) => call.eqs.some(([column, value]) => column === "organization_id" && value === "org-1"))).toBe(true);
    expect(calls[0]?.eqs).toContainEqual(["is_ai", true]);
  });

  it("does not query when the caller is not owner or admin", async () => {
    const { admin, calls } = recordingAdmin({});
    await expect(listAiEmployees(admin, employee)).rejects.toThrow("forbidden");
    expect(calls).toHaveLength(0);
  });

  it("sends a dry run by default and does not call the model for payroll", async () => {
    const { admin } = recordingAdmin({
      employees: [{ id: "emp-1", full_name: "Naya" }],
    });
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, dry_run: true, draft: { title: "Sate" } }), { status: 200 }));
    const caller = {
      supabaseUrl: "https://db.example",
      supabaseServiceRoleKey: "service-key",
      scheduledPostsInternalSecret: "internal-secret",
    };
    const rejected = await aiEmployeeCommand(admin, caller, owner, {
      employeeName: "Naya",
      instruction: "Hitung payroll bulan ini",
      dryRun: null,
    }, fetchImpl);
    expect(rejected).toMatchObject({ ok: false, error: "outside_job_desk" });
    expect(fetchImpl).not.toHaveBeenCalled();

    const accepted = await aiEmployeeCommand(admin, caller, owner, {
      employeeName: "Naya",
      instruction: "Buatkan 1 content plan untuk Sate Sultan PIK",
      dryRun: null,
    }, fetchImpl);
    expect(accepted).toMatchObject({ ok: true, dry_run: true });
    const request = fetchImpl.mock.calls[0] as unknown as [string, { body: string; headers: Record<string, string> }];
    expect(request[0]).toBe("https://db.example/functions/v1/ai-employee-run");
    expect(JSON.parse(request[1].body)).toEqual({
      employee_id: "emp-1",
      instruction: "Buatkan 1 content plan untuk Sate Sultan PIK",
      dry_run: true,
    });
    expect(request[1].headers["x-synckerja-internal-secret"]).toBe("internal-secret");
    expect(request[1].body).not.toContain("internal-secret");
  });

  it("answers an out-of-desk chat without calling the model", async () => {
    const { admin } = recordingAdmin({
      employees: [{ id: "emp-1", full_name: "Naya" }],
    });
    const fetchImpl = vi.fn();
    const caller = {
      supabaseUrl: "https://db.example",
      supabaseServiceRoleKey: "service-key",
      scheduledPostsInternalSecret: "internal-secret",
    };
    const refused = await aiEmployeeChat(admin, caller, owner, {
      employeeName: "Nay",
      message: "kasih report hrd",
    }, fetchImpl);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(refused).toMatchObject({
      ok: true,
      name: "Naya",
      outside_job_desk: true,
      model_calls: 0,
    });
    if ("reply" in refused && typeof refused.reply === "string") {
      expect(refused.reply).toBe(chatOutsideReply(judgeJobDesk("kasih report hrd") as { reason: string; can_do: readonly string[] }));
      expect(refused.reply.toLowerCase()).toContain("hr");
    }

    const greeted = await aiEmployeeChat(admin, caller, owner, {
      employeeName: "Naya",
      message: "Hai, apa kabar?",
    }, fetchImpl.mockImplementation(async () => new Response(JSON.stringify({
      ok: true,
      mode: "chat",
      reply: "Hai, aku Naya. Lagi siap bantu konten.",
      model_calls: 1,
    }), { status: 200 })));
    expect(greeted).toMatchObject({
      ok: true,
      name: "Naya",
      reply: "Hai, aku Naya. Lagi siap bantu konten.",
      model_calls: 1,
    });
    const request = fetchImpl.mock.calls[0] as unknown as [string, { body: string }];
    expect(JSON.parse(request[1].body)).toMatchObject({
      employee_id: "emp-1",
      instruction: "Hai, apa kabar?",
      mode: "chat",
      dry_run: true,
      speaker: { role: "owner", is_reviewer: false },
    });
  });

  it("answers a one-word greeting without calling the model and names the owner", async () => {
    const { admin, calls } = recordingAdmin({
      employees: [{ id: "emp-1", full_name: "Naya" }],
      profiles: [{ full_name: "Octa Vialdi" }],
      ai_employee_profiles: [{ reviewer_employee_id: "boss-1" }],
    });
    const fetchImpl = vi.fn();
    const caller = {
      supabaseUrl: "https://db.example",
      supabaseServiceRoleKey: "service-key",
      scheduledPostsInternalSecret: "internal-secret",
    };
    const speaking = { ...owner, userId: "user-1", employeeId: "boss-1" } as McpAuthContext;
    const greeted = await aiEmployeeChat(admin, caller, speaking, {
      employeeName: "nay",
      message: "nay",
    }, fetchImpl);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(greeted).toEqual({
      ok: true,
      name: "Naya",
      reply: greetingReply("Naya", "Pak Aldi"),
      outside_job_desk: false,
      model_calls: 0,
    });
    expect(isSimpleChatGreeting("halo", "Naya")).toBe(true);
    expect(isSimpleChatGreeting("pagi", "Naya")).toBe(true);
    expect(isSimpleChatGreeting("gw bos lu", "Naya")).toBe(false);
    expect(politeAddress("Budi Santoso", "owner")).toBe("Pak Budi");
    expect(calls.some((call) => call.table === "profiles" && call.eqs.some(([column, value]) => column === "user_id" && value === "user-1"))).toBe(true);
    expect(calls.some((call) => call.table === "ai_employee_profiles" && call.eqs.some(([column, value]) => column === "organization_id" && value === "org-1"))).toBe(true);
  });
});

describe("ai employee tool list", () => {
  it("publishes the employee tools and the server routing instructions", () => {
    const names = MCP_TOOLS.map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining([
      "ai_employee.list",
      "ai_employee.status",
      "ai_employee.runs.list",
      "ai_employee.report",
      "ai_employee.queue.list",
      "ai_employee.command",
      "ai_employee.chat",
      "ai_employee.schedule.update",
      "ai_employee.routines.list",
      "ai_employee.routine.upsert",
      "ai_employee.brief.get",
      "ai_employee.brief.update",
    ]));
    expect(MCP_SERVER_INSTRUCTIONS).toContain("ai_employee.command");
    expect(MCP_SERVER_INSTRUCTIONS).toContain("ai_employee.schedule.update");
    expect(MCP_SERVER_INSTRUCTIONS).toContain("ai_employee.routine.upsert");
    expect(MCP_SERVER_INSTRUCTIONS).toContain("invalid_action");
    expect(MCP_SERVER_INSTRUCTIONS).toContain("outside_job_desk");
    expect(MCP_SERVER_INSTRUCTIONS).toContain("Naya:");
    const chat = MCP_TOOLS.find((tool) => tool.name === "ai_employee.chat");
    expect(chat?.description).toContain("Nay");
    expect(chat?.description).toContain("Does not create a content plan");
    const schedule = MCP_TOOLS.find((tool) => tool.name === "ai_employee.schedule.update");
    expect(schedule?.description).toContain("Owner only");
    expect(schedule?.description).toContain("next_run_at");
    expect(schedule?.mutates).toBe(true);
    const brief = MCP_TOOLS.find((tool) => tool.name === "ai_employee.brief.update");
    expect(brief?.description).toContain("Owner only");
    expect(brief?.mutates).toBe(true);
    expect(MCP_TOOLS.find((tool) => tool.name === "ai_employee.brief.get")?.mutates).toBeFalsy();
  });
});

function scheduleAdmin(schedules: Record<string, unknown>[]) {
  const updates: { eqs: [string, unknown][]; patch: Record<string, unknown> }[] = [];
  const admin = {
    from(table: string) {
      const eqs: [string, unknown][] = [];
      let patch: Record<string, unknown> | null = null;
      const builder = {
        select() { return builder; },
        eq(column: string, value: unknown) { eqs.push([column, value]); return builder; },
        in() { return builder; },
        order() { return builder; },
        limit() { return builder; },
        update(value: Record<string, unknown>) { patch = value; return builder; },
        maybeSingle() {
          updates.push({ eqs: [...eqs], patch: patch ?? {} });
          const current = schedules[0];
          return Promise.resolve({
            data: current ? { ...current, ...patch, next_run_at: "2026-11-09T01:00:00+00" } : null,
            error: null,
          });
        },
        then(resolve: (value: { data: Record<string, unknown>[]; error: null }) => void) {
          const data = table === "employees"
            ? [{ id: "emp-1", full_name: "Naya" }]
            : table === "ai_employee_schedules"
              ? schedules
              : [];
          resolve({ data, error: null });
        },
      };
      return builder;
    },
  };
  return { admin: admin as unknown as SupabaseClient, updates };
}

describe("ai employee schedule update", () => {
  const current = {
    id: "sch-1",
    sop_code: "SOP1",
    weekday: 5,
    start_local: "15:00:00",
    due_local: "17:00:00",
    is_active: true,
    next_run_at: "2026-11-06T08:00:00+00",
  };
  const change = {
    employeeName: "nay",
    sopCode: "SOP1",
    weekday: 1,
    startLocal: "08:00",
    dueLocal: "09:30",
    isActive: true,
  };

  it("rejects an admin and a due time that is not after the start", async () => {
    expect(() => assertOrgOwner({ organizationId: "org-1", roles: ["admin"] })).toThrow("forbidden");
    expect(validateScheduleUpdate({ weekday: 8, startLocal: "15:00", dueLocal: "17:00" })).toEqual({ ok: false, error: "invalid_weekday" });
    expect(validateScheduleUpdate({ weekday: 5, startLocal: "17:00", dueLocal: "15:00" })).toEqual({ ok: false, error: "due_not_after_start" });
    expect(validateScheduleUpdate({ weekday: 5, startLocal: "15:00", dueLocal: "15:00" })).toEqual({ ok: false, error: "due_not_after_start" });
    expect(validateScheduleUpdate({ weekday: 1, startLocal: "08:00", dueLocal: "09:30" }).ok).toBe(true);
    const { admin, updates } = scheduleAdmin([current]);
    await expect(aiEmployeeScheduleUpdate(admin, { ...owner, roles: ["admin"] } as McpAuthContext, change)).rejects.toThrow("forbidden");
    expect(updates).toHaveLength(0);
  });

  it("shows the previous schedule and the new one after an owner changes it", async () => {
    const { admin, updates } = scheduleAdmin([current]);
    const changed = await aiEmployeeScheduleUpdate(admin, owner, change);
    expect(changed).toMatchObject({
      ok: true,
      name: "Naya",
      previous: { weekday: 5, start_local: "15:00:00", due_local: "17:00:00", next_run_at: "2026-11-06T08:00:00+00" },
      schedule: { weekday: 1, start_local: "08:00", due_local: "09:30", is_active: true, next_run_at: "2026-11-09T01:00:00+00" },
    });
    expect(updates[0]?.patch).toEqual({ weekday: 1, start_local: "08:00", due_local: "09:30", is_active: true });
    expect(updates[0]?.eqs).toEqual(expect.arrayContaining([
      ["id", "sch-1"],
      ["organization_id", "org-1"],
      ["employee_id", "emp-1"],
    ]));
    const missing = await aiEmployeeScheduleUpdate(scheduleAdmin([]).admin, owner, change);
    expect(missing).toMatchObject({ ok: false, error: "schedule_not_found" });
    const ambiguous = await aiEmployeeScheduleUpdate(scheduleAdmin([current, { ...current, id: "sch-2" }]).admin, owner, change);
    expect(ambiguous).toMatchObject({ ok: false, error: "schedule_ambiguous" });
  });
});

describe("ai employee brief update", () => {
  const previous = { audience: "", voice: "" };
  const next = { audience: "keluarga", voice: "hangat", personas: [{ id: "persona-1", audience: "ibu muda" }] };
  const input = {
    serviceIds: ["11111111-1111-4111-8111-111111111111"],
    audience: "keluarga",
    personaIds: ["22222222-2222-4222-8222-222222222222"],
    voice: "hangat",
    requiredNotes: "sebut sate",
    forbiddenNotes: "jangan harga",
    pillarIds: [],
    productKnowledgeIds: ["33333333-3333-4333-8333-333333333333"],
    splitRule: "bergiliran",
  };

  function briefAdmin() {
    const calls: { fn: string; args: Record<string, unknown> }[] = [];
    const admin = {
      from(table: string) {
        const builder = {
          select() { return builder; },
          eq() { return builder; },
          order() { return builder; },
          in() { return builder; },
          gte() { return builder; },
          lt() { return builder; },
          limit() { return builder; },
          then(resolve: (value: { data: Record<string, unknown>[]; error: null }) => void) {
            resolve({
              data: table === "employees" ? [{ id: "emp-1", full_name: "Naya" }] : [],
              error: null,
            });
          },
        };
        return builder;
      },
      async rpc(fn: string, args: Record<string, unknown>) {
        calls.push({ fn, args });
        return { data: { ok: true, previous, brief: next }, error: null };
      },
    };
    return { admin: admin as unknown as SupabaseClient, calls };
  }

  it("rejects an admin before writing", async () => {
    const { admin, calls } = briefAdmin();
    await expect(aiEmployeeBriefUpdate(admin, { ...owner, userId: "user-1", roles: ["admin"] } as McpAuthContext, "nay", input)).rejects.toThrow("forbidden");
    expect(calls).toHaveLength(0);
  });

  it("shows the previous brief and the new one", async () => {
    const { admin, calls } = briefAdmin();
    const saved = await aiEmployeeBriefUpdate(admin, { ...owner, userId: "user-1" } as McpAuthContext, "nay", input);
    expect(saved).toMatchObject({ ok: true, name: "Naya", previous, brief: next });
    expect(calls[0]?.fn).toBe("ai_employee_brief_write");
    expect(calls[0]?.args.p_user_id).toBe("user-1");
    expect(calls[0]?.args.p_organization_id).toBe("org-1");
    expect(calls[0]?.args.p_employee_id).toBe("emp-1");
    expect(calls[0]?.args.p_brief).toMatchObject({
      audience: "keluarga",
      voice: "hangat",
      persona_ids: ["22222222-2222-4222-8222-222222222222"],
      product_knowledge_ids: ["33333333-3333-4333-8333-333333333333"],
    });
  });
});

describe("ai employee routines", () => {
  const routineRow = {
    action_code: "work_report.weekly",
    cadence: "weekly",
    weekday: null,
    time_local: "09:00:00",
    is_active: true,
    next_run_at: "2026-11-03T02:00:00+00",
    last_sent_at: null,
    last_status: null,
  };

  function routineAdmin(routines: Record<string, unknown>[] = [routineRow]) {
    const calls: { fn: string; args: Record<string, unknown> }[] = [];
    const admin = {
      from(table: string) {
        const builder = {
          select() { return builder; },
          eq() { return builder; },
          order() { return builder; },
          in() { return builder; },
          gte() { return builder; },
          lt() { return builder; },
          limit() { return builder; },
          then(resolve: (value: { data: Record<string, unknown>[]; error: null }) => void) {
            const data = table === "employees"
              ? [{ id: "emp-1", full_name: "Naya" }]
              : table === "ai_employee_routines"
                ? routines
                : [];
            resolve({ data, error: null });
          },
        };
        return builder;
      },
      async rpc(fn: string, args: Record<string, unknown>) {
        calls.push({ fn, args });
        if (fn === "mcp_list_ai_employee_routines") {
          return { data: [{ ...routineRow, reviewer_name: "Octa", deliveries: [] }], error: null };
        }
        return {
          data: { ok: true, previous: null, routine: { ...routineRow, time_local: "09:00" } },
          error: null,
        };
      },
    };
    return { admin: admin as unknown as SupabaseClient, calls };
  }

  it("includes active routines on status and lists deliveries without an email address", async () => {
    const { admin } = routineAdmin();
    const status = await aiEmployeeStatus(admin, { ...owner, userId: "user-1" } as McpAuthContext, "nay");
    expect(status).toMatchObject({
      name: "Naya",
      routines: [{ action_code: "work_report.weekly", cadence: "weekly", time_local: "09:00:00" }],
    });
    const listed = await aiEmployeeRoutinesList(admin, { ...owner, userId: "user-1" } as McpAuthContext, "nay");
    expect(listed).toMatchObject({
      name: "Naya",
      routines: [{ reviewer_name: "Octa", deliveries: [] }],
    });
    if (!("routines" in listed)) throw new Error("routines missing");
    expect(listed.routines[0]).not.toHaveProperty("recipient_email");
    expect(listed.routines[0]).not.toHaveProperty("reviewer_email");
    expect(JSON.stringify(listed)).not.toContain("@");
  });

  it("rejects an unknown action and an admin, and sends the owner payload", async () => {
    expect(validateRoutineUpdate({ actionCode: "hr.report", cadence: "days", weekday: null, weekdays: [1], timeLocal: "09:00" })).toEqual({
      ok: false,
      error: "invalid_action",
    });
    expect(validateRoutineUpdate({ actionCode: "work_report.daily", cadence: "mon_thu", weekday: null, timeLocal: "09:00" })).toEqual({
      ok: false,
      error: "invalid_cadence",
    });
    expect(validateRoutineUpdate({ actionCode: "work_report.daily", cadence: "days", weekday: null, weekdays: [], timeLocal: "09:00" })).toEqual({
      ok: false,
      error: "invalid_weekday",
    });
    expect(validateRoutineUpdate({ actionCode: "work_report.email", cadence: "weekly", weekday: 1, timeLocal: "23:50" })).toEqual({
      ok: false,
      error: "invalid_action",
    });
    expect(validateRoutineUpdate({ actionCode: "work_report.weekly", cadence: "weekly", weekday: null, timeLocal: "09:00" })).toEqual({
      ok: false,
      error: "invalid_weekday",
    });
    const { admin, calls } = routineAdmin();
    const rejected = await aiEmployeeRoutineUpsert(admin, { ...owner, userId: "user-1" } as McpAuthContext, {
      employeeName: "nay",
      actionCode: "hr.report",
      cadence: "days",
      weekday: null,
      weekdays: [1],
      timeLocal: "09:00",
      isActive: true,
    });
    expect(rejected).toMatchObject({ ok: false, error: "invalid_action" });
    expect(calls).toHaveLength(0);
    await expect(aiEmployeeRoutineUpsert(admin, { ...owner, userId: "user-1", roles: ["admin"] } as McpAuthContext, {
      employeeName: "nay",
      actionCode: "work_report.email",
      cadence: "weekly",
      weekday: 1,
      timeLocal: "09:00",
      isActive: true,
    })).rejects.toThrow("forbidden");
    const saved = await aiEmployeeRoutineUpsert(admin, { ...owner, userId: "user-1" } as McpAuthContext, {
      employeeName: "nay",
      actionCode: "work_report.daily",
      cadence: "days",
      weekday: 5,
      weekdays: [5, 1, 1],
      timeLocal: "09:00",
      isActive: true,
    });
    expect(saved).toMatchObject({ ok: true, name: "Naya", previous: null });
    expect(calls[0]?.fn).toBe("ai_employee_routine_write");
    expect(calls[0]?.args).toMatchObject({
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_employee_id: "emp-1",
      p_action_code: "work_report.daily",
      p_cadence: "days",
      p_weekday: null,
      p_weekdays: [1, 5],
      p_time_local: "09:00",
      p_is_active: true,
    });
  });
});
