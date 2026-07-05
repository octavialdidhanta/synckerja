import { describe, expect, it } from "vitest";
import { buildGraphForTemplate } from "@/5-3-automation-flow/lib/graph/flowTemplateGraphs";
import { insertNodeBetween } from "@/5-3-automation-flow/lib/graph/insertNodeBetween";
import { applySendMessagePatch } from "@/5-3-automation-flow/lib/graph/syncListBranchEdges";
import { prepareAutomationFlowGraph } from "@/5-3-automation-flow/lib/graph/prepareAutomationFlowGraph";
import { LIST_BRANCH_OTHER_HANDLE } from "@/5-3-automation-flow/lib/graph/sendMessageData";
import { MIN_BRANCH_CENTER_GAP } from "@/5-3-automation-flow/components/editor/canvas/nodes/canvasNodeDimensions";

describe("prepareAutomationFlowGraph quick reply branches", () => {
  it("creates branch edges for quick reply on a nested send message", () => {
    const base = prepareAutomationFlowGraph(
      applySendMessagePatch(buildGraphForTemplate("welcome_message"), "send-1", {
        buttonType: "list_message",
        listButtonText: "Pilih Opsi",
        listOptions: [{ id: "opt-test", title: "test" }],
      }),
    );

    const stubId = `end-branch-send-1-option:test`;
    const branchSend = base.nodes.find((n) => n.id === stubId);
    expect(branchSend).toBeUndefined();

    const stubTarget = base.edges.find((e) => e.source === "send-1" && e.sourceHandle === "option:opt-test")?.target;
    expect(stubTarget).toBeDefined();

    const { graph: withNested, newNodeId } = insertNodeBetween(base, "send-1", stubTarget!, "action_send_message");

    const nested = prepareAutomationFlowGraph(
      applySendMessagePatch(withNested, newNodeId, {
        body: "terima kasih sudah memilih aku",
        buttonType: "quick_reply",
        listOptions: [
          { id: "qr-1", title: "Konsultasi" },
          { id: "qr-2", title: "Test aja" },
          { id: "qr-3", title: "Kembali ke awal" },
        ],
      }),
    );

    const branchEdges = nested.edges.filter(
      (e) => e.source === newNodeId && e.sourceHandle?.startsWith("option:"),
    );
    expect(branchEdges.length).toBe(4);
    expect(branchEdges.some((e) => e.sourceHandle === "option:qr-1")).toBe(true);
    expect(branchEdges.some((e) => e.sourceHandle === LIST_BRANCH_OTHER_HANDLE)).toBe(true);
    expect(nested.edges.some((e) => e.source === newNodeId && !e.sourceHandle)).toBe(false);
  });

  it("centers nested quick reply branch stubs under the parent send node column", () => {
    const base = prepareAutomationFlowGraph(
      applySendMessagePatch(buildGraphForTemplate("welcome_message"), "send-1", {
        buttonType: "list_message",
        listButtonText: "Pilih Opsi",
        listOptions: [{ id: "opt-test", title: "test" }],
      }),
    );

    const stubTarget = base.edges.find(
      (e) => e.source === "send-1" && e.sourceHandle === "option:opt-test",
    )!.target;
    const { graph: withNested, newNodeId } = insertNodeBetween(
      base,
      "send-1",
      stubTarget,
      "action_send_message",
    );

    const nested = prepareAutomationFlowGraph(
      applySendMessagePatch(withNested, newNodeId, {
        buttonType: "quick_reply",
        listOptions: [
          { id: "qr-1", title: "Konsultasi" },
          { id: "qr-2", title: "Test aja" },
        ],
      }),
    );

    const parent = nested.nodes.find((n) => n.id === newNodeId)!;
    const stubNodes = nested.nodes.filter((n) => n.id.startsWith(`end-branch-${newNodeId}-`));
    expect(stubNodes.length).toBeGreaterThan(1);

    const parentX = parent.position.x;
    const stubXs = stubNodes.map((n) => n.position.x);
    const avgX = stubXs.reduce((sum, x) => sum + x, 0) / stubXs.length;
    expect(Math.abs(avgX - parentX)).toBeLessThan(1);

    for (const x of stubXs) {
      expect(x).toBeGreaterThanOrEqual(parentX - 600);
      expect(x).toBeLessThanOrEqual(parentX + 600);
    }
  });

  it("keeps sibling quick reply subtrees from overlapping horizontally", () => {
    let graph = prepareAutomationFlowGraph(
      applySendMessagePatch(buildGraphForTemplate("welcome_message"), "send-1", {
        buttonType: "list_message",
        listButtonText: "Pilih Opsi",
        listOptions: [
          { id: "opt-a", title: "test" },
          { id: "opt-b", title: "testt" },
        ],
      }),
    );

    const stubA = graph.edges.find((e) => e.source === "send-1" && e.sourceHandle === "option:opt-a")!.target;
    const stubB = graph.edges.find((e) => e.source === "send-1" && e.sourceHandle === "option:opt-b")!.target;

    const left = insertNodeBetween(graph, "send-1", stubA, "action_send_message");
    graph = left.graph;
    const right = insertNodeBetween(graph, "send-1", stubB, "action_send_message");
    graph = right.graph;

    graph = prepareAutomationFlowGraph(
      applySendMessagePatch(graph, left.newNodeId, {
        body: "left",
        buttonType: "quick_reply",
        listOptions: [
          { id: "l1", title: "Konsultasi" },
          { id: "l2", title: "Test aja" },
          { id: "l3", title: "Kembali ke awal" },
        ],
      }),
    );

    graph = prepareAutomationFlowGraph(
      applySendMessagePatch(graph, right.newNodeId, {
        body: "right",
        buttonType: "quick_reply",
        listOptions: [
          { id: "r1", title: "A" },
          { id: "r2", title: "B" },
        ],
      }),
    );

    const leftNode = graph.nodes.find((n) => n.id === left.newNodeId)!;
    const rightNode = graph.nodes.find((n) => n.id === right.newNodeId)!;
    const leftStubs = graph.nodes.filter((n) => n.id.startsWith(`end-branch-${left.newNodeId}-`));
    const rightStubs = graph.nodes.filter((n) => n.id.startsWith(`end-branch-${right.newNodeId}-`));

    expect(leftStubs.length).toBe(4);
    expect(rightStubs.length).toBe(3);

    const minCenterDistance = MIN_BRANCH_CENTER_GAP;
    for (const a of leftStubs) {
      for (const b of rightStubs) {
        expect(Math.abs(a.position.x - b.position.x)).toBeGreaterThanOrEqual(minCenterDistance);
      }
    }

    const leftSpread = Math.max(...leftStubs.map((n) => n.position.x)) - Math.min(...leftStubs.map((n) => n.position.x));
    const leftAvg = leftStubs.reduce((s, n) => s + n.position.x, 0) / leftStubs.length;
    expect(Math.abs(leftAvg - leftNode.position.x)).toBeLessThan(1);
  });
});
