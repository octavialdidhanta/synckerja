import { normalizeMetaFlowJsonDocument } from "./normalizeMetaFlowJsonDocument";

export type FlowJsonSyntaxResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; message: string };

export function validateFlowJsonSyntax(raw: string): FlowJsonSyntaxResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, message: "Flow JSON is empty" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid JSON";
    return { ok: false, message: msg };
  }
  const obj = normalizeMetaFlowJsonDocument(parsed);
  if (obj == null) {
    return { ok: false, message: "Flow JSON must be an object" };
  }
  if (obj.version == null || String(obj.version).trim() === "") {
    return { ok: false, message: 'Missing "version" property' };
  }
  if (!Array.isArray(obj.screens) || obj.screens.length === 0) {
    return { ok: false, message: 'Missing or empty "screens" array' };
  }
  return { ok: true, value: obj };
}

export function formatFlowJsonString(value: Record<string, unknown>): string {
  return JSON.stringify(value, null, 2);
}
