import { parseMcpRpcBody, toolNamesFromListResult } from "./canvaMcpParse.ts";

export const CANVA_MCP_URL = "https://api.canva.com/connect/v1/mcp";
const MCP_PROTOCOL = "2025-06-18";

/**
 * Tools the AI employee may call later. Names coming from a brief or model
 * output are rejected unless they are in this set.
 */
export const CANVA_MCP_ALLOWED_TOOLS = new Set([
  "create-design",
  "get-create-design-async-job",
  "generate-design",
  "create-design-from-candidate",
  "get-design",
  "get-design-pages",
  "get-design-content",
  "export-design",
  "get-export-formats",
  "search-designs",
  "start-editing-transaction",
  "perform-editing-operations",
  "commit-editing-transaction",
  "cancel-editing-transaction",
  "read-design",
  "edit-design",
  "generate-image",
  "get-generate-image-job",
  "upload-asset-from-url",
]);

type RpcBody = Record<string, unknown>;

async function postMcp(
  accessToken: string,
  body: RpcBody,
  sessionId: string | null,
): Promise<{ response: Response; text: string }> {
  const headers = new Headers({
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": MCP_PROTOCOL,
  });
  if (sessionId) headers.set("Mcp-Session-Id", sessionId);
  const response = await fetch(CANVA_MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { response, text };
}

async function openSession(accessToken: string): Promise<string | null> {
  const init = await postMcp(accessToken, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: MCP_PROTOCOL,
      capabilities: {},
      clientInfo: { name: "synckerja", version: "1.0.0" },
    },
  }, null);
  if (init.response.status === 401) throw new Error("canva_unauthorized");
  if (!init.response.ok) {
    throw new Error(`canva_mcp_http_${init.response.status}`);
  }
  const parsed = parseMcpRpcBody(init.text, 1);
  if (!parsed.ok) throw new Error(parsed.message);
  const sessionId = init.response.headers.get("mcp-session-id");

  await postMcp(accessToken, {
    jsonrpc: "2.0",
    method: "notifications/initialized",
  }, sessionId);
  return sessionId;
}

export async function listCanvaMcpTools(accessToken: string): Promise<string[]> {
  const sessionId = await openSession(accessToken);
  const names: string[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 5; page++) {
    const listed = await postMcp(accessToken, {
      jsonrpc: "2.0",
      id: 2 + page,
      method: "tools/list",
      params: cursor ? { cursor } : {},
    }, sessionId);
    if (listed.response.status === 401) throw new Error("canva_unauthorized");
    if (!listed.response.ok) throw new Error(`canva_mcp_http_${listed.response.status}`);
    const parsed = parseMcpRpcBody(listed.text, 2 + page);
    if (!parsed.ok) throw new Error(parsed.message);
    names.push(...toolNamesFromListResult(parsed.result));
    const next = parsed.result && typeof parsed.result === "object"
      ? (parsed.result as { nextCursor?: unknown }).nextCursor
      : null;
    if (typeof next !== "string" || !next.trim()) break;
    cursor = next;
  }
  return [...new Set(names)];
}

export async function callCanvaTool(
  accessToken: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  if (!CANVA_MCP_ALLOWED_TOOLS.has(toolName)) {
    throw new Error("canva_tool_not_allowed");
  }
  const sessionId = await openSession(accessToken);
  const called = await postMcp(accessToken, {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: toolName, arguments: args },
  }, sessionId);
  if (called.response.status === 401) throw new Error("canva_unauthorized");
  if (!called.response.ok) throw new Error(`canva_mcp_http_${called.response.status}`);
  const parsed = parseMcpRpcBody(called.text, 2);
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.result;
}

export type CanvaEditingMode = "legacy" | "current";

/**
 * Which editing tools this Canva MCP offers. The Connect MCP used here has had
 * start/perform/commit/cancel-editing-transaction; newer Canva MCPs open with
 * read-design (open_transaction) and edit with edit-design. Prefer the legacy set
 * whenever it is listed, since it is the one known to work for this app.
 */
export function canvaEditingMode(tools: string[]): CanvaEditingMode {
  const names = new Set(tools.map((name) => name.toLowerCase()));
  if (names.has("start-editing-transaction") && names.has("perform-editing-operations")) return "legacy";
  if (names.has("read-design") && names.has("edit-design")) return "current";
  return "legacy";
}
