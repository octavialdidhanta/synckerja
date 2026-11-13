import { describe, expect, it } from "vitest";
import { addThinkingBigThought, createThinkingMaster } from "../src/db/thinkingWrite";

const config = { supabaseUrl: "https://x", supabaseServiceRoleKey: "k", scheduledPostsInternalSecret: "s" };
const ctx = { userId: "u", organizationId: "o" };
const masterId = "11111111-1111-4111-8111-111111111111";

function fakeAdmin(context: unknown, calls: Array<{ fn: string; args: Record<string, unknown> }>) {
  return {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === "mcp_thinking_big_thought_context") return { data: context, error: null };
      return { data: "22222222-2222-4222-8222-222222222222", error: null };
    },
  } as never;
}

/** Answers every batched check id with the given pass value. */
function batchAnswer(prompt: string, pass: (id: string) => boolean): string {
  const ids = /check id: ([^.]+)\./.exec(prompt)?.[1].split(",").map((id) => id.trim()) ?? [];
  return JSON.stringify({ checks: ids.map((id) => ({ id, pass: pass(id), reason: pass(id) ? "" : `${id} failed` })) });
}

describe("thinking.master.create", () => {
  it("saves a belief that passes and returns its id", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const result = await createThinkingMaster(fakeAdmin(null, calls), config, ctx, {
      belief: "Sate kambing muda Sate Sultan PIK sama juicy-nya dengan steak wagyu MB7–MB9.",
      priorBelief: "Daging paling juicy itu steak wagyu impor.",
      audience: "Pecinta steak di PIK",
    }, {
      ask: async () => JSON.stringify({ checks: ["oneClaim", "oneSentence", "notPromo", "shift"].map((id) => ({ id, pass: true })) }),
    });
    expect(result).toEqual({ saved: true, id: "22222222-2222-4222-8222-222222222222" });
    expect(calls[0].fn).toBe("mcp_create_thinking_master");
    expect(calls[0].args.p_fingerprint).toBeTruthy();
  });

  it("does not save a promotion and returns the reason", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const result = await createThinkingMaster(fakeAdmin(null, calls), config, ctx, {
      belief: "Sate kami juicy. Nggak puas? Kami garansi rasa.",
      priorBelief: "Sate kambing alot.",
      audience: "",
    }, {
      ask: async () => JSON.stringify({ checks: [
        { id: "oneClaim", pass: true }, { id: "oneSentence", pass: false, reason: "Tiga kalimat." },
        { id: "notPromo", pass: false, reason: "Kami garansi rasa adalah promo." }, { id: "shift", pass: true },
      ] }),
    });
    expect(result).toEqual({ saved: false, failed: [
      { check: "masterThought", reason: "Tiga kalimat." },
      { check: "masterThought", reason: "Kami garansi rasa adalah promo." },
    ] });
    expect(calls).toHaveLength(0);
  });
});

describe("thinking.bigthought.add", () => {
  const context = {
    statement: "Sate kambing muda Sate Sultan PIK sama juicy-nya dengan steak wagyu MB7–MB9.",
    root_belief: "Sate kambing muda Sate Sultan PIK sama juicy-nya dengan steak wagyu MB7–MB9.",
    subject: "Sate kambing muda Sate Sultan PIK sama juicy-nya dengan steak wagyu MB7–MB9.",
    confirmed: true,
    locked: false,
    last_audit: null,
    big_thoughts: [],
  };
  const statement = "lemak kambing muda masih terselip di dalam serat dagingnya, bukan menumpuk di luar seperti kambing tua";

  it("saves the first Big Thought as BT01 with a passing audit item", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const result = await addThinkingBigThought(fakeAdmin(context, calls), config, ctx, {
      masterThoughtId: masterId, statement, label: "Lemak di dalam serat",
    }, { ask: async (prompt) => batchAnswer(prompt, () => true) });
    expect(result).toEqual({ saved: true, id: "22222222-2222-4222-8222-222222222222", code: "BT01" });
    const save = calls.find((call) => call.fn === "mcp_add_thinking_big_thought");
    expect(save?.args.p_code).toBe("BT01");
    const audit = save?.args.p_last_audit as { audit: { items: Array<{ code: string; verdict: string }> } };
    expect(audit.audit.items).toEqual([expect.objectContaining({ code: "BT01", verdict: "AUDIT_PASS" })]);
  });

  it("does not save when a check fails and names that check", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const result = await addThinkingBigThought(fakeAdmin(context, calls), config, ctx, {
      masterThoughtId: masterId, statement: "bumbu marinasi kami diracik khusus", label: "",
    }, { ask: async (prompt) => batchAnswer(prompt, (id) => id !== "relation") });
    expect(result.saved).toBe(false);
    if (!result.saved) expect(result.failed[0].check).toBe("relation");
    expect(calls.some((call) => call.fn === "mcp_add_thinking_big_thought")).toBe(false);
  });

  it("refuses a Master Thought that is not confirmed", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const result = await addThinkingBigThought(fakeAdmin({ ...context, confirmed: false }, calls), config, ctx, {
      masterThoughtId: masterId, statement, label: "",
    }, { ask: async () => null });
    expect(result).toEqual({ saved: false, failed: [{ check: "masterThought", reason: "Confirm the Master Thought first." }] });
  });
});
