import { layoutAutomationFlowGraph } from "@/5-3-automation-flow/lib/graph/layoutBranchingGraph";
import { syncAllInteractiveBranchEdges } from "@/5-3-automation-flow/lib/graph/syncListBranchEdges";
import type { AutomationFlowGraph } from "@/5-3-automation-flow/types/automationFlowGraph.types";

/** Sync interactive branch edges then layout — use whenever the graph is loaded or mutated. */
export function prepareAutomationFlowGraph(graph: AutomationFlowGraph): AutomationFlowGraph {
  return layoutAutomationFlowGraph(syncAllInteractiveBranchEdges(graph));
}
