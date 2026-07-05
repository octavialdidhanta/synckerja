import { describe, expect, it } from "vitest";
import { buildGraphForTemplate } from "@/5-3-automation-flow/lib/graph/flowTemplateGraphs";
import { insertNodeBetween } from "@/5-3-automation-flow/lib/graph/insertNodeBetween";
import {
  layoutAutomationFlowGraph,
} from "@/5-3-automation-flow/lib/graph/layoutBranchingGraph";
import {
  copyBlock,
  copyBlockAndBelow,
  deleteBlock,
  deleteBlocksBelow,
  getLinearChainFromStart,
  hasStepsBelow,
} from "@/5-3-automation-flow/lib/graph/graphBlockMutations";

function welcomeGraph() {
  return layoutAutomationFlowGraph(buildGraphForTemplate("welcome_message"));
}

function welcomeWithDelay() {
  const base = welcomeGraph();
  return insertNodeBetween(base, "send-1", "end-1", "time_delay").graph;
}

function nodeY(graph: ReturnType<typeof layoutAutomationFlowGraph>, nodeId: string): number {
  const node = graph.nodes.find((n) => n.id === nodeId);
  expect(node).toBeDefined();
  return node!.position.y;
}

describe("graphBlockMutations", () => {
  it("copyBlock duplicates send node after original with End at bottom", () => {
    const base = welcomeGraph();
    const { graph, newNodeId } = copyBlock(base, "send-1");

    expect(graph.nodes).toHaveLength(4);
    expect(graph.nodes.filter((n) => n.type === "action_send_message")).toHaveLength(2);
    expect(newNodeId).not.toBe("send-1");

    const chain = getLinearChainFromStart(graph);
    expect(chain.map((n) => n.type)).toEqual(["start", "action_send_message", "action_send_message", "end"]);

    const endY = nodeY(graph, "end-1");
    const newSendY = nodeY(graph, newNodeId);
    expect(endY).toBeGreaterThan(newSendY);
  });

  it("copyBlockAndBelow duplicates chain after node with single End", () => {
    const base = welcomeWithDelay();
    const { graph, newRootNodeId } = copyBlockAndBelow(base, "send-1");

    expect(graph.nodes.filter((n) => n.type === "end")).toHaveLength(1);
    expect(graph.nodes.filter((n) => n.type === "action_send_message")).toHaveLength(2);
    expect(graph.nodes.filter((n) => n.type === "time_delay")).toHaveLength(2);

    const chain = getLinearChainFromStart(graph);
    expect(chain.map((n) => n.type)).toEqual([
      "start",
      "action_send_message",
      "action_send_message",
      "time_delay",
      "time_delay",
      "end",
    ]);

    const endY = nodeY(graph, "end-1");
    expect(endY).toBeGreaterThan(nodeY(graph, newRootNodeId));
  });

  it("deleteBlock removes send and connects Start to End", () => {
    const base = welcomeGraph();
    const { graph } = deleteBlock(base, "send-1");

    expect(graph.nodes).toHaveLength(2);
    expect(getLinearChainFromStart(graph).map((n) => n.type)).toEqual(["start", "end"]);
  });

  it("deleteBlocksBelow removes intermediate nodes but keeps End", () => {
    const base = welcomeWithDelay();
    const delayId = base.nodes.find((n) => n.type === "time_delay")!.id;

    const { graph, removedNodeIds } = deleteBlocksBelow(base, "send-1");

    expect(removedNodeIds).toEqual([delayId]);
    expect(graph.nodes.find((n) => n.id === delayId)).toBeUndefined();
    expect(getLinearChainFromStart(graph).map((n) => n.type)).toEqual(["start", "action_send_message", "end"]);
  });

  it("hasStepsBelow is false when only End is below", () => {
    const base = welcomeGraph();
    expect(hasStepsBelow(base, "send-1")).toBe(false);
  });

  it("hasStepsBelow is true when action nodes are below", () => {
    const base = welcomeWithDelay();
    expect(hasStepsBelow(base, "send-1")).toBe(true);
  });

  it("deleteBlocksBelow throws when nothing to remove", () => {
    const base = welcomeGraph();
    expect(() => deleteBlocksBelow(base, "send-1")).toThrow(/No steps below/);
  });

  it("rejects copy and delete on Start", () => {
    const base = welcomeGraph();
    expect(() => copyBlock(base, "start-1")).toThrow(/Start or End/);
    expect(() => deleteBlock(base, "start-1")).toThrow(/Start or End/);
  });
});
