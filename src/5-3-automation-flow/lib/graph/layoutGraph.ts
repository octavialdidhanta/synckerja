import type { AutomationFlowGraphNode } from "@/5-3-automation-flow/types/automationFlowGraph.types";

const NODE_VERTICAL_GAP = 140;
const NODE_HORIZONTAL_GAP = 280;

export function layoutAutomationFlowGraphVertically(
  nodes: AutomationFlowGraphNode[],
): AutomationFlowGraphNode[] {
  return nodes.map((node, index) => ({
    ...node,
    position: {
      x: node.type === "condition" ? NODE_HORIZONTAL_GAP / 2 : 0,
      y: index * NODE_VERTICAL_GAP,
    },
  }));
}
