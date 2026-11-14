import { describe, expect, it } from "vitest";
import { buildIdeaGeneratePrompt } from "@/thinking-lab/idea/generate";
import { buildIdeaCheckPrompt } from "@/thinking-lab/idea/check/run";
import { buildTerritoryGeneratePrompt } from "@/thinking-lab/territory/generate";

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
    expect(generate).toContain("would still be coherent after that stake is removed");
    expect(generate).toContain("Master Thought: The giver may redirect when trust fails.");
    expect(generate).not.toContain("Do not judge it by whether it materially supports the parent.");
  });

  it("asks an Idea to keep the Angle and the ancestors above it", () => {
    const prompt = buildIdeaCheckPrompt("stakeHolds", {
      statement: "Kita ajak orang memberi tanpa nama sehingga rasa percaya terlihat.",
      angle: "Sincere giving has a pure motive.",
      territory: "What still counts as trusted giving.",
      bigThought: "Trust is the stake.",
      masterThought: "The giver may redirect when trust fails.",
      failures: [],
      peers: [],
      historyAvailable: true,
      ask: async () => null,
    });
    expect(prompt).toContain("Angle: Sincere giving has a pure motive.");
    expect(prompt).toContain("Territory: What still counts as trusted giving.");
    expect(prompt).toContain("Big Thought: Trust is the stake.");
    expect(prompt).toContain("Master Thought: The giver may redirect when trust fails.");
    expect(prompt).toContain("taruhan khas Angle");
    expect(buildIdeaGeneratePrompt({
      parentStatement: "Sincere giving has a pure motive.",
      ancestors,
      incumbents: [],
      failures: [],
    })).toContain("Master Thought: The giver may redirect when trust fails.");
  });
});
