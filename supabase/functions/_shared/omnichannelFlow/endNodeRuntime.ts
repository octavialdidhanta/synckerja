export type AutomationFlowEndMode = "flow_end" | "jump_to";

export type NormalizedEndNodeData = {
  mode: AutomationFlowEndMode;
  jumpToNodeId: string | null;
};

export function normalizeEndNodeData(data: Record<string, unknown> | undefined): NormalizedEndNodeData {
  const mode = (data?.mode as AutomationFlowEndMode | undefined) ?? "flow_end";
  const jumpToNodeId =
    mode === "jump_to" && typeof data?.jumpToNodeId === "string" && data.jumpToNodeId.trim()
      ? data.jumpToNodeId.trim()
      : null;

  return {
    mode,
    jumpToNodeId: mode === "jump_to" ? jumpToNodeId : null,
  };
}
