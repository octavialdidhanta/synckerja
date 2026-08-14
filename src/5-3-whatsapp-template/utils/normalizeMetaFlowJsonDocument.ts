import { ensureSupportedFlowJsonVersion } from "./flowJsonVersion";

/**
 * Meta Flow JSON assets must be `{ version, screens, ... }` at the top level.
 * Some flows were saved with API payload wrappers or legacy create bugs.
 */
export function normalizeMetaFlowJsonDocument(raw: unknown): Record<string, unknown> | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.flow_json === "string") {
    try {
      return normalizeMetaFlowJsonDocument(JSON.parse(obj.flow_json.trim()));
    } catch {
      return ensureSupportedFlowJsonVersion(obj);
    }
  }

  if (
    obj.flow_json != null &&
    typeof obj.flow_json === "object" &&
    !Array.isArray(obj.flow_json) &&
    (obj.version == null || obj.screens == null)
  ) {
    return normalizeMetaFlowJsonDocument(obj.flow_json);
  }

  if (
    obj.flowJson != null &&
    typeof obj.flowJson === "object" &&
    !Array.isArray(obj.flowJson) &&
    (obj.version == null || obj.screens == null)
  ) {
    return normalizeMetaFlowJsonDocument(obj.flowJson);
  }

  return ensureSupportedFlowJsonVersion(obj);
}
