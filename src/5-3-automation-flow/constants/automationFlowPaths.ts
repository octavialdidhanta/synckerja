export const AUTOMATION_FLOW_EDITOR_BASE = "/omnichannel/flow-builder";

export function automationFlowEditorPath(flowId: string): string {
  return `${AUTOMATION_FLOW_EDITOR_BASE}/${encodeURIComponent(flowId)}/editor`;
}
