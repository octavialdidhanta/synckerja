import { describe, expect, it } from "vitest";
import { recommendThinkingPillars, removeThinkingPillar, setThinkingPillar } from "../src/db/thinkingPillar";

const config = { supabaseUrl: "https://x", supabaseServiceRoleKey: "k", scheduledPostsInternalSecret: "s" };
const ctx = { userId: "u", organizationId: "o" };
const ideaId = "11111111-1111-4111-8111-111111111111";
const pillarA = "22222222-2222-4222-8222-222222222222";
const pillarB = "33333333-3333-4333-8333-333333333333";

function chain(paths: unknown[] = []) {
  return [{
    idea_id: ideaId,
    idea_statement: "Kita belah sate kambing muda dan wagyu berdampingan sehingga terlihat cairannya.",
    master_statement: "Sate kambing muda sama juicy-nya dengan wagyu.",
    big_thought_statement: "lemak terselip di serat",
    territory_statement: "Marbling wagyu",
    angle_statement: "Juicy datang dari lemak di serat.",
    development_paths: paths,
    pillars: [
      { id: pillarA, name: "Edukasi", category: "Awareness", description: "" },
      { id: pillarB, name: "Behind the scenes", category: "Consideration", description: "" },
    ],
  }];
}

function fakeAdmin(data: unknown, calls: Array<{ fn: string; args: Record<string, unknown> }>) {
  return {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === "mcp_get_thinking_chain") return { data, error: null };
      return { data: null, error: null };
    },
  } as never;
}

describe("thinking.pillar.set", () => {
  it("saves a locked pillar path with its development", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const result = await setThinkingPillar(fakeAdmin(chain(), calls), ctx, {
      ideaId,
      contentPillarId: pillarA,
      development: "Demo belah sate dijadikan konten edukasi lemak di serat.",
      reason: "Idea ini menjelaskan sebab juicy, cocok untuk edukasi.",
    });
    expect(result.saved).toBe(true);
    expect(result.pillars?.map((card) => [card.content_pillar_id, card.pillar_name])).toEqual([[pillarA, "Edukasi"]]);
    expect(result.pillars?.[0].development).toBe("Demo belah sate dijadikan konten edukasi lemak di serat.");
    const save = calls.find((call) => call.fn === "mcp_set_thinking_idea_paths")!;
    const paths = save.args.p_paths as Array<{ contentPillarId: string; format: null; status: string }>;
    expect(paths).toHaveLength(1);
    expect([paths[0].contentPillarId, paths[0].format, paths[0].status]).toEqual([pillarA, null, "RECOMMENDED"]);
  });

  it("refuses a pillar that is not active", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const result = await setThinkingPillar(fakeAdmin(chain(), calls), ctx, {
      ideaId,
      contentPillarId: "44444444-4444-4444-8444-444444444444",
      development: "x",
      reason: "y",
    });
    expect(result.saved).toBe(false);
    expect(calls.some((call) => call.fn === "mcp_set_thinking_idea_paths")).toBe(false);
  });
});

describe("thinking.pillar.remove", () => {
  it("removes every path of that pillar", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const stored = [
      { contentPillarId: pillarA, pillarName: "Edukasi", format: null, status: "RECOMMENDED", reason: "r", reviews: [], savedAt: "2026-11-01T00:00:00Z" },
      { contentPillarId: pillarB, pillarName: "Behind the scenes", format: null, status: "RECOMMENDED", reason: "r", reviews: [], savedAt: "2026-11-02T00:00:00Z" },
    ];
    const result = await removeThinkingPillar(fakeAdmin(chain(stored), calls), ctx, { ideaId, contentPillarId: pillarA });
    expect(result.saved).toBe(true);
    expect(result.pillars?.map((card) => card.content_pillar_id)).toEqual([pillarB]);
  });
});

describe("thinking.pillars.recommend", () => {
  it("returns the model's recommendations without saving", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const ask = async (prompt: string) => {
      if (prompt.includes("Return JSON only") && prompt.includes("reviews")) {
        return JSON.stringify({
          reviews: [{ contentPillarId: pillarA, pillarName: "Edukasi", status: "RECOMMENDED", reason: "cocok", development: "demo edukasi" }],
        });
      }
      return JSON.stringify({ pass: true, reason: "cocok" });
    };
    const result = await recommendThinkingPillars(fakeAdmin(chain(), calls), config, ctx, { ideaId }, { ask });
    expect(result.chosen).toEqual([]);
    expect(calls.some((call) => call.fn === "mcp_set_thinking_idea_paths")).toBe(false);
  });
});
