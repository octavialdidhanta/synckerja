import { describe, expect, it } from "vitest";
import { addThinkingTerritory, lockThinkingTerritories } from "../src/db/thinkingTerritory";
import { confirmedFingerprint } from "../../../src/thinking-lab/master-thought/semantic";
import { ANSWERED_QUESTION_VERSION } from "../../../src/thinking-lab/big-thought/answeredQuestion";
import { bigThoughtFingerprint, territoryFingerprint } from "../../../src/thinking-lab/shared/fingerprint";
import { CHECK_REGISTRY } from "../../../src/thinking-lab/shared/checkSettings";

const ALL_ON = Object.fromEntries(
  Object.entries(CHECK_REGISTRY).flatMap(([level, entries]) => entries.map((entry) => [`${level}.${entry.id}`, true])),
);

const config = { supabaseUrl: "https://x", supabaseServiceRoleKey: "k", scheduledPostsInternalSecret: "s" };
const ctx = { userId: "u", organizationId: "o" };
const btId = "33333333-3333-4333-8333-333333333333";
const master = "Sate kambing muda Sate Sultan PIK sama juicy-nya dengan steak wagyu MB7–MB9.";
const btStatement = "lemak kambing muda masih terselip di dalam serat dagingnya";
const btFp = bigThoughtFingerprint({ statement: btStatement, masterThoughtFingerprint: confirmedFingerprint(master, master) });

function context(overrides: Record<string, unknown> = {}, territories: unknown[] = [], territorySet: unknown = null) {
  return {
    master: { statement: master, root_belief: master, audience: "Pecinta steak di PIK", confirmed: true },
    big_thought: {
      id: btId, code: "BT01", statement: btStatement, status: "locked", semantic_fingerprint: btFp,
      canonical_semantic: { answeredQuestion: "Kenapa sate kambing bisa tetap juicy?", answeredQuestionVersion: ANSWERED_QUESTION_VERSION },
      territory_set: territorySet,
      ...overrides,
    },
    territories,
    master_codes: ["TR01", "TR02"],
  };
}

function fakeAdmin(data: unknown, calls: Array<{ fn: string; args: Record<string, unknown> }>) {
  return {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === "mcp_thinking_territory_context") return { data, error: null };
      return { data: "44444444-4444-4444-8444-444444444444", error: null };
    },
  } as never;
}

function answer(pass: (id: string) => boolean) {
  return async (prompt: string) => {
    const ids = /check id: ([^.]+)\./.exec(prompt)?.[1].split(",").map((id) => id.trim());
    if (!ids) return "{}";
    return JSON.stringify({ checks: ids.map((id) => ({ id, pass: pass(id), reason: pass(id) ? "" : `${id} failed` })) });
  };
}

describe("thinking.territory.add", () => {
  it("saves a passing Territory with the next code under the Master Thought", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const result = await addThinkingTerritory(fakeAdmin(context(), calls), config, ctx, { bigThoughtId: btId, statement: "Bau prengus kambing" }, { checks: ALL_ON, ask: answer(() => true) });
    expect(result).toEqual({ saved: true, id: "44444444-4444-4444-8444-444444444444", code: "TR03" });
    const save = calls.find((call) => call.fn === "mcp_add_thinking_territory")!;
    const set = save.args.p_territory_set as { audit: { items: Array<{ code: string; verdict: string; statementFingerprint: string }> } };
    expect(set.audit.items[0]).toEqual({
      code: "TR03",
      verdict: "AUDIT_PASS",
      statementFingerprint: territoryFingerprint({ statement: "Bau prengus kambing", bigThoughtFingerprint: btFp }),
    });
  });

  it("refuses when the Big Thought is not locked", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const result = await addThinkingTerritory(fakeAdmin(context({ status: "candidate" }), calls), config, ctx, { bigThoughtId: btId, statement: "Bau prengus kambing" }, { checks: ALL_ON, ask: answer(() => true) });
    expect(result.saved).toBe(false);
    if (!result.saved) expect(result.failed[0].check).toBe("bigThought");
  });

  it("does not save a name that fails a check", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const result = await addThinkingTerritory(fakeAdmin(context(), calls), config, ctx, { bigThoughtId: btId, statement: "Lemak kambing" }, { checks: ALL_ON, ask: answer((id) => id !== "partOfBigThought") });
    expect(result.saved).toBe(false);
    if (!result.saved) expect(result.failed[0].check).toBe("partOfBigThought");
    expect(calls.some((call) => call.fn === "mcp_add_thinking_territory")).toBe(false);
  });
});

describe("thinking.territory.lock", () => {
  const names = ["Bau prengus kambing", "Pilih daging di pasar", "Makan malam keluarga"];
  const rows = names.map((statement, index) => ({ id: `t${index}`, code: `TR0${index + 1}`, statement, status: "candidate", admission: "GENERATE_VALID", sort_order: index }));
  const set = {
    schema: "thinking-lab/territory-set/v1", repairCount: 0, siblingSet: null, auditLessons: [],
    audit: { fingerprint: "", items: rows.map((row) => ({ code: row.code, verdict: "AUDIT_PASS", statementFingerprint: territoryFingerprint({ statement: row.statement, bigThoughtFingerprint: btFp }) })) },
  };

  it("locks three passed Territories", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const result = await lockThinkingTerritories(fakeAdmin(context({}, rows, set), calls), ctx, { bigThoughtId: btId });
    expect(result).toEqual({ saved: true, id: btId });
    expect((calls.at(-1)?.args.p_rows as unknown[]).length).toBe(3);
  });

  it("needs three Territories", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const result = await lockThinkingTerritories(fakeAdmin(context({}, rows.slice(0, 2), set), calls), ctx, { bigThoughtId: btId });
    expect(result.saved).toBe(false);
  });
});
