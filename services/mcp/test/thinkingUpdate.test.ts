import { describe, expect, it } from "vitest";
import { resealSubtree, updateThinkingMaster, type Subtree } from "../src/db/thinkingUpdate";
import { confirmedFingerprint } from "../../../src/thinking-lab/master-thought/semantic";
import {
  angleFingerprint,
  bigThoughtFingerprint,
  ideaFingerprint,
  territoryFingerprint,
} from "../../../src/thinking-lab/shared/fingerprint";

const config = { supabaseUrl: "https://x", supabaseServiceRoleKey: "k", scheduledPostsInternalSecret: "s" };
const ctx = { userId: "u", organizationId: "o" };

function tree(master = "Sate kambing muda sama juicy-nya dengan wagyu."): Subtree {
  const mt = confirmedFingerprint(master, master);
  const bt = bigThoughtFingerprint({ statement: "lemak terselip di serat", masterThoughtFingerprint: mt });
  const tr = territoryFingerprint({ statement: "Marbling wagyu", bigThoughtFingerprint: bt });
  const an = angleFingerprint({ statement: "Juicy datang dari lemak di serat.", territoryFingerprint: tr });
  const id = ideaFingerprint({ statement: "Kita belah sate sehingga terlihat cairannya.", angleFingerprint: an });
  return {
    master: { id: "mt", statement: master, root_belief: master, prior_belief: "Sate kambing alot.", audience: "", semantic_fingerprint: mt, last_audit: { audit: { items: [{ code: "BT01", verdict: "AUDIT_PASS", statementFingerprint: bt }] } } },
    big_thoughts: [{ id: "bt", code: "BT01", title: "", statement: "lemak terselip di serat", status: "locked", semantic_fingerprint: bt, territory_set: { audit: { items: [{ code: "TR01", verdict: "AUDIT_PASS", statementFingerprint: tr }] } } }],
    territories: [{ id: "tr", code: "TR01", big_thought_id: "bt", statement: "Marbling wagyu", status: "locked", semantic_fingerprint: tr, angle_set: { audit: { items: [{ code: "AN01", verdict: "AUDIT_PASS", statementFingerprint: an, skipped: ["livedExample"] }] } } }],
    angles: [{ id: "an", code: "AN01", territory_id: "tr", statement: "Juicy datang dari lemak di serat.", status: "locked", semantic_fingerprint: an, parent_territory_fingerprint: tr, idea_set: { audit: { items: [{ code: "ID01", verdict: "AUDIT_PASS", statementFingerprint: id }] } } }],
    ideas: [{ id: "id", code: "ID01", angle_id: "an", statement: "Kita belah sate sehingga terlihat cairannya.", status: "locked", semantic_fingerprint: id, parent_angle_fingerprint: an }],
  };
}

describe("reseal after an update", () => {
  it("moves every locked descendant of a rewritten Territory onto the new name and marks it", () => {
    const before = tree();
    const after: Subtree = { ...before, territories: [{ ...before.territories[0], statement: "Lemak di dalam serat wagyu" }] };
    const changes = { big_thoughts: [], territories: [], angles: [], ideas: [] } as Parameters<typeof resealSubtree>[2];
    resealSubtree(before, after, changes, "tr");
    const tr = territoryFingerprint({ statement: "Lemak di dalam serat wagyu", bigThoughtFingerprint: before.big_thoughts[0].semantic_fingerprint! });
    const an = angleFingerprint({ statement: "Juicy datang dari lemak di serat.", territoryFingerprint: tr });
    const angle = changes.angles.find((change) => change.id === "an")!;
    expect(angle.semantic_fingerprint).toBe(an);
    expect(angle.parent_territory_fingerprint).toBe(tr);
    const ideaItems = (angle.idea_set as { audit: { items: Array<{ parentChanged?: true }> } }).audit.items;
    expect(ideaItems[0].parentChanged).toBe(true);
    const idea = changes.ideas.find((change) => change.id === "id")!;
    expect(idea.parent_angle_fingerprint).toBe(an);
    // The edited Territory itself is written by its own update, not by the reseal.
    expect(changes.territories.find((change) => change.id === "tr")?.semantic_fingerprint).toBeUndefined();
    // Its Angle item keeps its other fields.
    const angleItems = (changes.territories.find((change) => change.id === "tr")!.angle_set as { audit: { items: Array<{ skipped?: string[]; parentChanged?: true }> } }).audit.items;
    expect(angleItems[0].skipped).toEqual(["livedExample"]);
    expect(angleItems[0].parentChanged).toBe(true);
    expect(changes.big_thoughts).toEqual([]);
  });
});

describe("thinking.master.update", () => {
  it("with Master checks OFF, rewrites the belief and carries the whole tree", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const admin = {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        calls.push({ fn, args });
        if (fn === "mcp_thinking_subtree") return { data: tree(), error: null };
        if (fn === "mcp_thinking_master_catalog") {
          return { data: { category: "Warung Contoh", sub_categories: [], features: [] }, error: null };
        }
        return { data: null, error: null };
      },
    } as never;
    let asked = 0;
    const result = await updateThinkingMaster(admin, config, ctx, { masterThoughtId: "mt", belief: "Sate kambing muda Sate Sultan sama juicy-nya dengan wagyu MB7." }, {
      checks: {},
      ask: async () => {
        asked += 1;
        return null;
      },
    });
    expect(result.saved).toBe(true);
    expect(asked).toBe(0);
    const apply = calls.find((call) => call.fn === "mcp_thinking_apply")!;
    const changes = apply.args.p_changes as { master: { statement: string }; big_thoughts: Array<{ id: string; semantic_fingerprint?: string }>; ideas: Array<{ id: string }> };
    expect(changes.master.statement).toBe("Sate kambing muda Sate Sultan sama juicy-nya dengan wagyu MB7.");
    expect(changes.big_thoughts.find((change) => change.id === "bt")?.semantic_fingerprint).toBeDefined();
    expect(changes.ideas.some((change) => change.id === "id")).toBe(true);
  });

  it("refuses a new belief while no catalog category is linked", async () => {
    const admin = {
      rpc: async (fn: string) => {
        if (fn === "mcp_thinking_subtree") return { data: tree(), error: null };
        if (fn === "mcp_thinking_master_catalog") return { data: { category: null, sub_categories: [], features: [] }, error: null };
        return { data: null, error: null };
      },
    } as never;
    const result = await updateThinkingMaster(admin, config, ctx, { masterThoughtId: "mt", belief: "Kambing muda bisa seempuk daging sapi premium." }, {
      checks: {},
      ask: async () => null,
    });
    expect(result).toEqual({ saved: false, failed: [{ check: "masterThought", reason: "Link a catalog category first." }] });
  });
});
