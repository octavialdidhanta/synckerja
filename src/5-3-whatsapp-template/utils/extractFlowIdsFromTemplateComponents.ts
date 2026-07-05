import type { MetaMessageTemplate } from "../types";

/** Extract Meta Flow IDs referenced by FLOW buttons on a message template. */
export function extractFlowIdsFromTemplateComponents(
  components: MetaMessageTemplate["components"],
): string[] {
  if (!Array.isArray(components)) return [];
  const ids: string[] = [];
  for (const c of components) {
    if (String(c?.type ?? "").toUpperCase() !== "BUTTONS") continue;
    const buttons = c.buttons;
    if (!Array.isArray(buttons)) continue;
    for (const btn of buttons) {
      if (String(btn?.type ?? "").toUpperCase() !== "FLOW") continue;
      const flowId = String((btn as { flow_id?: string }).flow_id ?? "").trim();
      if (flowId) ids.push(flowId);
    }
  }
  return [...new Set(ids)];
}

export function templateHasFlowButton(components: MetaMessageTemplate["components"]): boolean {
  return extractFlowIdsFromTemplateComponents(components).length > 0;
}
