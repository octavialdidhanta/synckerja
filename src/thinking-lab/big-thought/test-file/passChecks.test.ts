import { describe, expect, it, vi } from "vitest";
import { individualAdmission } from "@/thinking-lab/big-thought/policy";
import {
  buildBigThoughtPassPrompt,
  factsForBigThoughtChecks,
  lessonsForPassGate,
  runBigThoughtChecks,
} from "@/thinking-lab/big-thought/passChecks";
import { checklistFromFailure } from "@/thinking-lab/big-thought/checklist";

/** Answers a batched prompt; the checks in `fails` fail with their reason, every other check passes. */
function batchAnswer(prompt: string, fails: Record<string, string> = {}): string {
  const listed = /check id: ([^\n]+)\./.exec(prompt);
  const ids = listed ? listed[1].split(", ") : [];
  return JSON.stringify({ checks: ids.map((id) => ({ id, pass: !fails[id], reason: fails[id] ?? "" })) });
}

const isBatch = (prompt: string) => prompt.includes('"checks"');

/** vi.fn() mocks declared without params record calls as `[]`; read them with the real arg types. */
const callsOf = <T extends unknown[]>(fn: { mock: { calls: unknown[] } }) => fn.mock.calls as unknown as T[];

describe("Big Thought pass checks", () => {
  it("treats ordinary new material as allowed on the premise gate", () => {
    const prompt = buildBigThoughtPassPrompt({
      id: "premise",
      statement: "Daging pilihan diolah khusus agar bebas bau prengus.",
      parentStatement: "Sate kambing berkualitas tinggi dapat dinikmati tanpa bau prengus.",
      others: [],
    });
    expect(prompt).toContain("Informasi baru yang belum disebut Master Thought boleh");
    expect(prompt).toContain("Jangan gagalkan hanya karena Master Thought tidak memuat atau membuktikan kalimat ini");
    expect(prompt).toContain("klaim faktual yang terlalu spesifik dan butuh bukti terpisah");
  });

  it("sends earlier premise failures into the premise pass prompt", () => {
    const prompt = buildBigThoughtPassPrompt({
      id: "premise",
      statement: "A repaired clause",
      parentStatement: "The master claim",
      others: [],
      lessons: [
        {
          statement: "Every batch is 100% free of smell within one day.",
          reason: "premise: Klaim universal yang membutuhkan bukti terpisah.",
        },
        {
          statement: "A different relation failure",
          reason: "relation: It restates the Master Thought.",
        },
      ],
    });
    expect(prompt).toContain("Earlier premise failures for this Big Thought");
    expect(prompt).toContain("Every batch is 100% free of smell within one day.");
    expect(prompt).toContain("Klaim universal yang membutuhkan bukti terpisah.");
    expect(prompt).not.toContain("It restates the Master Thought.");
  });

  it("keeps only matching gate lessons", () => {
    expect(
      lessonsForPassGate(
        [
          { statement: "A", reason: "premise: too specific" },
          { statement: "B", reason: "relation: restates" },
          { statement: "C", reason: "No replacement came back." },
        ],
        "premise",
      ),
    ).toEqual([{ statement: "A", reason: "too specific" }]);
  });

  it("treats one result of the same cause as part of the reason", () => {
    const prompt = buildBigThoughtPassPrompt({
      id: "relation",
      statement: "Pengelola yang berbeda mengubah dampak, sehingga dana yang sama tidak menghasilkan hal yang sama.",
      parentStatement: "Memilih pengelola adalah bagian dari tanggung jawab.",
      others: [],
    });
    expect(prompt).toContain("disambung dengan \"sehingga\", tetap bagian dari alasan");
    expect(prompt).toContain("Bagian hasil juga gagal jika mengulang Master Thought atau membuka alasan kedua.");
  });

  it("rejects a finished sentence that does not already follow because", () => {
    const prompt = buildBigThoughtPassPrompt({
      id: "relation",
      statement: "Pemilihan pengelola yang berbeda mengubah hasil pengelolaan.",
      parentStatement: "Memilih pengelola adalah bagian dari tanggung jawab.",
      others: [],
    });
    expect(prompt).toContain(
      "menyisipkan kata \"karena\" di antara Master Thought dan kalimat ini sudah membentuk satu kalimat yang utuh",
    );
    expect(prompt).toContain("tanpa membuka klaim baru");
    expect(prompt).toContain("harus ditulis ulang agar bisa mengikuti \"karena\"");
    expect(prompt).toContain("hanya menyebut sebuah area");
    expect(prompt).toContain("pengamatan yang jarang disadari, bukan alasan");
  });

  it("stops at the first failed check and leaves the later ones unchecked", async () => {
    const ask = vi.fn(async (prompt: string) =>
      isBatch(prompt) ? batchAnswer(prompt, { relation: "It restates the Master Thought." }) : '{"pass":true,"reason":""}',
    );
    const result = await runBigThoughtChecks({
      statement: "The same claim again",
      parentStatement: "The master claim",
      others: [],
      ask,
    });
    expect(ask).toHaveBeenCalledTimes(1);
    expect(result.failure).toMatchObject({ gate: "relation", reason: "It restates the Master Thought." });
    expect(result.items.find((item) => item.id === "resolved")?.state).toBe("pass");
    expect(result.items.find((item) => item.id === "explains")?.state).toBe("unchecked");
    expect(individualAdmission({ facts: factsForBigThoughtChecks("NEW", "The same claim again", result), factsCurrent: true })).toBe(
      "GENERATE_REJECT",
    );
  });

  it("passes the duplicate check without a model when no Big Thought has passed yet", async () => {
    const ask = vi.fn(async (prompt: string) => (isBatch(prompt) ? batchAnswer(prompt) : '{"pass":true,"reason":""}'));
    const result = await runBigThoughtChecks({
      statement: "A distinct material reason",
      parentStatement: "The master claim",
      others: [],
      ask,
    });
    expect(ask).toHaveBeenCalledTimes(1);
    expect(String(callsOf<[string]>(ask)[0]?.[0])).not.toContain("Check duplicate:");
    expect(result.passed).toBe(true);
    expect(individualAdmission({ facts: factsForBigThoughtChecks("BT01", "A distinct material reason", result), factsCurrent: true })).toBe(
      "GENERATE_VALID",
    );
  });

  it("compares the sentence with the Big Thoughts that already passed", async () => {
    const ask = vi.fn(async (prompt: string) =>
      isBatch(prompt) ? batchAnswer(prompt, { duplicate: "BT01: alasan dasar yang sama." }) : '{"pass":true,"reason":""}',
    );
    const result = await runBigThoughtChecks({
      statement: "A second reason in other words",
      parentStatement: "The master claim",
      others: [{ code: "BT01", statement: "A first reason" }],
      ask,
    });
    const prompt = String(callsOf<[string]>(ask)[0]?.[0]);
    expect(prompt).toContain("Big Thoughts that already passed:");
    expect(prompt).toContain("BT01: A first reason");
    expect(prompt).toContain("alasan dasar yang berbeda");
    expect(result.failure).toMatchObject({ gate: "duplicate", reason: "BT01: alasan dasar yang sama." });
  });

  it("fails an exact repeat in code", async () => {
    const ask = vi.fn(async (prompt: string) => (isBatch(prompt) ? batchAnswer(prompt) : '{"pass":true,"reason":""}'));
    const result = await runBigThoughtChecks({
      statement: "A first reason",
      parentStatement: "The master claim",
      others: [{ code: "BT01", statement: "A first reason" }],
      ask,
    });
    expect(String(callsOf<[string]>(ask)[0]?.[0])).not.toContain("Check duplicate:");
    expect(result.failure).toMatchObject({ gate: "duplicate", reason: "Same Big Thought as BT01." });
  });

  it("does not ask the checks it keeps or the ones switched off", async () => {
    const ask = vi.fn(async () => '{"pass":true,"reason":""}');
    const result = await runBigThoughtChecks({
      statement: "A distinct material reason",
      parentStatement: "The master claim",
      others: [],
      keep: ["resolved", "relation", "explains"],
      skip: ["premise"],
      ask,
    });
    // Only showable is left for the model, so it is asked alone.
    expect(ask).toHaveBeenCalledTimes(1);
    expect(String(callsOf<[string]>(ask)[0]?.[0])).toContain("bisa ditunjukkan, dibandingkan, atau dialami");
    expect(result.passed).toBe(true);
    expect(result.items.find((item) => item.id === "premise")?.reason).toBe("Dimatikan untuk organisasi ini.");
  });

  it("feeds earlier failures of a check into that check's prompt", async () => {
    const ask = vi.fn(async () => '{"pass":true,"reason":""}');
    await runBigThoughtChecks({
      statement: "An ordinary process reason",
      parentStatement: "The master claim",
      others: [],
      keep: ["resolved", "relation", "explains", "showable"],
      lessons: [{ statement: "Every batch is always 100% free of smell.", reason: "premise: Klaim universal yang membutuhkan bukti terpisah." }],
      ask,
    });
    expect(String(callsOf<[string]>(ask)[0]?.[0])).toContain("Earlier premise failures for this Big Thought");
    expect(String(callsOf<[string]>(ask)[0]?.[0])).toContain("Every batch is always 100% free of smell.");
  });

  it("reports each check as it is checked", async () => {
    const steps: string[] = [];
    const ask = vi.fn(async (prompt: string) => (isBatch(prompt) ? batchAnswer(prompt) : '{"pass":true,"reason":""}'));
    await runBigThoughtChecks({
      statement: "A distinct material reason",
      parentStatement: "The master claim",
      others: [],
      ask,
      onStep: (checklist) => {
        const report = checklist.report;
        steps.push(report ? `${report.phase}:${report.gate}` : "blank");
      },
    });
    expect(steps[0]).toBe("blank");
    expect(steps).toContain("checking:resolved");
    expect(steps.at(-1)).toBe("checked:duplicate");
  });
});

describe("facts after the checks", () => {
  it("makes a failed sentence a reject or unresolved, never valid", () => {
    const admitted = (gate: "resolved" | "relation" | "explains" | "premise" | "showable" | "duplicate") =>
      individualAdmission({
        facts: factsForBigThoughtChecks("NEW", "Some clause", checklistFromFailure({ gate, reason: "No.", earlier: "pass" })),
        factsCurrent: true,
      });
    expect(admitted("duplicate")).toBe("GENERATE_REJECT");
    expect(admitted("relation")).toBe("GENERATE_REJECT");
    expect(admitted("explains")).toBe("GENERATE_REJECT");
    expect(admitted("premise")).toBe("GENERATE_REJECT");
    expect(admitted("resolved")).toBe("UNRESOLVED");
    expect(admitted("showable")).toBe("UNRESOLVED");
  });
});

describe("method rule", () => {
  it("names a making or serving step with a sehingga result as a method, and a property of the subject as not", () => {
    const prompt = buildBigThoughtPassPrompt({
      id: "relation",
      statement: "potongan sate kecil matang cepat di bara, sehingga cairan belum menguap",
      parentStatement: "Sate kambing muda sama juicy-nya dengan wagyu.",
      others: [],
    });
    expect(prompt).toContain(
      "Langkah mengerjakan, membuat, menyiapkan, atau menyajikan sesuatu adalah metode, walaupun diikuti \"sehingga\" dan hasilnya.",
    );
    expect(prompt).toContain("Sifat subjek itu sendiri (apa adanya atau apa yang dimilikinya) bukan metode.");
  });
});
