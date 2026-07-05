import { describe, expect, it } from "vitest";
import { buildGraphForTemplate } from "@/5-3-automation-flow/lib/graph/flowTemplateGraphs";
import { computeActionNumbers } from "@/5-3-automation-flow/lib/graph/computeActionNumbers";
import { insertNodeBetween } from "@/5-3-automation-flow/lib/graph/insertNodeBetween";
import { layoutAutomationFlowGraph } from "@/5-3-automation-flow/lib/graph/layoutBranchingGraph";
import { applySendMessagePatch } from "@/5-3-automation-flow/lib/graph/syncListBranchEdges";

describe("computeActionNumbers", () => {
  it("numbers send message as Action 1 in welcome template", () => {
    const graph = layoutAutomationFlowGraph(buildGraphForTemplate("welcome_message"));
    const numbers = computeActionNumbers(graph);

    expect(numbers.get("send-1")).toBe(1);
    expect(numbers.has("start-1")).toBe(false);
    expect(numbers.has("end-1")).toBe(false);
  });

  it("increments for nodes inserted before send message", () => {
    const base = layoutAutomationFlowGraph(buildGraphForTemplate("welcome_message"));
    const { graph } = insertNodeBetween(base, "start-1", "send-1", "time_delay");
    const delayId = graph.nodes.find((n) => n.type === "time_delay")!.id;
    const numbers = computeActionNumbers(graph);

    expect(numbers.get(delayId)).toBe(1);
    expect(numbers.get("send-1")).toBe(2);
  });

  it("does not number branch terminal End stubs", () => {
    const base = layoutAutomationFlowGraph(buildGraphForTemplate("welcome_message"));
    const graph = layoutAutomationFlowGraph(
      applySendMessagePatch(base, "send-1", {
        buttonType: "list_message",
        listOptions: [{ id: "opt-a", title: "A" }],
      }),
    );
    const numbers = computeActionNumbers(graph);
    const stubIds = graph.nodes.filter((n) => n.id.startsWith("end-branch-")).map((n) => n.id);

    expect(numbers.get("send-1")).toBe(1);
    for (const stubId of stubIds) {
      expect(numbers.has(stubId)).toBe(false);
    }
  });
});
