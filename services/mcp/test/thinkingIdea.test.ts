import { describe, expect, it } from "vitest";
import { addThinkingIdea } from "../src/db/thinkingIdea";
import { confirmedFingerprint } from "../../../src/thinking-lab/master-thought/semantic";
import {
  angleFingerprint,
  bigThoughtFingerprint,
  territoryFingerprint,
} from "../../../src/thinking-lab/shared/fingerprint";

const config = { supabaseUrl: "https://x", supabaseServiceRoleKey: "k", scheduledPostsInternalSecret: "s" };
const ctx = { userId: "u", organizationId: "o" };
const master = "Sate kambing muda Sate Sultan PIK sama juicy-nya dengan steak wagyu MB7–MB9.";
const bt = "lemak kambing muda masih terselip di dalam serat dagingnya";
const territory = "Marbling steak wagyu";
const angle = "Yang jarang disadari tentang marbling steak wagyu adalah juicy-nya datang dari lemak di dalam serat, bukan dari harganya.";
const btFp = bigThoughtFingerprint({ statement: bt, masterThoughtFingerprint: confirmedFingerprint(master, master) });
const trFp = territoryFingerprint({ statement: territory, bigThoughtFingerprint: btFp });
const anFp = angleFingerprint({ statement: angle, territoryFingerprint: trFp });
const angleId = "77777777-7777-4777-8777-777777777777";

function context(angleStatus = "locked", ideas: unknown[] = []) {
  return {
    master: { statement: master, root_belief: master, audience: "Pecinta steak di PIK", prior_belief: "Sate kambing alot.", subject: master },
    big_thought: { id: "bt", statement: bt, status: "locked", semantic_fingerprint: btFp },
    territory: { id: "tr", statement: territory, status: "locked", semantic_fingerprint: trFp, big_thought_id: "bt" },
    angle: { id: angleId, code: "AN03", statement: angle, status: angleStatus, semantic_fingerprint: anFp, territory_id: "tr", idea_set: null },
    ideas,
  };
}

function fakeAdmin(data: unknown, calls: Array<{ fn: string; args: Record<string, unknown> }>) {
  return {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === "mcp_thinking_idea_context") return { data, error: null };
      return { data: "88888888-8888-4888-8888-888888888888", error: null };
    },
  } as never;
}

const statement = "Kita ajak lima pelanggan steak menekan sate kambing muda dan wagyu MB7 di satu kertas putih sehingga jejak cairannya bisa dibandingkan langsung.";
const keys = [{ otherExplanation: "Ukuran potongan berbeda.", close: "Kedua potongan ditimbang sama berat di depan kamera." }];

describe("thinking.idea.add", () => {
  it("refuses an Angle that is not locked", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const result = await addThinkingIdea(fakeAdmin(context("candidate"), calls), config, ctx, { angleId, statement, subject: "", keys }, { ask: async () => null });
    expect(result).toEqual({ saved: false, failed: [{ check: "angle", reason: "Lock the Angles first (thinking.angle.lock)." }] });
  });

  it("refuses an Idea that repeats one saved under the same Master Thought", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const other = { id: "i1", code: "ID01", statement, angle_id: "another-angle", admission: "GENERATE_VALID", status: "candidate", sort_order: 1, validation: null };
    const result = await addThinkingIdea(fakeAdmin(context("locked", [other]), calls), config, ctx, { angleId, statement, subject: "", keys }, { ask: async () => null });
    expect(result.saved).toBe(false);
    if (!result.saved) expect(result.failed[0].check).toBe("duplicate");
  });

  it("does not save when K1-K7 do not pass", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const result = await addThinkingIdea(fakeAdmin(context(), calls), config, ctx, { angleId, statement, subject: "", keys }, {
      ask: async () => JSON.stringify({ pass: false, reason: "Nilainya tidak jelas untuk audiens." }),
    });
    expect(result.saved).toBe(false);
    expect(calls.some((call) => call.fn === "mcp_add_thinking_idea")).toBe(false);
  });
});
