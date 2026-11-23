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
  | { ok: true; value: HeartbeatInput }
  | { ok: false; error: string } {
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
