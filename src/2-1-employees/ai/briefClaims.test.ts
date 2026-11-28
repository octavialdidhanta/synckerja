import { describe, expect, it } from "vitest";
import { buildClaims } from "@/6-1-content-studio/claims/claimsData";
import { allowedBriefClaims, briefClaimRef } from "./briefClaims";

const row = (id: string, seq: number, status: "approved" | "needs_proof") => ({
  id, code: `KL0${seq}`, seq, text: `klaim ${seq}`, proof: "x", proof_file_path: null, status, rejection_reason: null,
  approved_by: null, approved_at: null, valid_until: null, created_at: "", updated_at: "",
});

describe("allowedBriefClaims", () => {
  it("joins picked, angle and brand claims and keeps unapproved ones out", () => {
    const claims = buildClaims(
      [row("a", 1, "approved"), row("b", 2, "approved"), row("c", 3, "needs_proof"), row("d", 4, "approved"), row("e", 5, "approved")],
      [
        { id: "s1", claim_id: "d", scope: "brand", menu_id: null, location_id: null },
        { id: "s2", claim_id: "e", scope: "product", menu_id: "m", location_id: null },
      ],
      [
        { id: "u1", claim_id: "a", module: "ai_employee", ref_id: briefClaimRef("emp"), label: null, created_at: "" },
        { id: "u2", claim_id: "b", module: "thinking_lab", ref_id: "angle:an1", label: null, created_at: "" },
        { id: "u3", claim_id: "c", module: "ai_employee", ref_id: briefClaimRef("emp"), label: null, created_at: "" },
      ],
    );
    const got = allowedBriefClaims(claims, "emp", ["an1"]);
    expect(got.picked.map((c) => c.code)).toEqual(["KL01"]);
    expect(got.fromAngle.map((c) => c.code)).toEqual(["KL02"]);
    expect(got.brand.map((c) => c.code)).toEqual(["KL04"]);
    expect(got.waiting.map((c) => c.code)).toEqual(["KL03"]);
  });
});
