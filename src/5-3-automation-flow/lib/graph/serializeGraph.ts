import type { AutomationFlowGraph, AutomationFlowGraphNode } from "@/5-3-automation-flow/types/automationFlowGraph.types";
import { normalizeSendMessageData } from "@/5-3-automation-flow/lib/graph/sendMessageData";

export function serializeAutomationFlowGraph(graph: AutomationFlowGraph): AutomationFlowGraph {
  return {
    nodes: (graph.nodes ?? []).map((node) => {
      const data = { ...node.data } as Record<string, unknown>;
      if (node.type === "action_send_message") {
        return {
          id: node.id,
          type: node.type,
          position: { x: node.position.x, y: node.position.y },
          data: normalizeSendMessageData(data),
        };
      }
      return {
        id: node.id,
        type: node.type,
        position: { x: node.position.x, y: node.position.y },
        data: node.data,
      };
    }),
    edges: (graph.edges ?? []).map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
    })),
    viewport: {
      x: graph.viewport?.x ?? 0,
      y: graph.viewport?.y ?? 0,
      zoom: graph.viewport?.zoom ?? 1,
    },
  };
}

export function parseAutomationFlowGraph(raw: unknown): AutomationFlowGraph {
  if (!raw || typeof raw !== "object") {
    return { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };
  }
  const obj = raw as AutomationFlowGraph;
  return serializeAutomationFlowGraph(obj);
}
