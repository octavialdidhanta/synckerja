/** @see https://developers.facebook.com/docs/whatsapp/flows/changelogs/ */
export const WHATSAPP_FLOW_JSON_VERSION = "7.3" as const;

const SUPPORTED_PUBLISH_FLOW_JSON_VERSIONS = new Set<string>([
  "5.1",
  "6.0",
  "6.1",
  "6.2",
  "6.3",
  "7.0",
  "7.1",
  "7.2",
  "7.3",
]);

export function ensureSupportedFlowJsonVersion(doc: Record<string, unknown>): Record<string, unknown> {
  const version = String(doc.version ?? "").trim();
  if (SUPPORTED_PUBLISH_FLOW_JSON_VERSIONS.has(version)) {
    return doc;
  }
  return { ...doc, version: WHATSAPP_FLOW_JSON_VERSION };
}
