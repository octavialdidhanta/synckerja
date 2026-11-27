/**
 * Pure helpers for agent-api (no Deno / Supabase imports, so they can be unit tested).
 */

export const TOKEN_PATTERN = /^sk_agent_[0-9a-f]{8}_[0-9a-f]{48}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AgentScope = "catalog" | "render";

export type AgentContext = {
  tokenId: string;
  organizationId: string;
  scopes: AgentScope[];
  createdBy: string | null;
  expiresAt: string | null;
};

export function extractAgentToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const m = /^Bearer\s+(\S+)$/.exec(authHeader.trim());
  if (!m) return null;
  return TOKEN_PATTERN.test(m[1]) ? m[1] : null;
}

export async function sha256Hex(input: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function parseAuthRow(row: unknown): AgentContext | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.token_id !== "string" || typeof r.organization_id !== "string") return null;
  const scopes = Array.isArray(r.scopes)
    ? r.scopes.filter((s): s is AgentScope => s === "catalog" || s === "render")
    : [];
  return {
    tokenId: r.token_id,
    organizationId: r.organization_id,
    scopes,
    createdBy: typeof r.created_by === "string" ? r.created_by : null,
    expiresAt: typeof r.expires_at === "string" ? r.expires_at : null,
  };
}

/** "/functions/v1/agent-api/v1/heartbeat" or "/agent-api/v1/heartbeat" → "/v1/heartbeat". */
export function routePath(pathname: string): string {
  const i = pathname.indexOf("/agent-api");
  const rest = i >= 0 ? pathname.slice(i + "/agent-api".length) : pathname;
  const clean = rest.replace(/\/+$/, "");
  return clean === "" ? "/" : clean;
}

export type HeartbeatInput = {
  deviceKey: string;
  name: string;
  agentVersion: string | null;
  platform: string | null;
  tools: Record<string, unknown> | null;
  lastError: string | null;
};

const MAX_TOOLS_BYTES = 20_000;

function optText(v: unknown, max: number): string | null | undefined {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? null : t.slice(0, max);
}

export function parseHeartbeat(body: unknown, deviceHeader: string | null):
  | { ok: true; value: HeartbeatInput; error?: undefined }
  | { ok: false; error: string; value?: undefined } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "body harus object JSON" };
  const b = body as Record<string, unknown>;
  const deviceKey = (deviceHeader ?? (typeof b.device_key === "string" ? b.device_key : "")).trim();
  if (!UUID.test(deviceKey)) return { ok: false, error: "device_key (header X-Agent-Device) harus UUID" };
  const name = typeof b.device_name === "string" ? b.device_name.trim() : "";
  if (name.length < 1 || name.length > 80) return { ok: false, error: "device_name wajib, maks 80 karakter" };
  const agentVersion = optText(b.agent_version, 40);
  const platform = optText(b.platform, 40);
  const lastError = optText(b.last_error, 2000);
  if (agentVersion === undefined || platform === undefined || lastError === undefined) {
    return { ok: false, error: "agent_version, platform, last_error harus teks" };
  }
  let tools: Record<string, unknown> | null = null;
  if (b.tools !== undefined && b.tools !== null) {
    if (typeof b.tools !== "object" || Array.isArray(b.tools)) return { ok: false, error: "tools harus object" };
    if (JSON.stringify(b.tools).length > MAX_TOOLS_BYTES) return { ok: false, error: "tools terlalu besar" };
    tools = b.tools as Record<string, unknown>;
  }
  return { ok: true, value: { deviceKey: deviceKey.toLowerCase(), name, agentVersion, platform, tools, lastError } };
}

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}

/**
 * Oldest Agent allowed to scan footage and render.
 * 0.0.0 accepts every version, including laptops that do not send X-Agent-Version.
 * Raise this only after a release that installs the next one by itself is already on those laptops.
 * Raising it sooner stops 0.1.10 and 0.1.11, and those builds do not install a newer release on their own.
 */
export const AGENT_MIN_VERSION = "0.0.0";

export function versionParts(version: string | null | undefined): [number, number, number] | null {
  if (typeof version !== "string") return null;
  const match = /^v?(\d+)\.(\d+)\.(\d+)/i.exec(version.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** True when the laptop is older than the floor. A floor of 0.0.0 never rejects. A missing version is old only once a real floor is set. */
export function versionOlderThan(version: string | null | undefined, minVersion: string): boolean {
  const floor = versionParts(minVersion);
  if (!floor || (floor[0] === 0 && floor[1] === 0 && floor[2] === 0)) return false;
  const current = versionParts(version);
  if (!current) return true;
  for (let i = 0; i < 3; i++) {
    if (current[i] !== floor[i]) return current[i]! < floor[i]!;
  }
  return false;
}

/** Postgres RAISE codes → HTTP status + code the Agent understands. */
export function mapRpcError(message: string): { status: number; code: string } {
  for (const [needle, status] of [
    ["token_inactive", 401],
    ["file_key_taken", 409],
    ["already_tagged", 409],
    ["not_found", 404],
    ["invalid_input", 400],
  ] as const) {
    if (message.includes(needle)) return { status, code: needle };
  }
  return { status: 500, code: "internal_error" };
}

export function parseFileKeys(body: unknown): string[] | null {
  if (!body || typeof body !== "object") return null;
  const keys = (body as Record<string, unknown>).file_keys;
  if (!Array.isArray(keys) || keys.length > 500) return null;
  if (!keys.every((k) => typeof k === "string" && k.length > 0 && k.length <= 2000)) return null;
  return keys as string[];
}

export type StripDoneItem = { scene_id: string; fps: number; frames: number; cols: number; labels: boolean };
export type StripFailedItem = { scene_id: string; reason: string };

/** POST /v1/footage/strip-done body: strips uploaded (with their layout) and scenes the Agent could not make. */
export function parseStripDone(body: unknown): { assetId: string; done: StripDoneItem[]; failed: StripFailedItem[] } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!isUuid(b.asset_id)) return null;
  const done = b.done ?? [];
  const failed = b.failed ?? [];
  if (!Array.isArray(done) || !Array.isArray(failed) || done.length + failed.length > 200) return null;
  const okNum = (v: unknown, lo: number, hi: number) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
  const outDone: StripDoneItem[] = [];
  for (const d of done) {
    if (!d || typeof d !== "object") return null;
    const x = d as Record<string, unknown>;
    if (!isUuid(x.scene_id) || !okNum(x.fps, 0.01, 10) || !okNum(x.frames, 1, 60) || !okNum(x.cols, 1, 12)) return null;
    if (!Number.isInteger(x.frames) || !Number.isInteger(x.cols)) return null;
    outDone.push({ scene_id: x.scene_id, fps: x.fps as number, frames: x.frames as number, cols: x.cols as number, labels: x.labels === true });
  }
  const outFailed: StripFailedItem[] = [];
  for (const f of failed) {
    if (!f || typeof f !== "object") return null;
    const x = f as Record<string, unknown>;
    if (!isUuid(x.scene_id)) return null;
    outFailed.push({ scene_id: x.scene_id, reason: typeof x.reason === "string" ? x.reason.slice(0, 300) : "" });
  }
  return { assetId: b.asset_id, done: outDone, failed: outFailed };
}

export function parseMediaDone(body: unknown): { assetId: string; preview: boolean; sceneIds: string[] } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!isUuid(b.asset_id)) return null;
  const sceneIds = b.scene_ids ?? [];
  if (!Array.isArray(sceneIds) || sceneIds.length > 200 || !sceneIds.every(isUuid)) return null;
  if (b.preview !== undefined && typeof b.preview !== "boolean") return null;
  return { assetId: b.asset_id, preview: b.preview === true, sceneIds: sceneIds as string[] };
}
