import { describe, expect, it } from "vitest";
import {
  getJumpTargetCandidates,
  mergeEndNodePatch,
  normalizeEndNodeData,
  validateEndNodeRules,
} from "@/5-3-automation-flow/lib/graph/endNodeData";
import { buildGraphForTemplate } from "@/5-3-automation-flow/lib/graph/flowTemplateGraphs";
import { validateAutomationFlowGraph } from "@/5-3-automation-flow/lib/graph/validateGraph";
import type { AutomationFlowGraph } from "@/5-3-automation-flow/types/automationFlowGraph.types";

describe("endNodeData", () => {
  it("defaults to flow_end mode", () => {
    expect(normalizeEndNodeData({})).toEqual({
      mode: "flow_end",
      jumpToNodeId: null,
    });
  });

  it("clears jump target when switching back to flow_end", () => {
    expect(
      mergeEndNodePatch(
        { mode: "jump_to", jumpToNodeId: "send-1" },
        { mode: "flow_end" },
      ),
    ).toEqual({
      mode: "flow_end",
      jumpToNodeId: null,
    });
  });

  it("preserves branch stub metadata", () => {
    expect(
      normalizeEndNodeData({
        isBranchTerminal: true,
        branchParentSendId: "send-1",
        branchHandle: "option:a",
        mode: "jump_to",
        jumpToNodeId: "send-1",
      }),
    ).toMatchObject({
      isBranchTerminal: true,
      branchParentSendId: "send-1",
      branchHandle: "option:a",
      mode: "jump_to",
      jumpToNodeId: "send-1",
    });
  });

  it("lists numbered action nodes as jump targets", () => {
    const graph = buildGraphForTemplate("welcome_message");
    const candidates = getJumpTargetCandidates(graph);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]?.nodeId).toBe("send-1");
    expect(candidates[0]?.actionNumber).toBe(1);
  });

  it("flags jump_to without target", () => {
    const graph = buildGraphForTemplate("welcome_message");
    const endNode = graph.nodes.find((n) => n.id === "end-1")!;
    const issues = validateEndNodeRules(
      {
        ...endNode,
        data: { mode: "jump_to", jumpToNodeId: null },
      },
      graph,
    );
    expect(issues.some((i) => i.code === "END_JUMP_TARGET_MISSING")).toBe(true);
  });

  it("accepts valid jump target", () => {
    const graph = buildGraphForTemplate("welcome_message");
    const endNode = graph.nodes.find((n) => n.id === "end-1")!;
    const issues = validateEndNodeRules(
      {
        ...endNode,
        data: { mode: "jump_to", jumpToNodeId: "send-1" },
      },
      graph,
    );
    expect(issues).toHaveLength(0);
  });
});

describe("validateAutomationFlowGraph end jump rules", () => {
  it("surfaces END_JUMP_TARGET_MISSING on publish validation", () => {
    const graph = buildGraphForTemplate("welcome_message") as AutomationFlowGraph;
    graph.nodes = graph.nodes.map((n) =>
      n.id === "end-1"
        ? { ...n, data: { mode: "jump_to", jumpToNodeId: null } }
        : n,
    );
    const issues = validateAutomationFlowGraph(graph);
    expect(issues.some((i) => i.code === "END_JUMP_TARGET_MISSING")).toBe(true);
  });
});
