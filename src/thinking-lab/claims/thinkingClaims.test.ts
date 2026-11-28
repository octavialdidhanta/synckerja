import { describe, expect, it } from "vitest";
import { buildClaims } from "@/6-1-content-studio/claims/claimsData";
import { claimsBlockingBrief, linkedClaims, rankClaimsForNode, scopeMenusForNode, thinkingRef } from "./thinkingClaims";

const row = (id: string, seq: number, status: "approved" | "needs_proof" | "rejected", text: string) => ({
  id, code: `KL0${seq}`, seq, text, proof: null, proof_file_path: null, status, rejection_reason: null,
  approved_by: null, approved_at: null, valid_until: null, created_at: "", updated_at: "",
});

const claims = buildClaims(
  [row("a", 1, "approved", "Porsi 2 orang"), row("b", 2, "needs_proof", "Dimasak 8 jam"), row("c", 3, "rejected", "Kambing muda"), row("d", 4, "approved", "Sate babi juicy")],
  [
    { id: "s1", claim_id: "a", scope: "product", menu_id: "m-sumsum", location_id: null },
    { id: "s2", claim_id: "b", scope: "brand", menu_id: null, location_id: null },
    { id: "s3", claim_id: "c", scope: "brand", menu_id: null, location_id: null },
    { id: "s4", claim_id: "d", scope: "product", menu_id: "m-babi", location_id: null },
  ],
  [{ id: "u1", claim_id: "b", module: "thinking_lab", ref_id: thinkingRef("angle", "an1"), label: null, created_at: "" }],
);
const menus = new Map<string, string | null>([["m-sumsum", "sub-sumsum"], ["m-babi", "sub-babi"]]);

describe("thinking lab claims", () => {
  it("offers brand and same-category claims first and never rejected ones", () => {
    expect(rankClaimsForNode(claims, menus, ["sub-sumsum"]).map((c) => c.code)).toEqual(["KL01", "KL02", "KL04"]);
    expect(rankClaimsForNode(claims, menus, ["sub-sumsum"], "babi").map((c) => c.code)).toEqual(["KL04"]);
  });
  it("finds the claims linked to a node and the ones that block a brief", () => {
    const linked = linkedClaims(claims, [thinkingRef("angle", "an1"), thinkingRef("master", "m1")]);
    expect(linked.map((c) => c.code)).toEqual(["KL02"]);
    expect(claimsBlockingBrief(linked).map((c) => c.code)).toEqual(["KL02"]);
  });
  it("scopes a new claim to the products of the master thought's sub-categories", () => {
    expect(scopeMenusForNode(menus, ["sub-sumsum"])).toEqual(["m-sumsum"]);
    expect(scopeMenusForNode(menus, [])).toEqual([]);
  });
});
