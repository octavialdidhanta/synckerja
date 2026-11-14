import { describe, expect, it } from "vitest";
import { readThinkingDefinitions } from "../src/db/thinkingDefinitions";

const ctx = { userId: "u", organizationId: "o" };

describe("thinking.definitions.read", () => {
  it("returns every level with its check rules and the organization's switches", async () => {
    const admin = {
      rpc: async (fn: string) => {
        if (fn === "mcp_thinking_check_settings") return { data: { "idea.K3": true }, error: null };
        return { data: null, error: null };
      },
    } as never;
    const result = await readThinkingDefinitions(admin, ctx, { language: "id" });
    expect(result.levels.map((level) => level.level)).toEqual(["master", "bigThought", "territory", "angle", "idea", "pillar", "execution"]);
    const idea = result.levels.find((level) => level.level === "idea")!;
    expect(idea.checks.map((check) => check.id)).toEqual(["proposal", "mechanism", "result", "stakeHolds", "causeLock", "watchable", "distinct"]);
    // A switch saved before the seven Idea checks turns on the check that replaced it.
    expect(idea.checks.find((check) => check.id === "result")?.on).toBe(true);
    expect(idea.checks.find((check) => check.id === "distinct")?.on).toBe(false);
    for (const level of result.levels.slice(0, 5)) {
      expect(level.definition.length).toBeGreaterThan(20);
      for (const check of level.checks) expect(check.rule.length).toBeGreaterThan(10);
    }
  });
});

describe("definition rules", () => {
  it("leave out lines about a missing input", async () => {
    const admin = { rpc: async () => ({ data: {}, error: null }) } as never;
    const result = await readThinkingDefinitions(admin, { userId: "u", organizationId: "o" }, { language: "id" });
    const rules = result.levels.flatMap((level) => level.checks.map((check) => check.rule));
    expect(rules.some((rule) => rule.includes("was supplied") || rule.includes("was named, so"))).toBe(false);
  });
});
