import { describe, expect, it } from "vitest";
import { buildIdeaGeneratePrompt } from "@/thinking-lab/idea/generate";
import { buildIdeaJudgePrompt } from "@/thinking-lab/idea/semantic";
import { buildTerritoryGeneratePrompt } from "@/thinking-lab/territory/generate";
import { buildTerritoryJudgePrompt } from "@/thinking-lab/territory/semantic";

const ancestors = [
  { label: "Territory", statement: "What still counts as trusted giving." },
  { label: "Big Thought", statement: "Trust is the stake." },
  { label: "Master Thought", statement: "The giver may redirect when trust fails." },
];

describe("ancestor stake prompts", () => {
  it("keeps a general stake rule and the active ancestor chain", () => {
    const generate = buildTerritoryGeneratePrompt({
      parentStatement: "A direct parent.",
      ancestors: [{ label: "Master Thought", statement: "The giver may redirect when trust fails." }],
      incumbents: [],
      needed: 1,
    });
    const judge = buildTerritoryJudgePrompt({
      parentStatement: "A direct parent.",
      ancestors: [{ label: "Master Thought", statement: "The giver may redirect when trust fails." }],
      candidate: { code: "TR01", statement: "A drifted space." },
    });
    expect(generate).toContain("would still be coherent after that stake is removed");
    expect(judge).toContain("after the distinctive stake of the direct Big Thought or an ancestor is removed");
    for (const prompt of [generate, judge]) {
      expect(prompt).toContain("Master Thought: The giver may redirect when trust fails.");
      expect(prompt).not.toContain("Do not judge it by whether it materially supports the parent.");
    }
  });

  it("asks an Idea to keep the Angle and the ancestors above it", () => {
    const prompt = buildIdeaJudgePrompt({
      parentStatement: "Sincere giving has a pure motive.",
      ancestors,
      candidate: { code: "ID01", statement: "An anonymous gift to a stranger." },
    });
    expect(prompt).toContain("Direct Angle:");
    expect(prompt).toContain("Sincere giving has a pure motive.");
    expect(prompt).toContain("Territory: What still counts as trusted giving.");
    expect(prompt).toContain("Big Thought: Trust is the stake.");
    expect(prompt).toContain("Master Thought: The giver may redirect when trust fails.");
    expect(prompt).toContain("after the distinctive stake of this Angle or an ancestor is removed");
    expect(buildIdeaGeneratePrompt({
      parentStatement: "Sincere giving has a pure motive.",
      ancestors,
      incumbents: [],
      needed: 1,
    })).toContain("Master Thought: The giver may redirect when trust fails.");
  });
});
