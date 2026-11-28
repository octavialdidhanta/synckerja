import { describe, expect, it } from "vitest";
import {
  approveBlocker,
  buildClaims,
  claimDraftError,
  claimProofPath,
  claimsFor,
  draftFromClaim,
  draftScopes,
  filterClaims,
  isClaimExpired,
  pointIsBacked,
  scopeSummary,
  todayWib,
  type ClaimRow,
} from "./claimsData";

const row = (over: Partial<ClaimRow>): ClaimRow => ({
  id: "c1",
  code: "KL01",
  seq: 1,
  text: "Semua daging halal",
  proof: null,
  proof_file_path: null,
  status: "needs_proof",
  rejection_reason: null,
  approved_by: null,
  approved_at: null,
  valid_until: null,
  created_at: "2026-11-28T00:00:00Z",
  updated_at: "2026-11-28T00:00:00Z",
  ...over,
});

const claims = buildClaims(
  [row({ id: "c2", code: "KL02", seq: 2, text: "Dimasak 8 jam", status: "approved", proof: "SOP" }), row({})],
  [
    { id: "s1", claim_id: "c1", scope: "brand", menu_id: null, location_id: null },
    { id: "s2", claim_id: "c2", scope: "product", menu_id: "m1", location_id: null },
    { id: "s3", claim_id: "c2", scope: "location", menu_id: null, location_id: "l1" },
  ],
  [{ id: "u1", claim_id: "c2", module: "brief", ref_id: "b1", label: "Brief sop", created_at: "2026-11-28T01:00:00Z" }],
);

describe("claimsData", () => {
  it("builds claims in code order with scopes and uses", () => {
    expect(claims.map((c) => c.code)).toEqual(["KL01", "KL02"]);
    expect(claims[1].scopes).toEqual([
      { scope: "product", targetId: "m1" },
      { scope: "location", targetId: "l1" },
    ]);
    expect(claims[1].uses).toHaveLength(1);
  });

  it("returns brand-wide claims plus a product's own", () => {
    expect(claimsFor(claims, "product", "m1").map((c) => c.code)).toEqual(["KL01", "KL02"]);
    expect(claimsFor(claims, "product", "m2").map((c) => c.code)).toEqual(["KL01"]);
    expect(claimsFor(claims, "location", "l1").map((c) => c.code)).toEqual(["KL01", "KL02"]);
  });

  it("filters by status, scope and text", () => {
    expect(filterClaims(claims, { status: "approved", scope: "all", q: "" }).map((c) => c.code)).toEqual(["KL02"]);
    expect(filterClaims(claims, { status: "all", scope: "brand", q: "" }).map((c) => c.code)).toEqual(["KL01"]);
    expect(filterClaims(claims, { status: "all", scope: "all", q: "kl02" }).map((c) => c.code)).toEqual(["KL02"]);
    expect(filterClaims(claims, { status: "all", scope: "all", q: "halal" }).map((c) => c.code)).toEqual(["KL01"]);
  });

  it("summarises scopes with names", () => {
    const names = { products: new Map([["m1", "Sop Sumsum"]]), locations: new Map([["l1", "PIK1"]]) };
    expect(scopeSummary(claims[0], names)).toBe("Semua produk (brand)");
    expect(scopeSummary(claims[1], names)).toBe("Sop Sumsum, PIK1");
  });

  it("validates drafts and stores brand as the only scope", () => {
    const d = draftFromClaim(claims[1]);
    expect(d).toMatchObject({ brand: false, productIds: ["m1"], locationIds: ["l1"] });
    expect(claimDraftError({ ...d, text: "ab" })).toMatch(/minimal 3/);
    expect(claimDraftError({ ...d, productIds: [], locationIds: [] })).toMatch(/cakupan/);
    expect(claimDraftError({ ...d, validUntil: "2026-01-01" }, "2026-11-28")).toMatch(/masa lalu/);
    expect(claimDraftError(d)).toBeNull();
    expect(draftScopes({ ...d, brand: true })).toEqual([{ scope: "brand", targetId: null }]);
  });

  it("blocks approval without proof or after expiry", () => {
    expect(approveBlocker(claims[0])).toMatch(/bukti/);
    expect(approveBlocker({ ...claims[1], valid_until: "2026-11-01" }, "2026-11-28")).toMatch(/lewat/);
    expect(approveBlocker(claims[1])).toBeNull();
    expect(isClaimExpired({ valid_until: "2026-11-27" }, "2026-11-28")).toBe(true);
    expect(isClaimExpired({ valid_until: "2026-11-28" }, "2026-11-28")).toBe(false);
  });

  it("uses the WIB day and an org claims folder", () => {
    expect(todayWib(new Date("2026-11-28T18:00:00Z"))).toBe("2026-11-29");
    expect(claimProofPath("org", "c1", "Sertifikat Halal.PDF", 5)).toBe("org/claims/c1-5.pdf");
  });

  it("backs a point only with an approved, unexpired claim", () => {
    expect(pointIsBacked([], "2026-11-28")).toBe(false);
    expect(pointIsBacked([{ status: "needs_proof", valid_until: null }], "2026-11-28")).toBe(false);
    expect(pointIsBacked([{ status: "approved", valid_until: "2026-11-01" }], "2026-11-28")).toBe(false);
    expect(pointIsBacked([{ status: "approved", valid_until: null }], "2026-11-28")).toBe(true);
  });
});
