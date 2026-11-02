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

export function assertOrgOwner(ctx: { organizationId: string; roles: readonly string[] }): void {
  const owner = ctx.roles.some((role) => String(role ?? "").trim().toLowerCase() === "owner");
  if (!ctx.organizationId || !owner) throw new Error("forbidden");
}

const LOCAL_TIME = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

function clockSeconds(value: string): number | null {
  const match = LOCAL_TIME.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] ?? "0");
}

export function validateScheduleUpdate(input: {
  weekday: number;
  startLocal: string;
  dueLocal: string;
}): { ok: true } | { ok: false; error: "invalid_weekday" | "invalid_time" | "due_not_after_start" } {
  if (!Number.isInteger(input.weekday) || input.weekday < 1 || input.weekday > 7) {
    return { ok: false, error: "invalid_weekday" };
  }
  const start = clockSeconds(input.startLocal);
  const due = clockSeconds(input.dueLocal);
  if (start == null || due == null) return { ok: false, error: "invalid_time" };
  if (due <= start) return { ok: false, error: "due_not_after_start" };
  return { ok: true };
}

export function matchEmployeeName<T extends { full_name: string }>(
  employees: readonly T[],
  rawName: string,
): { ok: true; employee: T } | { ok: false; names: string[] } {
  const wanted = rawName.trim().toLowerCase();
  const names = employees.map((employee) => employee.full_name);
  if (!wanted) return { ok: false, names };
  const exact = employees.filter((employee) => employee.full_name.trim().toLowerCase() === wanted);
  if (exact.length === 1) return { ok: true, employee: exact[0] };
  if (exact.length > 1 || wanted.length < 2) return { ok: false, names };
  const nicknames = employees.filter((employee) => employee.full_name.trim().toLowerCase().startsWith(wanted));
  if (nicknames.length !== 1) return { ok: false, names };
  return { ok: true, employee: nicknames[0] };
}

export function chatOutsideReply(desk: { reason: string; can_do: readonly string[] }): string {
  return `Itu di luar tugasku. ${desk.reason} Yang bisa aku kerjakan: ${desk.can_do.join(", ")}.`;
}

const GREETING_WORDS = new Set(["halo", "hai", "hi", "hey", "pagi", "siang", "sore", "malam", "selamat"]);

export function isSimpleChatGreeting(message: string, employeeName: string): boolean {
  const tokens = message.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 4) return false;
  const name = employeeName.trim().toLowerCase();
  return tokens.every((token) => GREETING_WORDS.has(token) || nameToken(token, name));
}

function nameToken(token: string, fullName: string): boolean {
  if (token.length < 2 || !fullName) return false;
  if (fullName === token || fullName.startsWith(token)) return true;
  return fullName.split(/\s+/).some((part) => part.startsWith(token));
}

export function shortPersonalName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  for (const part of parts) {
    if (part.toLowerCase().endsWith("aldi") && part.length > 4) return "Aldi";
  }
  const first = parts[0] ?? "";
  if (!first) return "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function politeAddress(fullName: string, role: string): string {
  const short = shortPersonalName(fullName);
  if (!short) return "";
  return role.trim().toLowerCase() === "owner" ? `Pak ${short}` : short;
}

export function greetingReply(employeeName: string, address: string): string {
  const who = employeeName.trim() || "Naya";
  const hello = address.trim() ? `Halo ${address.trim()}` : "Halo";
  return `${hello}, aku ${who}. Aku bisa bantu susun content plan, brief, atau ide konten. Mau dibantu yang mana?`;
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

export const aiEmployeeChatInput = aiEmployeeNameInput.extend({
  message: z.string().trim().min(1).max(4000),
}).strict();

export const aiEmployeeScheduleUpdateInput = aiEmployeeNameInput.extend({
  sop_code: z.string().trim().min(1).max(20),
  weekday: z.number().int().min(1).max(7),
  start_local: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/),
  due_local: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/),
  is_active: z.boolean(),
}).strict();
