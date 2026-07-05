import type {
  AutomationFlowGraph,
  AutomationFlowGraphNode,
  AutomationFlowStartData,
} from "@/5-3-automation-flow/types/automationFlowGraph.types";
import { layoutAutomationFlowGraphVertically } from "@/5-3-automation-flow/lib/graph/layoutGraph";

const START_ID = "start-1";
const END_ID = "end-1";

export function createDefaultAutomationFlowGraph(): AutomationFlowGraph {
  const nodes = layoutAutomationFlowGraphVertically([
    {
      id: START_ID,
      type: "start",
      position: { x: 0, y: 0 },
      data: {
        triggerType: "incoming_message_received",
        phoneNumberIds: [],
        enrollmentFilters: [],
      } satisfies AutomationFlowStartData,
    },
    {
      id: END_ID,
      type: "end",
      position: { x: 0, y: 200 },
      data: {},
    },
  ]);

  return {
    nodes,
    edges: [{ id: "e-start-end", source: START_ID, target: END_ID }],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

export { START_ID as DEFAULT_START_NODE_ID, END_ID as DEFAULT_END_NODE_ID };
