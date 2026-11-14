import { describe, expect, it } from "vitest";
import {
  addThinkingBigThought,
  createThinkingMaster,
  lockThinkingBigThoughts,
  setThinkingMasterCatalog,
} from "../src/db/thinkingWrite";
import { CHECK_REGISTRY } from "../../../src/thinking-lab/shared/checkSettings";
import { confirmedFingerprint } from "../../../src/thinking-lab/master-thought/semantic";
import { bigThoughtFingerprint } from "../../../src/thinking-lab/shared/fingerprint";

const ALL_ON = Object.fromEntries(
  Object.entries(CHECK_REGISTRY).flatMap(([level, entries]) => entries.map((entry) => [`${level}.${entry.id}`, true])),
);

const config = { supabaseUrl: "https://x", supabaseServiceRoleKey: "k", scheduledPostsInternalSecret: "s" };
const ctx = { userId: "u", organizationId: "o" };
const masterId = "11111111-1111-4111-8111-111111111111";

function fakeAdmin(context: unknown, calls: Array<{ fn: string; args: Record<string, unknown> }>) {
  return {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === "mcp_thinking_big_thought_context") return { data: context, error: null };
      if (fn === "mcp_thinking_catalogs") return { data: [{ id: "cat-1", name: "Warung Contoh" }], error: null };
      if (fn === "mcp_thinking_catalog_options") {
        return {
          data: [
            { kind: "sub_category", id: "sub-1", name: "Iga Bakar Kambing Muda" },
            { kind: "feature", id: "feat-1", name: "Daging Empuk" },
          ],
          error: null,
        };
      }
      if (fn === "mcp_set_thinking_master_catalog") return { data: null, error: null };
      return { data: "22222222-2222-4222-8222-222222222222", error: null };
    },
  } as never;
}

const ALL_MASTER_CHECKS = ["singleClaim", "noPromoOrBrand", "subjectClear", "shift", "accountable"];

/** Answers every batched check id with the given pass value. */
function batchAnswer(prompt: string, pass: (id: string) => boolean): string {
  const ids = /check id: ([^.]+)\./.exec(prompt)?.[1].split(",").map((id) => id.trim()) ?? [];
  return JSON.stringify({ checks: ids.map((id) => ({ id, pass: pass(id), reason: pass(id) ? "" : `${id} failed` })) });
}

describe("thinking.master.create", () => {
  it("saves a belief that passes, links its catalog, and judges it with the catalog names", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    let prompt = "";
    const result = await createThinkingMaster(fakeAdmin(null, calls), config, ctx, {
      belief: "Kambing muda bisa seempuk daging sapi premium.",
      priorBelief: "Daging kambing pasti alot.",
      audience: "Pecinta steak",
      catalog: "Warung Contoh",
      subCategories: ["iga bakar kambing muda"],
      features: ["Daging Empuk"],
    }, {
      checks: ALL_ON,
      ask: async (text) => {
        prompt = text;
        return JSON.stringify({ checks: ALL_MASTER_CHECKS.map((id) => ({ id, pass: true })) });
      },
    });
    expect(result).toEqual({ saved: true, id: "22222222-2222-4222-8222-222222222222", catalog: "Warung Contoh" });
    expect(prompt).toContain("Iga Bakar Kambing Muda");
    expect(prompt).toContain("Daging Empuk");
    const link = calls.find((call) => call.fn === "mcp_set_thinking_master_catalog");
    expect(link?.args).toMatchObject({ p_service_id: "cat-1", p_sub_service_ids: ["sub-1"], p_feature_ids: ["feat-1"] });
    expect(calls.find((call) => call.fn === "mcp_create_thinking_master")?.args.p_fingerprint).toBeTruthy();
  });

  it("does not save a promotion with a brand name and returns the reasons", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const result = await createThinkingMaster(fakeAdmin(null, calls), config, ctx, {
      belief: "Sate Warung Contoh juicy. Nggak puas? Kami garansi rasa.",
      priorBelief: "Sate kambing alot.",
      audience: "",
      catalog: "Warung Contoh",
      subCategories: [],
      features: [],
    }, {
      checks: ALL_ON,
      ask: async () => JSON.stringify({ checks: ALL_MASTER_CHECKS.map((id) => ({
        id,
        pass: id !== "noPromoOrBrand",
        reason: id === "noPromoOrBrand" ? "Kami garansi rasa adalah promo dan menyebut Warung Contoh." : "",
      })) }),
    });
    expect(result).toEqual({ saved: false, failed: [
      { check: "masterThought", reason: "Kami garansi rasa adalah promo dan menyebut Warung Contoh." },
    ] });
    expect(calls.some((call) => call.fn === "mcp_create_thinking_master")).toBe(false);
  });

  it("returns the choices when a sub-category is not in the catalog", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const result = await createThinkingMaster(fakeAdmin(null, calls), config, ctx, {
      belief: "Kambing muda bisa seempuk daging sapi premium.",
      priorBelief: "Daging kambing pasti alot.",
      audience: "",
      catalog: "Warung Contoh",
      subCategories: ["Sop Buntut"],
      features: [],
    }, { checks: ALL_ON, ask: async () => null });
    expect(result.saved).toBe(false);
    if (!result.saved) expect(result.options).toEqual(["Iga Bakar Kambing Muda"]);
    expect(calls.some((call) => call.fn === "mcp_create_thinking_master")).toBe(false);
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
    }, { checks: ALL_ON, ask: async (prompt) => batchAnswer(prompt, () => true) });
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
    }, { checks: ALL_ON, ask: async (prompt) => batchAnswer(prompt, (id) => id !== "relation") });
    expect(result.saved).toBe(false);
    if (!result.saved) expect(result.failed[0].check).toBe("relation");
    expect(calls.some((call) => call.fn === "mcp_add_thinking_big_thought")).toBe(false);
  });

  it("compares the sentence with the Big Thoughts that passed, on the card itself", async () => {
    const parentFp = confirmedFingerprint(context.statement, context.root_belief);
    const passedStatement = "dagingnya dipotong tipis sebelum dibakar";
    const withPassed = {
      ...context,
      big_thoughts: [{ id: "bt-1", code: "BT01", label: "", statement: passedStatement, status: "candidate", sort_order: 1 }],
      last_audit: {
        schema: "thinking-lab/v1",
        audit: {
          setFingerprint: "",
          items: [{ code: "BT01", verdict: "AUDIT_PASS", statementFingerprint: bigThoughtFingerprint({ statement: passedStatement, masterThoughtFingerprint: parentFp }) }],
        },
      },
    };
    const prompts: string[] = [];
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const result = await addThinkingBigThought(fakeAdmin(withPassed, calls), config, ctx, {
      masterThoughtId: masterId, statement, label: "",
    }, {
      checks: ALL_ON,
      ask: async (prompt) => {
        prompts.push(prompt);
        return batchAnswer(prompt, (id) => id !== "duplicate");
      },
    });
    expect(result.saved).toBe(false);
    if (!result.saved) expect(result.failed[0].check).toBe("duplicate");
    expect(prompts.some((prompt) => prompt.includes(`BT01: ${passedStatement}`))).toBe(true);
  });

  it("refuses a Master Thought that is not confirmed", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const result = await addThinkingBigThought(fakeAdmin({ ...context, confirmed: false }, calls), config, ctx, {
      masterThoughtId: masterId, statement, label: "",
    }, { checks: ALL_ON, ask: async () => null });
    expect(result).toEqual({ saved: false, failed: [{ check: "masterThought", reason: "Confirm the Master Thought first." }] });
  });
});

describe("thinking catalog", () => {
  function catalogAdmin(rows: Array<{ id: string; name: string }>, calls: Array<{ fn: string; args: Record<string, unknown> }>) {
    return {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        calls.push({ fn, args });
        if (fn === "mcp_thinking_catalogs") {
          const query = String(args.p_query ?? "").toLowerCase();
          return { data: query ? rows.filter((row) => row.name.toLowerCase().includes(query)) : rows, error: null };
        }
        if (fn === "mcp_set_thinking_master_catalog") return { data: null, error: null };
        return { data: "22222222-2222-4222-8222-222222222222", error: null };
      },
    } as never;
  }
  const rows = [{ id: "cat-1", name: "Sate Sultan PIK" }, { id: "cat-2", name: "Sate Sultan Pluit" }];

  it("links one matching catalog and clears the optional lists", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const result = await setThinkingMasterCatalog(catalogAdmin(rows, calls), ctx, {
      masterThoughtId: masterId, catalog: "PIK", subCategories: [], features: [],
    });
    expect(result).toEqual({ saved: true, id: masterId, catalog: "Sate Sultan PIK" });
    expect(calls.at(-1)?.args).toMatchObject({ p_service_id: "cat-1", p_sub_service_ids: [], p_feature_ids: [] });
  });

  it("returns the choices when the name matches several", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const result = await setThinkingMasterCatalog(catalogAdmin(rows, calls), ctx, {
      masterThoughtId: masterId, catalog: "Sultan", subCategories: [], features: [],
    });
    expect(result.saved).toBe(false);
    if (!result.saved) expect(result.catalogs).toEqual(["Sate Sultan PIK", "Sate Sultan Pluit"]);
    expect(calls.some((call) => call.fn === "mcp_set_thinking_master_catalog")).toBe(false);
  });
});

describe("thinking.bigthought.lock", () => {
  const masterStatement = "Sate kambing muda Sate Sultan PIK sama juicy-nya dengan steak wagyu MB7–MB9.";
  const statement = "lemak kambing muda masih terselip di dalam serat dagingnya";

  async function savedContext(): Promise<unknown> {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const base = {
      statement: masterStatement, root_belief: masterStatement, subject: masterStatement,
      confirmed: true, locked: false, last_audit: null, big_thoughts: [],
    };
    await addThinkingBigThought(fakeAdmin(base, calls), config, ctx, { masterThoughtId: masterId, statement, label: "" }, {
      checks: ALL_ON,
      ask: async (prompt) => batchAnswer(prompt, () => true),
    });
    const save = calls.find((call) => call.fn === "mcp_add_thinking_big_thought")!;
    return {
      ...base,
      last_audit: save.args.p_last_audit,
      big_thoughts: [{
        id: "bt-1", code: "BT01", label: "", statement, status: "candidate", sort_order: 1,
        canonical_semantic: save.args.p_facts, semantic_fingerprint: save.args.p_fingerprint,
      }],
    };
  }

  it("locks a set whose Big Thoughts all passed", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const result = await lockThinkingBigThoughts(fakeAdmin(await savedContext(), calls), ctx, { masterThoughtId: masterId });
    expect(result).toEqual({ saved: true, id: masterId });
    expect(calls.at(-1)?.fn).toBe("mcp_lock_thinking_big_thoughts");
    expect(calls.at(-1)?.args.p_big_thought_ids).toEqual(["bt-1"]);
  });

  it("does not lock when a Big Thought changed after its checks", async () => {
    const context = (await savedContext()) as { big_thoughts: Array<{ statement: string }> };
    context.big_thoughts[0].statement = "kalimat yang sudah diubah";
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const result = await lockThinkingBigThoughts(fakeAdmin(context, calls), ctx, { masterThoughtId: masterId });
    expect(result.saved).toBe(false);
    expect(calls.some((call) => call.fn === "mcp_lock_thinking_big_thoughts")).toBe(false);
  });
});
