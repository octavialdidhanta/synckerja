/** Synckerja Agent (laptop program): pure helpers for the Agent tab. */

export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export interface AgentDeviceToken {
  revoked_at: string | null;
  expires_at: string | null;
}

export interface AgentDeviceRow {
  device_id: string;
  last_seen_at: string;
  token_id: string | null;
  agent_tokens: AgentDeviceToken | null;
  agent_devices: {
    id: string;
    name: string;
    agent_version: string | null;
    platform: string | null;
    tools: Record<string, unknown> | null;
    last_error: string | null;
    last_seen_at: string;
    update_required?: boolean | null;
  } | null;
}

export interface AgentTokenRow {
  id: string;
  token_prefix: string;
  label: string;
  scopes: string[];
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
}

export type TokenState = "aktif" | "kadaluarsa" | "dicabut";

export function tokenState(t: Pick<AgentTokenRow, "expires_at" | "revoked_at">, now = Date.now()): TokenState {
  if (t.revoked_at) return "dicabut";
  if (t.expires_at && new Date(t.expires_at).getTime() <= now) return "kadaluarsa";
  return "aktif";
}

/** Online when this org saw a heartbeat in the last 2 minutes (the Agent sends one every minute). */
export function isOnline(lastSeenAt: string | null | undefined, now = Date.now()): boolean {
  if (!lastSeenAt) return false;
  const t = new Date(lastSeenAt).getTime();
  return Number.isFinite(t) && now - t < ONLINE_WINDOW_MS;
}

export interface DevicePresence {
  last_seen_at: string | null;
  /** Absent when the row was not loaded with its token. Null means this laptop has no token. */
  token_id?: string | null;
  token?: AgentDeviceToken | null;
}

export type DeviceLink = "online" | "offline" | "terputus";

/**
 * A revoked, expired, or missing token drops the laptop immediately.
 * A recent heartbeat does not keep it green. Heartbeat age matters only while the token is still valid.
 */
export function deviceLink(row: DevicePresence, now = Date.now()): DeviceLink {
  const tokenLoaded = row.token_id !== undefined || row.token !== undefined;
  if (tokenLoaded && !row.token_id) return "terputus";
  if (row.token && tokenState(row.token, now) !== "aktif") return "terputus";
  return isOnline(row.last_seen_at, now) ? "online" : "offline";
}

/**
 * While a laptop is still connected, hide the ones that have stopped.
 * When every laptop is disconnected, keep only the one heard from most recently
 * so an older laptop does not reappear beside it.
 */
export function visibleDevices<T extends DevicePresence>(rows: T[], now = Date.now()): T[] {
  const online = rows.filter((row) => deviceLink(row, now) === "online");
  if (online.length > 0) return online;
  if (rows.length <= 1) return rows;
  const latest = [...rows].sort((a, b) => (b.last_seen_at ?? "").localeCompare(a.last_seen_at ?? ""))[0];
  return latest ? [latest] : rows;
}

/** "baru saja", "5 menit lalu", "3 jam lalu", "2 hari lalu". */
export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "belum pernah";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "baru saja";
  if (s < 3600) return `${Math.floor(s / 60)} menit lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  return `${Math.floor(s / 86400)} hari lalu`;
}

export interface ToolStatus {
  key: string;
  ok: boolean;
  detail: string | null;
}

/**
 * Tools reported by the Agent self-check: { ffmpeg: { ok: true, version: "7.1" }, sam2: { ok: false, detail: "..." } }.
 * Missing ones first, so what is broken is the first thing you see.
 */
export function toolList(tools: Record<string, unknown> | null | undefined): ToolStatus[] {
  if (!tools) return [];
  const out: ToolStatus[] = [];
  for (const [key, v] of Object.entries(tools)) {
    if (!v || typeof v !== "object") continue;
    const r = v as Record<string, unknown>;
    const detail =
      typeof r.detail === "string" ? r.detail : typeof r.version === "string" ? r.version : null;
    out.push({ key, ok: r.ok === true, detail });
  }
  return out.sort((a, b) => Number(a.ok) - Number(b.ok) || a.key.localeCompare(b.key));
}

export interface AgentJobRow {
  id: string;
  title: string;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  stage: string | null;
  progress: number;
  attempts: number;
  max_attempts: number;
  error: string | null;
  /** Tail of the Agent laptop log for this job (failed/done debugging). */
  log: string | null;
  result: {
    google_drive_link?: string;
    version_no?: number;
    output_file?: string;
    /** Still preview: sheet in the production folder on the laptop, and (Agent 0.1.20+) its upload in catalog-media. */
    stills_file?: string;
    stills_path?: string;
    stills?: number[];
  } | null;
  social_media_plan_id: string | null;
  created_at: string;
  finished_at: string | null;
  heartbeat_at: string | null;
}

export const JOB_STATUS: Record<AgentJobRow["status"], string> = {
  queued: "menunggu",
  running: "jalan",
  done: "selesai",
  failed: "gagal",
  cancelled: "dibatalkan",
};

/** Queued and running first (oldest first, like the Agent takes them), then the rest newest first. */
export function sortJobs(jobs: AgentJobRow[]): AgentJobRow[] {
  const active = jobs.filter((j) => j.status === "queued" || j.status === "running");
  const rest = jobs.filter((j) => j.status !== "queued" && j.status !== "running");
  active.sort((a, b) => a.created_at.localeCompare(b.created_at));
  rest.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return [...active, ...rest];
}

/** Storage path of a done still preview's sheet, when the Agent uploaded it into this organization's folder. */
export function stillsPath(job: Pick<AgentJobRow, "status" | "result">, organizationId: string | null | undefined): string | null {
  const path = job.status === "done" ? job.result?.stills_path : undefined;
  if (!organizationId || typeof path !== "string") return null;
  if (!path.startsWith(`${organizationId}/render-stills/`) || path.includes("..") || !/\.jpe?g$/i.test(path)) return null;
  return path;
}
