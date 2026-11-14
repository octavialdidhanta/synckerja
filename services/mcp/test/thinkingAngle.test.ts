import { describe, expect, it } from "vitest";
import { addThinkingAngle, lockThinkingAngles } from "../src/db/thinkingAngle";
import { confirmedFingerprint } from "../../../src/thinking-lab/master-thought/semantic";
import { angleFingerprint, bigThoughtFingerprint, territoryFingerprint } from "../../../src/thinking-lab/shared/fingerprint";
import { CHECK_REGISTRY } from "../../../src/thinking-lab/shared/checkSettings";

const ALL_ON = Object.fromEntries(
  Object.entries(CHECK_REGISTRY).flatMap(([level, entries]) => entries.map((entry) => [`${level}.${entry.id}`, true])),
);

const config = { supabaseUrl: "https://x", supabaseServiceRoleKey: "k", scheduledPostsInternalSecret: "s" };
const ctx = { userId: "u", organizationId: "o" };
const master = "Sate kambing muda Sate Sultan PIK sama juicy-nya dengan steak wagyu MB7–MB9.";
const bt = "lemak kambing muda masih terselip di dalam serat dagingnya";
const btFp = bigThoughtFingerprint({ statement: bt, masterThoughtFingerprint: confirmedFingerprint(master, master) });
const territory = "Bau prengus kambing";
const trFp = territoryFingerprint({ statement: territory, bigThoughtFingerprint: btFp });
const trId = "55555555-5555-4555-8555-555555555555";

function context(status = "locked", angles: unknown[] = [], angleSet: unknown = null) {
  return {
    master: { statement: master, root_belief: master },
    big_thought: { id: "bt", statement: bt, status: "locked", semantic_fingerprint: btFp },
    territory: { id: trId, code: "TR01", statement: territory, status, semantic_fingerprint: trFp, big_thought_id: "bt", angle_set: angleSet },
    angles,
    master_codes: ["AN01"],
  };
}

function fakeAdmin(data: unknown, calls: Array<{ fn: string; args: Record<string, unknown> }>) {
  return {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === "mcp_thinking_angle_context") return { data, error: null };
      return { data: "66666666-6666-4666-8666-666666666666", error: null };
    },
  } as never;
}

function answer(pass: (id: string) => boolean) {
  return async (prompt: string) => {
    const ids = /check id: ([^.]+)\./.exec(prompt)?.[1].split(",").map((id) => id.trim());
    if (!ids) return JSON.stringify({ pass: true, reason: "" });
    return JSON.stringify({ checks: ids.map((id) => ({ id, pass: pass(id), reason: pass(id) ? "" : `${id} failed` })) });
  };
}

const angle = {
  statement: "Yang jarang disadari tentang bau prengus kambing adalah bau itu datang dari lemak luar kambing tua, bukan dari dagingnya.",
  subject: "lemak luar kambing tua",
  example: "Sate dari kambing kurban yang baunya tetap menyengat walau sudah dibumbui tebal.",
};

describe("thinking.angle.add", () => {
  it("saves a passing Angle as the next AN code with an audit item", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const result = await addThinkingAngle(fakeAdmin(context(), calls), config, ctx, { territoryId: trId, ...angle }, { checks: ALL_ON, ask: answer(() => true) });
    expect(result).toEqual({ saved: true, id: "66666666-6666-4666-8666-666666666666", code: "AN02" });
    const save = calls.find((call) => call.fn === "mcp_add_thinking_angle")!;
    expect(save.args.p_parent_fingerprint).toBe(trFp);
    const set = save.args.p_angle_set as { audit: { items: Array<{ code: string; statementFingerprint: string }> } };
    expect(set.audit.items[0].statementFingerprint).toBe(angleFingerprint({ statement: angle.statement, territoryFingerprint: trFp }));
  });

  it("refuses an unlocked Territory", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const result = await addThinkingAngle(fakeAdmin(context("candidate"), calls), config, ctx, { territoryId: trId, ...angle }, { checks: ALL_ON, ask: answer(() => true) });
    expect(result.saved).toBe(false);
  });

  it("does not save when a check fails", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const result = await addThinkingAngle(fakeAdmin(context(), calls), config, ctx, { territoryId: trId, ...angle }, { checks: ALL_ON, ask: answer((id) => id !== "observation") });
    expect(result.saved).toBe(false);
    if (!result.saved) expect(result.failed[0].check).toBe("observation");
  });
});

describe("thinking.angle.lock", () => {
  it("locks passed Angles", async () => {
    const rows = [{ id: "a1", code: "AN01", statement: angle.statement, status: "candidate", admission: "GENERATE_VALID", sort_order: 1, subject: angle.subject }];
    const set = {
      schema: "thinking-lab/angle-set/v1", repairCount: 0, siblingSet: null, auditLessons: [],
      audit: { fingerprint: "", items: [{ code: "AN01", verdict: "AUDIT_PASS", statementFingerprint: angleFingerprint({ statement: angle.statement, territoryFingerprint: trFp }) }] },
    };
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const result = await lockThinkingAngles(fakeAdmin(context("locked", rows, set), calls), ctx, { territoryId: trId });
    expect(result).toEqual({ saved: true, id: trId });
  });
  it("with every Angle check OFF, saves without asking and marks the item unchecked", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    let asked = 0;
    const result = await addThinkingAngle(fakeAdmin(context(), calls), config, ctx, { territoryId: trId, ...angle }, {
      checks: {},
      ask: async () => {
        asked += 1;
        return null;
      },
    });
    expect(result).toMatchObject({ saved: true, code: "AN02" });
    expect(asked).toBe(0);
    const save = calls.find((call) => call.fn === "mcp_add_thinking_angle")!;
    const set = save.args.p_angle_set as { audit: { items: Array<{ verdict: string; skipped?: string[] }> } };
    expect(set.audit.items[0].verdict).toBe("AUDIT_PASS");
    expect(set.audit.items[0].skipped?.length).toBe(6);
  });
});
