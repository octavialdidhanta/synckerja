import { describe, expect, it } from "vitest";
import { checkCaptionClaims } from "./captionClaims";

const registry = [
  { code: "KL01", text: "Satu porsi Sup Sum Sum Kambing cukup untuk 2 orang", status: "approved" as const, scopes: [{ scope: "product" as const, product: "m1" }] },
  { code: "KL02", text: "Kambing muda", status: "rejected" as const, scopes: [{ scope: "brand" as const }] },
  { code: "KL03", text: "Dimasak 8 jam", status: "needs_proof" as const, scopes: [{ scope: "brand" as const }] },
];

describe("checkCaptionClaims", () => {
  it("labels caption claims against the Daftar Klaim", () => {
    const out = checkCaptionClaims("Sop sumsum cukup untuk 2 orang. Kambing muda, dimasak 8 jam. Paling enak se-PIK!", registry, ["muda", "dimasak"]);
    const by = Object.fromEntries(out.map((f) => [f.claim, f]));
    expect(by["2 orang"]).toMatchObject({ status: "terdaftar", code: "KL01" });
    expect(by["kambing muda"]).toMatchObject({ status: "ditolak", code: "KL02" });
    expect(by["8 jam"]).toMatchObject({ status: "perlu_bukti", code: "KL03" });
    expect(by["paling enak"]).toMatchObject({ status: "tidak_terdaftar", code: null });
    expect(out[0].status).toBe("ditolak");
  });
  it("ignores calls to action", () => {
    expect(checkCaptionClaims("Klik WhatsApp, pesan duluan ya!", registry)).toEqual([]);
  });
});
