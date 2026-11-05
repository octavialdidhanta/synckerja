import type {
  AiEmployeeJob,
  AiEmployeeKeyResult,
  AiEmployeePageData,
  AiEmployeePlanLink,
  AiEmployeeQuota,
  AiEmployeeRun,
  AiEmployeeSummary,
  BriefChange,
  BriefDraft,
  AngleOption,
  CatalogOption,
  ProductOption,
  RoutineRow,
  ScheduleRow,
} from "./types";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function asAngleOptions(value: unknown): AngleOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    if (!row || typeof row.id !== "string") return [];
    const code = asString(row.code);
    const name = asString(row.name, code);
    const master = asString(row.master);
    const fallback = asString(row.label, [master, name].filter(Boolean).join(" · ") || name || code);
    const label = code ? `Angle - ${code}` : fallback;
    const ideas = Array.isArray(row.ideas)
      ? row.ideas.flatMap((idea) => {
          const child = asRecord(idea);
          if (!child || typeof child.id !== "string") return [];
          const ideaCode = asString(child.code);
          return [{
            id: child.id,
            code: ideaCode,
            name: asString(child.name, ideaCode),
            statement: asString(child.statement),
          }];
        })
      : [];
    const otherIdeaCount = asNumber(row.other_idea_count);
    return [{
      id: row.id,
      label,
      master,
      code,
      name: name || label,
      statement: asString(row.statement),
      serviceId: asNullableString(row.service_id),
      ideas,
      pillarIds: asStringArray(row.pillar_ids),
      otherIdeaCount: otherIdeaCount != null && otherIdeaCount > 0 ? otherIdeaCount : 0,
    }];
  });
}

function asOptions(value: unknown): CatalogOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    if (!row || typeof row.id !== "string") return [];
    return [{
      id: row.id,
      label: asString(row.label, asString(row.name, asString(row.feature_name, asString(row.audience, "Tanpa nama")))),
    }];
  });
}

function asProducts(value: unknown): ProductOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    if (!row || typeof row.id !== "string") return [];
    return [{
      id: row.id,
      label: asString(row.label, asString(row.feature_name, "Produk")),
      serviceId: typeof row.service_id === "string" ? row.service_id : null,
      parentServiceId: typeof row.parent_service_id === "string" ? row.parent_service_id : null,
    }];
  });
}

export function briefDraftFromPayload(value: unknown): { draft: BriefDraft; labels: AiEmployeePageData["briefLabels"] } {
  const row = asRecord(value) ?? {};
  return {
    draft: {
      serviceIds: asStringArray(row.service_ids),
      audience: asString(row.audience),
      personaIds: asStringArray(row.persona_ids),
      voice: asString(row.voice),
      requiredNotes: asString(row.required_notes),
      forbiddenNotes: asString(row.forbidden_notes),
      pillarIds: asStringArray(row.pillar_ids),
      productIds: asStringArray(row.product_knowledge_ids),
      angleIds: asStringArray(row.angle_ids),
      repeatVoices: asStringArray(row.repeat_voices),
      splitRule: asString(row.split_rule),
    },
    labels: {
      services: asOptions(row.services).map((item) => ({ ...item, label: item.label })),
      personas: asOptions(row.personas),
      pillars: asOptions(row.pillars),
      products: asOptions(row.products),
      angles: asOptions(row.angles),
    },
  };
}

function parseSummary(value: unknown): AiEmployeeSummary {
  const row = asRecord(value);
  if (!row) throw new Error("invalid_payload");
  return {
    fullName: asString(row.full_name, "Karyawan AI"),
    jobTitle: asNullableString(row.job_title),
    reviewerName: asNullableString(row.reviewer_name),
    performanceStatus: asNullableString(row.performance_status),
    isActive: asBoolean(row.is_active),
    reportCopyEmail1: asNullableString(row.report_copy_email_1),
    reportCopyEmail2: asNullableString(row.report_copy_email_2),
    reportSenderName: asNullableString(row.report_sender_name),
  };
}

function parseKeyResults(value: unknown): AiEmployeeKeyResult[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    if (!row || typeof row.code !== "string") return [];
    return [{
      code: row.code,
      title: asString(row.title, row.code),
      currentValue: asNumber(row.current_value),
      targetValue: asNumber(row.target_value),
      unit: asNullableString(row.unit),
      progressPercentage: asNumber(row.progress_percentage),
    }];
  });
}

function parsePlans(value: unknown): AiEmployeePlanLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    if (!row || typeof row.id !== "string") return [];
    return [{ id: row.id, title: asString(row.title, "Plan") }];
  });
}

function parseRuns(value: unknown): AiEmployeeRun[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    if (!row || typeof row.id !== "string") return [];
    return [{
      id: row.id,
      startedAt: asNullableString(row.started_at),
      finishedAt: asNullableString(row.finished_at),
      sopCode: asNullableString(row.sop_code),
      status: asString(row.status, "unknown"),
      planCount: asNumber(row.plan_count) ?? 0,
      note: asString(row.note),
      plans: parsePlans(row.plans),
    }];
  });
}

function parseJobs(value: unknown): AiEmployeeJob[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    if (!row || typeof row.id !== "string") return [];
    return [{
      id: row.id,
      source: asString(row.source, "task"),
      priority: asString(row.priority, "medium"),
      status: asString(row.status, "queued"),
      attempts: asNumber(row.attempts) ?? 0,
      reason: asString(row.reason),
      createdAt: asNullableString(row.created_at),
      finishedAt: asNullableString(row.finished_at),
    }];
  });
}

function parseRoutines(value: unknown): RoutineRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    const actionCode = row?.action_code;
    const chosenDays = Array.isArray(row?.weekdays)
      ? [...new Set(row.weekdays.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 1 && day <= 7))].sort((left, right) => left - right)
      : [];
    const cadence = row?.cadence === "days" || row?.cadence === "mon_thu" || row?.cadence === "weekly" || row?.cadence === "monthly"
      ? (row.cadence === "mon_thu" ? "days" : row.cadence)
      : null;
    if (!row || (
      actionCode !== "work_report.daily"
      && actionCode !== "work_report.weekly"
      && actionCode !== "work_report.monthly"
    ) || !cadence) return [];
    return [{
      actionCode,
      cadence,
      weekday: cadence === "weekly" ? asNumber(row.weekday) : null,
      weekdays: cadence === "days" ? (row.cadence === "mon_thu" ? [1, 2, 3, 4] : chosenDays) : [],
      timeLocal: asString(row.time_local, "09:00").slice(0, 5),
      isActive: asBoolean(row.is_active) ?? false,
      nextRunAt: asNullableString(row.next_run_at),
      lastSentAt: asNullableString(row.last_sent_at),
      lastStatus: asNullableString(row.last_status),
      lastError: asString(row.last_error),
      reviewerName: asNullableString(row.reviewer_name),
      reviewerEmail: asNullableString(row.reviewer_email),
    }];
  });
}

function parseSchedules(value: unknown): ScheduleRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    if (!row || typeof row.sop_code !== "string") return [];
    const cadence = row.cadence === "days" || row.cadence === "monthly" || row.cadence === "weekly"
      ? row.cadence
      : "weekly";
    const weekday = asNumber(row.weekday);
    if (cadence === "weekly" && weekday == null) return [];
    const planCount = asNumber(row.plan_count);
    const weekdays = Array.isArray(row.weekdays)
      ? row.weekdays.map((day) => asNumber(day)).filter((day): day is number => day != null && day >= 1 && day <= 7)
      : [];
    return [{
      sopCode: row.sop_code,
      cadence,
      weekday: cadence === "weekly" ? weekday : null,
      weekdays: cadence === "days" ? weekdays : [],
      planCount: planCount != null && planCount >= 1 && planCount <= 7 ? planCount : 1,
      startLocal: asString(row.start_local, "00:00").slice(0, 5),
      dueLocal: asString(row.due_local, "00:00").slice(0, 5),
      isActive: asBoolean(row.is_active) ?? false,
      nextRunAt: asNullableString(row.next_run_at),
    }];
  });
}

function parseQuota(value: unknown): AiEmployeeQuota {
  const row = asRecord(value) ?? {};
  return {
    usageDate: asString(row.usage_date),
    used: asNumber(row.used) ?? 0,
    cap: asNumber(row.cap),
    remaining: asNumber(row.remaining),
    orgUsageDate: asString(row.org_usage_date),
    orgUsed: asNumber(row.org_used) ?? 0,
    orgLimit: asNumber(row.org_limit) ?? 0,
    orgRemaining: asNumber(row.org_remaining) ?? 0,
  };
}

export function parseAiEmployeePage(value: unknown): AiEmployeePageData {
  const row = asRecord(value);
  if (!row || typeof row.organization_id !== "string") throw new Error("invalid_payload");
  const brief = briefDraftFromPayload(row.brief);
  const options = asRecord(row.options) ?? {};
  return {
    organizationId: row.organization_id,
    canEdit: row.can_edit === true,
    summary: parseSummary(row.summary),
    keyResults: parseKeyResults(row.key_results),
    runs: parseRuns(row.runs),
    jobs: parseJobs(row.jobs),
    schedules: parseSchedules(row.schedules),
    routines: parseRoutines(row.routines),
    brief: brief.draft,
    briefLabels: brief.labels,
    options: {
      services: asOptions(options.services),
      personas: asOptions(options.personas),
      pillars: asOptions(options.pillars),
      products: asProducts(options.products),
      angles: asAngleOptions(options.angles),
    },
    quota: parseQuota(row.quota),
  };
}

export function sameIds(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((id, index) => id === sortedRight[index]);
}

export function sameBrief(left: BriefDraft, right: BriefDraft): boolean {
  return sameIds(left.serviceIds, right.serviceIds)
    && left.audience === right.audience
    && sameIds(left.personaIds, right.personaIds)
    && left.voice === right.voice
    && left.requiredNotes === right.requiredNotes
    && left.forbiddenNotes === right.forbiddenNotes
    && sameIds(left.pillarIds, right.pillarIds)
    && sameIds(left.productIds, right.productIds)
    && sameIds(left.angleIds, right.angleIds)
    && left.repeatVoices.length === right.repeatVoices.length
    && left.repeatVoices.every((voice, index) => voice === right.repeatVoices[index])
    && left.splitRule === right.splitRule;
}

export function sameSchedule(left: ScheduleRow, right: ScheduleRow): boolean {
  const days = (value: number[]) => [...value].sort((a, b) => a - b).join(",");
  return left.sopCode === right.sopCode
    && left.cadence === right.cadence
    && left.weekday === right.weekday
    && days(left.weekdays) === days(right.weekdays)
    && left.planCount === right.planCount
    && left.startLocal === right.startLocal
    && left.isActive === right.isActive;
}

export function sameRoutine(left: RoutineRow, right: RoutineRow): boolean {
  return left.actionCode === right.actionCode
    && left.cadence === right.cadence
    && left.weekday === right.weekday
    && [...(left.weekdays ?? [])].sort((a, b) => a - b).join(",") === [...(right.weekdays ?? [])].sort((a, b) => a - b).join(",")
    && left.timeLocal === right.timeLocal
    && left.isActive === right.isActive;
}

function nameList(ids: string[], names: Map<string, string>): string {
  if (ids.length === 0) return "—";
  return ids.map((id) => names.get(id) ?? "Tidak ada di katalog").join(", ");
}

function textValue(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "—";
}

export function briefChanges(
  before: BriefDraft,
  after: BriefDraft,
  names: {
    services: Map<string, string>;
    personas: Map<string, string>;
    pillars: Map<string, string>;
    products: Map<string, string>;
    angles: Map<string, string>;
  },
): BriefChange[] {
  const rows: BriefChange[] = [];
  const push = (label: string, changed: boolean, previous: string, next: string) => {
    if (changed) rows.push({ label, before: previous, after: next });
  };
  push("Katalog", !sameIds(before.serviceIds, after.serviceIds), nameList(before.serviceIds, names.services), nameList(after.serviceIds, names.services));
  push("Audiens", before.audience !== after.audience, textValue(before.audience), textValue(after.audience));
  push("Persona", !sameIds(before.personaIds, after.personaIds), nameList(before.personaIds, names.personas), nameList(after.personaIds, names.personas));
  push("Suara", before.voice !== after.voice, textValue(before.voice), textValue(after.voice));
  push("Catatan wajib", before.requiredNotes !== after.requiredNotes, textValue(before.requiredNotes), textValue(after.requiredNotes));
  push("Catatan terlarang", before.forbiddenNotes !== after.forbiddenNotes, textValue(before.forbiddenNotes), textValue(after.forbiddenNotes));
  push("Pilar", !sameIds(before.pillarIds, after.pillarIds), nameList(before.pillarIds, names.pillars), nameList(after.pillarIds, names.pillars));
  push("Fokus angle", !sameIds(before.angleIds, after.angleIds), nameList(before.angleIds, names.angles), nameList(after.angleIds, names.angles));
  push("Gaya pengulangan", before.repeatVoices.join("\n") !== after.repeatVoices.join("\n"), textValue(before.repeatVoices.join("\n")), textValue(after.repeatVoices.join("\n")));
  push("Product Knowledge", !sameIds(before.productIds, after.productIds), nameList(before.productIds, names.products), nameList(after.productIds, names.products));
  push("Aturan pecahan", before.splitRule !== after.splitRule, textValue(before.splitRule), textValue(after.splitRule));
  return rows;
}

export type AiEmployeeFailure = "forbidden" | "not_found" | "invalid" | "other";

export function classifyAiEmployeeError(error: unknown): AiEmployeeFailure {
  const record = asRecord(error);
  const code = asString(record?.code).toUpperCase();
  const message = asString(record?.message).toLowerCase();
  if (code === "42501" || message.includes("forbidden")) return "forbidden";
  if (code === "P0002" || message.includes("not_found") || message.includes("schedule_not_found")) return "not_found";
  if (code === "22023" || message.includes("invalid_input") || message.includes("schedule_ambiguous")) return "invalid";
  return "other";
}
