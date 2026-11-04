export type McpRpcParse =
  | { ok: true; result: unknown }
  | { ok: false; message: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function messageFromRpc(item: Record<string, unknown>): string {
  const error = asRecord(item.error);
  const message = error?.message;
  if (typeof message === "string" && message.trim()) return message.trim().slice(0, 180);
  return "mcp_error";
}

/** Read one JSON-RPC result from a JSON body or an SSE stream. */
export function parseMcpRpcBody(raw: string, expectedId: number): McpRpcParse {
  const text = raw.trim();
  if (!text) return { ok: false, message: "empty_mcp_response" };

  const candidates: unknown[] = [];
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) candidates.push(...parsed);
      else candidates.push(parsed);
    } catch {
      return { ok: false, message: "invalid_mcp_json" };
    }
  } else {
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.toLowerCase().startsWith("data:")) continue;
      const payload = trimmed.slice(trimmed.indexOf(":") + 1).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        candidates.push(JSON.parse(payload));
      } catch {
        return { ok: false, message: "invalid_mcp_sse" };
      }
    }
  }

  const expected = String(expectedId);
  const match = candidates
    .map(asRecord)
    .find((item) => item != null && String(item.id) === expected);
  if (!match) return { ok: false, message: "mcp_response_missing" };
  if (match.error) return { ok: false, message: messageFromRpc(match) };
  return { ok: true, result: match.result ?? null };
}

function textFromContent(content: unknown): string {
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const item of content) {
    const text = asRecord(item)?.text;
    if (typeof text === "string" && text.trim()) parts.push(text.trim());
  }
  return parts.join("\n");
}

/** Canva wraps the job JSON inside an MCP content part. */
export function readCanvaToolJson(result: unknown): Record<string, unknown> {
  const root = asRecord(result);
  if (!root) return {};
  if (root.isError === true) {
    const message = textFromContent(root.content).slice(0, 180) || "canva_tool_failed";
    return { status: "failed", failure: { message } };
  }
  const structured = asRecord(root.structuredContent);
  if (structured && (
    structured.job_id || structured.jobId || structured.status || structured.design
    || structured.transaction_id || structured.pages || structured.result || structured.asset
  )) return structured;
  const text = textFromContent(root.content);
  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      const record = asRecord(parsed);
      if (record) return record;
    } catch {
      return { status: "failed", failure: { message: "invalid_canva_job" } };
    }
  }
  return root;
}

export function toolNamesFromListResult(result: unknown): string[] {
  const record = asRecord(result);
  const tools = record?.tools;
  if (!Array.isArray(tools)) return [];
  const names: string[] = [];
  for (const tool of tools) {
    const name = asRecord(tool)?.name;
    if (typeof name === "string" && name.trim()) names.push(name.trim());
  }
  return names;
}
