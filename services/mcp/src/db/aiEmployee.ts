import type { SupabaseClient } from "@supabase/supabase-js";
import type { McpAuthContext } from "../authz/context";
import {
  assertOrgOwner,
  assertOrgOwnerOrAdmin,
  chatOutsideReply,
  greetingReply,
  isSimpleChatGreeting,
  judgeJobDesk,
  matchEmployeeName,
  politeAddress,
  modelAllowance,
  resolveReportPeriod,
  validateScheduleUpdate,
} from "../tools/aiEmployee/rules";

type Row = Record<string, unknown>;

type Chain = {
  select: (columns: string) => Chain;
  eq: (column: string, value: unknown) => Chain;
  in: (column: string, value: unknown) => Chain;
  gte: (column: string, value: unknown) => Chain;
  lt: (column: string, value: unknown) => Chain;
  order: (column: string, options?: { ascending?: boolean }) => Chain;
  limit: (count: number) => Chain;
  then: (resolve: (value: { data: Row[] | null; error: { message: string } | null }) => void) => void;
};

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function rows(
  admin: SupabaseClient,
  table: string,
  columns: string,
  apply: (query: Chain) => Chain,
): Promise<Row[]> {
  const query = apply(admin.from(table).select(columns) as unknown as Chain);
  const { data, error } = await (query as unknown as Promise<{ data: Row[] | null; error: { message: string } | null }>);
  if (error) throw new Error("query_failed");
  return data ?? [];
}

export type AiEmployeeListItem = {
  name: string;
  job_title: string | null;
  performance_status: string | null;
  is_active: boolean;
};

async function employeesInOrg(admin: SupabaseClient, organizationId: string): Promise<Row[]> {
  return rows(admin, "employees", "id, full_name", (query) => query
    .eq("organization_id", organizationId)
    .eq("is_ai", true)
    .order("full_name"));
}

export async function listAiEmployees(admin: SupabaseClient, ctx: McpAuthContext): Promise<AiEmployeeListItem[]> {
  assertOrgOwnerOrAdmin(ctx);
  const employees = await employeesInOrg(admin, ctx.organizationId);
  const ids = employees.map((row) => String(row.id));
  const profiles = ids.length === 0
    ? []
    : await rows(admin, "ai_employee_profiles", "employee_id, job_title, performance_status, is_active", (query) => query
      .eq("organization_id", ctx.organizationId)
      .in("employee_id", ids));
  const profileByEmployee = new Map(profiles.map((row) => [String(row.employee_id), row]));
  return employees.map((row) => {
    const profile = profileByEmployee.get(String(row.id));
    return {
      name: String(row.full_name ?? ""),
      job_title: asText(profile?.job_title),
      performance_status: asText(profile?.performance_status),
      is_active: profile?.is_active !== false,
    };
  });
}

type NamedEmployee = { id: string; full_name: string };

async function requireNamedEmployee(
  admin: SupabaseClient,
  ctx: McpAuthContext,
  employeeName: string,
): Promise<NamedEmployee | { ok: false; error: "employee_not_found"; names: string[] }> {
  assertOrgOwnerOrAdmin(ctx);
  const employees = (await employeesInOrg(admin, ctx.organizationId)).map((row) => ({
    id: String(row.id),
    full_name: String(row.full_name ?? ""),
  }));
  const matched = matchEmployeeName(employees, employeeName);
  if (!matched.ok) return { ok: false, error: "employee_not_found", names: matched.names };
  return matched.employee;
}

export async function aiEmployeeStatus(admin: SupabaseClient, ctx: McpAuthContext, employeeName: string, now = new Date()) {
  const employee = await requireNamedEmployee(admin, ctx, employeeName);
  if ("error" in employee) return employee;
  const [profiles, sops, schedules, permissions, usage] = await Promise.all([
    rows(admin, "ai_employee_profiles", "job_title, performance_status, is_active, time_zone", (query) => query
      .eq("organization_id", ctx.organizationId)
      .eq("employee_id", employee.id)
      .limit(1)),
    rows(admin, "ai_employee_sops", "code, title, version", (query) => query
      .eq("organization_id", ctx.organizationId)
      .eq("employee_id", employee.id)
      .eq("is_current", true)
      .order("code")),
    rows(admin, "ai_employee_schedules", "sop_code, weekday, start_local, due_local", (query) => query
      .eq("organization_id", ctx.organizationId)
      .eq("employee_id", employee.id)
      .eq("is_active", true)
      .order("weekday")),
    rows(admin, "ai_employee_permissions", "action_code", (query) => query
      .eq("organization_id", ctx.organizationId)
      .eq("employee_id", employee.id)
      .order("action_code")),
    rows(admin, "ai_employee_model_calls", "call_count", (query) => query
      .eq("employee_id", employee.id)
      .eq("usage_date", jakartaUsageDate(now))
      .limit(1)),
  ]);
  const profile = profiles[0];
  return {
    name: employee.full_name,
    job_title: asText(profile?.job_title),
    performance_status: asText(profile?.performance_status),
    is_active: profile?.is_active !== false,
    time_zone: asText(profile?.time_zone),
    sops: sops.map((row) => ({ code: row.code, title: row.title, version: row.version })),
    schedules: schedules.map((row) => ({
      sop_code: row.sop_code,
      weekday: row.weekday,
      start_local: row.start_local,
      due_local: row.due_local,
    })),
    permissions: permissions.map((row) => String(row.action_code)),
    model_calls_today: modelAllowance(asText(profile?.performance_status), asNumber(usage[0]?.call_count) ?? 0),
  };
}

function jakartaUsageDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export async function aiEmployeeRuns(
  admin: SupabaseClient,
  ctx: McpAuthContext,
  employeeName: string,
  limit: number | null,
) {
  const employee = await requireNamedEmployee(admin, ctx, employeeName);
  if ("error" in employee) return employee;
  const cap = limit ?? 10;
  const runs = await rows(
    admin,
    "ai_employee_runs",
    "started_at, finished_at, sop_code, status, plan_count, model_calls, note",
    (query) => query
      .eq("organization_id", ctx.organizationId)
      .eq("employee_id", employee.id)
      .order("started_at", { ascending: false })
      .limit(cap),
  );
  return {
    name: employee.full_name,
    runs: runs.map((row) => ({
      started_at: row.started_at,
      finished_at: row.finished_at,
      sop_code: row.sop_code,
      status: row.status,
      plan_count: row.plan_count,
      model_calls: row.model_calls,
      note: row.note,
    })),
  };
}

export async function aiEmployeeReport(
  admin: SupabaseClient,
  ctx: McpAuthContext,
  employeeName: string,
  period: string,
  now = new Date(),
) {
  const window = resolveReportPeriod(period, now);
  if (!window) throw new Error("invalid_input");
  const employee = await requireNamedEmployee(admin, ctx, employeeName);
  if ("error" in employee) return employee;
  const start = `${window.start}T00:00:00+07:00`;
  const end = new Date(`${window.end}T00:00:00+07:00`);
  end.setUTCDate(end.getUTCDate() + 1);
  const [runs, objectives] = await Promise.all([
    rows(admin, "ai_employee_runs", "status, plan_count", (query) => query
      .eq("organization_id", ctx.organizationId)
      .eq("employee_id", employee.id)
      .gte("started_at", start)
      .lt("started_at", end.toISOString())),
    rows(admin, "individual_objectives", "id", (query) => query
      .eq("organization_id", ctx.organizationId)
      .eq("employee_id", employee.id)),
  ]);
  const objectiveIds = objectives.map((row) => String(row.id));
  const keyResults = objectiveIds.length === 0
    ? []
    : await rows(
      admin,
      "key_results",
      "ai_kr_code, title, current_value, target_value, unit, progress_percentage",
      (query) => query.in("individual_objective_id", objectiveIds),
    );
  const succeeded = runs.filter((row) => row.status === "succeeded").length;
  const failed = runs.filter((row) => row.status === "failed").length;
  const plans = runs.reduce((sum, row) => sum + (asNumber(row.plan_count) ?? 0), 0);
  return {
    name: employee.full_name,
    period: window,
    runs_succeeded: succeeded,
    runs_failed: failed,
    runs_other: runs.length - succeeded - failed,
    plans_created: plans,
    key_results: keyResults
      .filter((row) => typeof row.ai_kr_code === "string")
      .map((row) => ({
        code: row.ai_kr_code,
        title: row.title,
        current_value: row.current_value,
        target_value: row.target_value,
        unit: row.unit,
        progress_percentage: row.progress_percentage,
      })),
  };
}

export type AiEmployeeCaller = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  scheduledPostsInternalSecret: string;
};

async function postAiEmployeeRun(
  caller: AiEmployeeCaller,
  payload: Record<string, unknown>,
  fetchImpl: typeof fetch,
) {
  const response = await fetchImpl(`${caller.supabaseUrl.replace(/\/+$/, "")}/functions/v1/ai-employee-run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${caller.supabaseServiceRoleKey}`,
      apikey: caller.supabaseServiceRoleKey,
      "Content-Type": "application/json",
      "x-synckerja-internal-secret": caller.scheduledPostsInternalSecret,
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    body = { error: "non_json" };
  }
  return { status: response.status, body };
}

function publicRunFields(status: number, body: Record<string, unknown>) {
  return {
    ok: body.ok === true,
    http_status: status,
    error: typeof body.error === "string" ? body.error.slice(0, 200) : null,
    run_id: typeof body.run_id === "string" ? body.run_id : null,
    model_calls: typeof body.model_calls === "number" ? body.model_calls : null,
    model_status: typeof body.model_status === "number" ? body.model_status : null,
    model_error: typeof body.model_error === "string" ? body.model_error.slice(0, 200) : null,
  };
}

export async function aiEmployeeCommand(
  admin: SupabaseClient,
  caller: AiEmployeeCaller,
  ctx: McpAuthContext,
  input: { employeeName: string; instruction: string; dryRun: boolean | null },
  fetchImpl: typeof fetch = fetch,
) {
  const employee = await requireNamedEmployee(admin, ctx, input.employeeName);
  if ("error" in employee) return employee;
  const desk = judgeJobDesk(input.instruction);
  if (!desk.ok) {
    return {
      ok: false,
      error: "outside_job_desk",
      reason: desk.reason,
      can_do: desk.can_do,
      suggestion: desk.suggestion,
    };
  }
  const dryRun = input.dryRun !== false;
  const result = await postAiEmployeeRun(caller, {
    employee_id: employee.id,
    instruction: input.instruction,
    dry_run: dryRun,
  }, fetchImpl);
  return {
    ...publicRunFields(result.status, result.body),
    dry_run: result.body.dry_run === true,
    draft: result.body.draft && typeof result.body.draft === "object" ? result.body.draft : null,
  };
}

async function chatSpeaker(admin: SupabaseClient, ctx: McpAuthContext, employeeId: string) {
  const role = ctx.roles.some((item) => item.trim().toLowerCase() === "owner")
    ? "owner"
    : ctx.roles.some((item) => item.trim().toLowerCase() === "admin")
      ? "admin"
      : "member";
  const [profiles, reviewers] = await Promise.all([
    ctx.userId
      ? rows(admin, "profiles", "full_name", (query) => query.eq("user_id", ctx.userId).limit(1))
      : Promise.resolve([]),
    rows(admin, "ai_employee_profiles", "reviewer_employee_id", (query) => query
      .eq("organization_id", ctx.organizationId)
      .eq("employee_id", employeeId)
      .limit(1)),
  ]);
  const name = asText(profiles[0]?.full_name) ?? "";
  const reviewerId = asText(reviewers[0]?.reviewer_employee_id);
  return {
    name,
    role,
    address: politeAddress(name, role),
    is_reviewer: Boolean(ctx.employeeId && reviewerId && ctx.employeeId === reviewerId),
  };
}

export async function aiEmployeeChat(
  admin: SupabaseClient,
  caller: AiEmployeeCaller,
  ctx: McpAuthContext,
  input: { employeeName: string; message: string },
  fetchImpl: typeof fetch = fetch,
) {
  const employee = await requireNamedEmployee(admin, ctx, input.employeeName);
  if ("error" in employee) return employee;
  const speaker = await chatSpeaker(admin, ctx, employee.id);
  if (isSimpleChatGreeting(input.message, employee.full_name)) {
    return {
      ok: true,
      name: employee.full_name,
      reply: greetingReply(employee.full_name, speaker.address),
      outside_job_desk: false,
      model_calls: 0,
    };
  }
  const desk = judgeJobDesk(input.message);
  if (!desk.ok) {
    return {
      ok: true,
      name: employee.full_name,
      reply: chatOutsideReply(desk),
      outside_job_desk: true,
      model_calls: 0,
    };
  }
  const result = await postAiEmployeeRun(caller, {
    employee_id: employee.id,
    instruction: input.message,
    mode: "chat",
    dry_run: true,
    speaker,
  }, fetchImpl);
  const reply = typeof result.body.reply === "string" ? result.body.reply.slice(0, 800) : "";
  if (!reply || result.body.mode !== "chat") {
    const fields = publicRunFields(result.status, result.body);
    return {
      ...fields,
      ok: false,
      error: fields.error ?? "chat_unavailable",
      name: employee.full_name,
      reply: null,
    };
  }
  return {
    ...publicRunFields(result.status, result.body),
    name: typeof result.body.name === "string" && result.body.name ? result.body.name : employee.full_name,
    reply,
    outside_job_desk: false,
  };
}

function scheduleView(row: Row) {
  return {
    sop_code: String(row.sop_code ?? ""),
    weekday: Number(row.weekday),
    start_local: String(row.start_local ?? ""),
    due_local: String(row.due_local ?? ""),
    is_active: row.is_active !== false,
    next_run_at: row.next_run_at ?? null,
  };
}

export async function aiEmployeeScheduleUpdate(
  admin: SupabaseClient,
  ctx: McpAuthContext,
  input: {
    employeeName: string;
    sopCode: string;
    weekday: number;
    startLocal: string;
    dueLocal: string;
    isActive: boolean;
  },
) {
  assertOrgOwner(ctx);
  const valid = validateScheduleUpdate({
    weekday: input.weekday,
    startLocal: input.startLocal,
    dueLocal: input.dueLocal,
  });
  if (!valid.ok) return { ok: false as const, error: valid.error };
  const employee = await requireNamedEmployee(admin, ctx, input.employeeName);
  if ("error" in employee) return employee;
  const schedules = await rows(
    admin,
    "ai_employee_schedules",
    "id, sop_code, weekday, start_local, due_local, is_active, next_run_at",
    (query) => query
      .eq("organization_id", ctx.organizationId)
      .eq("employee_id", employee.id)
      .eq("sop_code", input.sopCode),
  );
  const matches = schedules.filter((row) => String(row.sop_code ?? "") === input.sopCode);
  if (matches.length === 0) return { ok: false as const, error: "schedule_not_found", name: employee.full_name };
  if (matches.length > 1) return { ok: false as const, error: "schedule_ambiguous", name: employee.full_name };
  const previous = matches[0];
  const { data, error } = await admin
    .from("ai_employee_schedules")
    .update({
      weekday: input.weekday,
      start_local: input.startLocal,
      due_local: input.dueLocal,
      is_active: input.isActive,
    })
    .eq("id", previous.id)
    .eq("organization_id", ctx.organizationId)
    .eq("employee_id", employee.id)
    .select("sop_code, weekday, start_local, due_local, is_active, next_run_at")
    .maybeSingle();
  if (error || !data) throw new Error("query_failed");
  return {
    ok: true as const,
    name: employee.full_name,
    previous: scheduleView(previous),
    schedule: scheduleView(data as Row),
  };
}

function throwBrief(error: { message?: string }): never {
  const message = error.message ?? "";
  if (message.includes("forbidden")) throw new Error("forbidden");
  if (message.includes("not_found")) throw new Error("not_found");
  if (message.includes("invalid_input")) throw new Error("invalid_input");
  throw new Error("query_failed");
}

async function briefCall(admin: SupabaseClient, fn: string, args: Record<string, unknown>) {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throwBrief(error);
  return data as { ok?: boolean; brief?: unknown; previous?: unknown };
}

export async function aiEmployeeBriefGet(
  admin: SupabaseClient,
  ctx: McpAuthContext,
  employeeName: string,
) {
  assertOrgOwner(ctx);
  const employee = await requireNamedEmployee(admin, ctx, employeeName);
  if ("error" in employee) return employee;
  const result = await briefCall(admin, "ai_employee_brief_read", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_employee_id: employee.id,
  });
  return { ok: true as const, name: employee.full_name, brief: result.brief ?? null };
}

export async function aiEmployeeBriefUpdate(
  admin: SupabaseClient,
  ctx: McpAuthContext,
  employeeName: string,
  brief: {
    serviceIds: string[];
    audience: string;
    personaIds: string[];
    voice: string;
    requiredNotes: string;
    forbiddenNotes: string;
    pillarIds: string[];
    productKnowledgeIds: string[];
    splitRule: string;
  },
) {
  assertOrgOwner(ctx);
  const employee = await requireNamedEmployee(admin, ctx, employeeName);
  if ("error" in employee) return employee;
  const result = await briefCall(admin, "ai_employee_brief_write", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_employee_id: employee.id,
    p_brief: {
      service_ids: brief.serviceIds,
      audience: brief.audience,
      persona_ids: brief.personaIds,
      voice: brief.voice,
      required_notes: brief.requiredNotes,
      forbidden_notes: brief.forbiddenNotes,
      pillar_ids: brief.pillarIds,
      product_knowledge_ids: brief.productKnowledgeIds,
      split_rule: brief.splitRule,
    },
  });
  return {
    ok: true as const,
    name: employee.full_name,
    previous: result.previous ?? null,
    brief: result.brief ?? null,
  };
}
