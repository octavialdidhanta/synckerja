import { describe, expect, it } from "vitest";
import { addThinkingIdea, lockThinkingIdeas } from "../src/db/thinkingIdea";
import { confirmedFingerprint } from "../../../src/thinking-lab/master-thought/semantic";
import {
  ideaFingerprint,
  angleFingerprint,
  bigThoughtFingerprint,
  territoryFingerprint,
} from "../../../src/thinking-lab/shared/fingerprint";
import { CHECK_REGISTRY } from "../../../src/thinking-lab/shared/checkSettings";

const ALL_ON = Object.fromEntries(
  Object.entries(CHECK_REGISTRY).flatMap(([level, entries]) => entries.map((entry) => [`${level}.${entry.id}`, true])),
);

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
    const result = await addThinkingIdea(fakeAdmin(context("candidate"), calls), config, ctx, { angleId, statement, subject: "", keys }, { checks: ALL_ON, ask: async () => null });
    expect(result).toEqual({ saved: false, failed: [{ check: "angle", reason: "Lock the Angles first (thinking.angle.lock)." }] });
  });

  it("refuses an Idea that repeats one saved under the same Master Thought", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const other = { id: "i1", code: "ID01", statement, angle_id: "another-angle", admission: "GENERATE_VALID", status: "candidate", sort_order: 1, validation: null };
    const result = await addThinkingIdea(fakeAdmin(context("locked", [other]), calls), config, ctx, { angleId, statement, subject: "", keys }, { checks: ALL_ON, ask: async () => null });
    expect(result.saved).toBe(false);
    if (!result.saved) expect(result.failed[0].check).toBe("duplicate");
  });

  it("does not save when an Idea check does not pass", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const result = await addThinkingIdea(fakeAdmin(context(), calls), config, ctx, { angleId, statement, subject: "", keys }, {
      checks: ALL_ON,
      ask: async () => JSON.stringify({ pass: false, reason: "Nilainya tidak jelas untuk audiens." }),
    });
    expect(result.saved).toBe(false);
    expect(calls.some((call) => call.fn === "mcp_add_thinking_idea")).toBe(false);
  });
  it("with every Idea check OFF, saves without asking", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    let asked = 0;
    const result = await addThinkingIdea(fakeAdmin(context(), calls), config, ctx, { angleId, statement, subject: "", keys }, {
      checks: {},
      ask: async () => {
        asked += 1;
        return null;
      },
    });
    expect(result).toMatchObject({ saved: true });
    expect(asked).toBe(0);
  });
});

describe("thinking.idea.lock", () => {
  const row = (validation: unknown) => ({
    id: "99999999-9999-4999-8999-999999999999",
    code: "ID01",
    statement,
    angle_id: angleId,
    admission: "GENERATE_VALID",
    status: "candidate",
    sort_order: 1,
    validation,
  });
  const fp = ideaFingerprint({ statement, angleFingerprint: anFp });
  const set = { schema: "thinking-lab/idea-set/v1", audit: { fingerprint: "", items: [{ code: "ID01", verdict: "AUDIT_PASS", statementFingerprint: fp }] } };

  it("refuses an Idea without a current pass", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const result = await lockThinkingIdeas(fakeAdmin(context("locked", [row({ decision: "LOLOS" })]), calls), ctx, { angleId });
    expect(result.saved).toBe(false);
    expect(calls.some((call) => call.fn === "mcp_lock_thinking_ideas")).toBe(false);
  });

  it("locks passing Ideas with their fingerprint", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const base = context("locked", [row({ decision: "LOLOS" })]);
    const data = { ...base, angle: { ...base.angle, idea_set: set } };
    const result = await lockThinkingIdeas(fakeAdmin(data, calls), ctx, { angleId });
    expect(result.saved).toBe(true);
    const lock = calls.find((call) => call.fn === "mcp_lock_thinking_ideas")!;
    expect((lock.args.p_rows as Array<{ fingerprint: string }>)[0].fingerprint).toBe(fp);
  });
});
