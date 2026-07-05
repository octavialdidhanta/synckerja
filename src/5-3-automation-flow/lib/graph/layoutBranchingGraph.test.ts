import { describe, expect, it } from "vitest";
import { buildGraphForTemplate } from "@/5-3-automation-flow/lib/graph/flowTemplateGraphs";
import { insertNodeBetween } from "@/5-3-automation-flow/lib/graph/insertNodeBetween";
import {
  layoutAutomationFlowGraph,
} from "@/5-3-automation-flow/lib/graph/layoutBranchingGraph";

function nodeY(graph: ReturnType<typeof layoutAutomationFlowGraph>, nodeId: string): number {
  const node = graph.nodes.find((n) => n.id === nodeId);
  expect(node).toBeDefined();
  return node!.position.y;
}

describe("layoutAutomationFlowGraph", () => {
  it("lays out welcome template in topological order with End at the bottom", () => {
    const graph = layoutAutomationFlowGraph(buildGraphForTemplate("welcome_message"));

    const startY = nodeY(graph, "start-1");
    const sendY = nodeY(graph, "send-1");
    const endY = nodeY(graph, "end-1");

    expect(startY).toBe(0);
    expect(sendY).toBeGreaterThan(startY);
    expect(endY).toBeGreaterThan(sendY);
  });

  it("keeps End below newly inserted node when inserting before End", () => {
    const base = layoutAutomationFlowGraph(buildGraphForTemplate("welcome_message"));
    const { graph } = insertNodeBetween(base, "send-1", "end-1", "action_send_message");

    const welcomeY = nodeY(graph, "send-1");
    const endY = nodeY(graph, "end-1");
    const newSend = graph.nodes.find(
      (n) => n.type === "action_send_message" && n.id !== "send-1",
    );
    expect(newSend).toBeDefined();

    const newSendY = newSend!.position.y;

    expect(newSendY).toBeGreaterThan(welcomeY);
    expect(endY).toBeGreaterThan(newSendY);
  });

  it("rejects insert when source is End", () => {
    const base = layoutAutomationFlowGraph(buildGraphForTemplate("welcome_message"));
    expect(() => insertNodeBetween(base, "end-1", "send-1", "time_delay")).toThrow(
      /Cannot insert a step after an End node/,
    );
  });
});
