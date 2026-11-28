import { describe, expect, it } from "vitest";
import { allowedFactsBlock, claimHoldNote, guardClaims } from "./claimMatch";

const allowed = [
  { code: "KL01", text: "Satu porsi Sup Sum Sum Kambing cukup untuk 2 orang", status: "approved" as const, scopes: [] },
  { code: "KL03", text: "Daging kambing tidak bau prengus", status: "approved" as const, scopes: [] },
];

describe("AI Employee claim guard", () => {
  it("lists only the allowed facts in the prompt", () => {
    const block = allowedFactsBlock(allowed);
    expect(block).toContain("KL01: Satu porsi");
    expect(block).toContain("Jangan menulis fakta");
    expect(allowedFactsBlock([])).toMatch(/belum ada klaim/);
  });

  it("holds a draft with a claim outside the list and records the ones it used", () => {
    const res = guardClaims(
      [
        { where: "caption", text: "Sop sumsum cukup buat 2 org, nggak prengus. Dimasak 8 jam, paling enak se-PIK!" },
        { where: "brief", text: "Slide 1: Daging kambing gak bau prengus" },
      ],
      allowed,
      ["dimasak", "tidak bau", "nggak bau", "prengus"],
    );
    expect(res.used).toEqual(["KL01", "KL03"]);
    expect(res.offending.map((f) => f.claim)).toEqual(expect.arrayContaining(["8 jam", "paling enak"]));
    expect(claimHoldNote(res.offending)).toMatch(/Tidak di-auto-approve/);
  });

  it("passes a draft that only uses allowed facts", () => {
    expect(guardClaims([{ where: "caption", text: "Cukup untuk 2 orang. Yuk mampir!" }], allowed).offending).toEqual([]);
  });
});
