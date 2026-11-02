import { z } from "zod";

export const AI_EMPLOYEE_CAN_DO = [
  "Menyusun satu content plan",
  "Menulis brief konten",
  "Membaca pillar, katalog, dan kalender konten",
  "Membaca ide Thinking Lab",
  "Memperbarui tugas konten yang sudah ditugaskan kepadanya",
] as const;

const CONTENT_REQUEST = /\b(content plan|konten|brief|caption|posting|pillar|kalender)\b/i;

const OUTSIDE_JOB = [
  { label: "payroll", pattern: /\b(payroll|penggajian|slip gaji|gaji)\b/i },
  { label: "keuangan", pattern: /\b(keuangan|finance|invoice|hutang|piutang|pengeluaran|pemasukan)\b/i },
  { label: "HR", pattern: /\b(hrd?|rekrutmen|rekrut|cuti|phk|absensi)\b/i },
  { label: "CRM", pattern: /\b(crm|prospek)\b/i },
  { label: "ads", pattern: /\b(ads|iklan|google ads|meta ads|tiktok ads)\b/i },
] as const;

export function isOrgOwnerOrAdmin(roles: readonly string[]): boolean {
  return roles.some((role) => {
    const name = String(role ?? "").trim().toLowerCase();
    return name === "owner" || name === "admin";
  });
}

export function assertOrgOwnerOrAdmin(ctx: { organizationId: string; roles: readonly string[] }): void {
  if (!ctx.organizationId || !isOrgOwnerOrAdmin(ctx.roles)) throw new Error("forbidden");
}

export function matchEmployeeName<T extends { full_name: string }>(
  employees: readonly T[],
  rawName: string,
): { ok: true; employee: T } | { ok: false; names: string[] } {
  const wanted = rawName.trim().toLowerCase();
  const names = employees.map((employee) => employee.full_name);
  const matches = employees.filter((employee) => employee.full_name.trim().toLowerCase() === wanted);
  if (matches.length !== 1) return { ok: false, names };
  return { ok: true, employee: matches[0] };
}

export function judgeJobDesk(instruction: string):
  | { ok: true }
  | { ok: false; reason: string; can_do: readonly string[]; suggestion: string } {
  const text = instruction.trim();
  if (CONTENT_REQUEST.test(text)) return { ok: true };
  const areas = OUTSIDE_JOB.filter((item) => item.pattern.test(text)).map((item) => item.label);
  if (areas.length === 0) return { ok: true };
  return {
    ok: false,
    reason: `Instruksi ini masuk wilayah ${areas.join(", ")}. Naya mengerjakan content plan, brief, dan ide konten.`,
    can_do: AI_EMPLOYEE_CAN_DO,
    suggestion: "Minta content plan, brief, atau ide konten. Payroll, keuangan, HR, CRM, dan ads dikerjakan lewat tool manusia yang sesuai.",
  };
}

const PERIOD = /^(today|7d|30d|\d{4}-(0[1-9]|1[0-2]))$/;

export function resolveReportPeriod(period: string, now = new Date()): { start: string; end: string } | null {
  const value = period.trim().toLowerCase();
  if (!PERIOD.test(value)) return null;
  const today = jakartaDate(now);
  if (value === "today") return { start: today, end: today };
  if (value === "7d" || value === "30d") {
    const days = value === "7d" ? 6 : 29;
    return { start: shiftDate(today, -days), end: today };
  }
  const [year, month] = value.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: `${value}-01`,
    end: `${value}-${String(last).padStart(2, "0")}`,
  };
}

export function jakartaDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function shiftDate(day: string, delta: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, date + delta));
  return next.toISOString().slice(0, 10);
}

export function modelAllowance(performanceStatus: string | null, used: number): {
  cap: number;
  used: number;
  remaining: number;
} {
  const cap = performanceStatus === "coaching" ? 8 : 15;
  const safeUsed = Number.isFinite(used) && used > 0 ? Math.floor(used) : 0;
  return { cap, used: safeUsed, remaining: Math.max(0, cap - safeUsed) };
}

export const aiEmployeeListInput = z.object({}).strict();

export const aiEmployeeNameInput = z.object({
  employee_name: z.string().trim().min(1).max(200),
}).strict();

export const aiEmployeeRunsInput = aiEmployeeNameInput.extend({
  limit: z.number().int().min(1).max(50).optional(),
}).strict();

export const aiEmployeeReportInput = aiEmployeeNameInput.extend({
  period: z.string().trim().min(1).max(20),
}).strict();

export const aiEmployeeCommandInput = aiEmployeeNameInput.extend({
  instruction: z.string().trim().min(1).max(4000),
  dry_run: z.boolean().optional(),
}).strict();
