import { reorderNodesByTopology } from "@/5-3-automation-flow/lib/graph/layoutBranchingGraph";
import type { AutomationFlowGraph } from "@/5-3-automation-flow/types/automationFlowGraph.types";

function isActionNumberedNode(type: string, data: Record<string, unknown>): boolean {
  if (type === "start" || type === "end") return false;
  if (Boolean(data.isBranchTerminal)) return false;
  return true;
}

export function computeActionNumbers(graph: AutomationFlowGraph): Map<string, number> {
  const numbers = new Map<string, number>();
  let index = 0;

  for (const node of reorderNodesByTopology(graph)) {
    if (!isActionNumberedNode(node.type, node.data as Record<string, unknown>)) continue;
    index += 1;
    numbers.set(node.id, index);
  }

  return numbers;
}
