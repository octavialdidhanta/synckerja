import { describe, expect, it } from "vitest";
import { branchStubEndId } from "@/5-3-automation-flow/lib/graph/branchTerminalEnd";
import { ensureBranchStubEdges } from "@/5-3-automation-flow/lib/graph/ensureBranchStubEdges";
import { buildGraphForTemplate } from "@/5-3-automation-flow/lib/graph/flowTemplateGraphs";
import { layoutAutomationFlowGraph } from "@/5-3-automation-flow/lib/graph/layoutBranchingGraph";
import { applySendMessagePatch } from "@/5-3-automation-flow/lib/graph/syncListBranchEdges";
import { LIST_BRANCH_OTHER_HANDLE } from "@/5-3-automation-flow/lib/graph/sendMessageData";

function listMessageGraph(options: Array<{ id: string; title: string; description?: string }>) {
  const base = layoutAutomationFlowGraph(buildGraphForTemplate("welcome_message"));
  return layoutAutomationFlowGraph(
    applySendMessagePatch(base, "send-1", {
      buttonType: "list_message",
      buttonAsBranch: true,
      listButtonText: "Pilih Opsi",
      listOptions: options,
    }),
  );
}

describe("ensureBranchStubEdges", () => {
  it("creates End stub and branch edge per list option plus other", () => {
    const graph = listMessageGraph([
      { id: "opt-a", title: "Konsultasi Dokter" },
      { id: "opt-b", title: "Lokasi Vet" },
    ]);

    const branchEdges = graph.edges.filter(
      (e) => e.source === "send-1" && e.sourceHandle?.startsWith("option:"),
    );
    expect(branchEdges).toHaveLength(3);

    const stubA = branchStubEndId("send-1", "option:opt-a");
    const stubB = branchStubEndId("send-1", "option:opt-b");
    const stubOther = branchStubEndId("send-1", LIST_BRANCH_OTHER_HANDLE);

    expect(graph.nodes.some((n) => n.id === stubA)).toBe(true);
    expect(graph.nodes.some((n) => n.id === stubB)).toBe(true);
    expect(graph.nodes.some((n) => n.id === stubOther)).toBe(true);

    expect(branchEdges.some((e) => e.target === stubA && e.sourceHandle === "option:opt-a")).toBe(true);
    expect(branchEdges.some((e) => e.target === stubOther)).toBe(true);
  });

  it("adds stub when a third option is added", () => {
    const two = listMessageGraph([
      { id: "opt-a", title: "A" },
      { id: "opt-b", title: "B" },
    ]);
    const three = layoutAutomationFlowGraph(
      applySendMessagePatch(two, "send-1", {
        listOptions: [
          { id: "opt-a", title: "A" },
          { id: "opt-b", title: "B" },
          { id: "opt-c", title: "C" },
        ],
      }),
    );

    const branchEdges = three.edges.filter(
      (e) => e.source === "send-1" && e.sourceHandle?.startsWith("option:"),
    );
    expect(branchEdges).toHaveLength(4);
    expect(three.nodes.some((n) => n.id === branchStubEndId("send-1", "option:opt-c"))).toBe(true);
  });

  it("removes stub when an option is removed", () => {
    const graph = listMessageGraph([
      { id: "opt-a", title: "A" },
      { id: "opt-b", title: "B" },
    ]);
    const reduced = layoutAutomationFlowGraph(
      applySendMessagePatch(graph, "send-1", {
        listOptions: [{ id: "opt-a", title: "A" }],
      }),
    );

    expect(reduced.nodes.some((n) => n.id === branchStubEndId("send-1", "option:opt-b"))).toBe(false);
    expect(
      reduced.edges.some((e) => e.source === "send-1" && e.sourceHandle === "option:opt-b"),
    ).toBe(false);
  });

  it("cleans stubs and restores linear edge when switching to none", () => {
    const graph = listMessageGraph([{ id: "opt-a", title: "A" }]);
    const cleaned = layoutAutomationFlowGraph(
      applySendMessagePatch(graph, "send-1", {
        buttonType: "none",
        buttonAsBranch: false,
        listOptions: [],
      }),
    );

    expect(cleaned.nodes.filter((n) => n.id.startsWith("end-branch-send-1"))).toHaveLength(0);
    expect(cleaned.edges.some((e) => e.source === "send-1" && e.target === "end-1")).toBe(true);
  });

  it("ensureBranchStubEdges is idempotent", () => {
    const graph = listMessageGraph([{ id: "opt-a", title: "A" }]);
    const again = ensureBranchStubEdges(graph, "send-1");
    expect(again.nodes.length).toBe(graph.nodes.length);
    expect(again.edges.length).toBe(graph.edges.length);
  });
});
