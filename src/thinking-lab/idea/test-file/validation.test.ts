import { describe, expect, it } from "vitest";
import { buildIdeaGeneratePrompt } from "@/thinking-lab/idea/generate";
import { admitIdea } from "@/thinking-lab/idea/policy";
import { ideaFactsForValidation } from "@/thinking-lab/idea/generate";
import {
  admissionForDecision,
  canReviseIdea,
  checksFromValidation,
  classifyLegacyIdea,
  failureItemsFromIdeas,
  ideaHistorySummary,
  judgeIdeaValidation,
  revisionCount,
  applyCrossIdeaGroups,
  buildCrossIdeaPrompt,
  buildIdeaCriterionPrompt,
  buildIdeaRevisionPrompt,
  auditVerdictForValidation,
  judgeCrossIdeas,
  parseIdeaCriterion,
  lessonSentence,
  readIdeaValidation,
  runIdeaPassChecks,
  auditSnapshot,
  withAuditHistory,
  type IdeaValidation,
} from "@/thinking-lab/idea/validation";

const ANGLE = "Dilema data kinerja yang memakai skor individu";
const TERRITORY = "Kinerja karyawan";
const BIG = "Integrasi fungsi bisnis";
const MASTER = "Synckerja Office menyatukan kerja harian";
const NOW = "2026-10-24T00:00:00.000Z";

const PROBLEM_STATEMENTS = [
  "Penugasan proyek berdasarkan skor individu",
  "Promosi berdasarkan metrik individu",
  "Tampilan Dashboard Individu",
];

function passedCriteria(): IdeaValidation["criteria"] {
  return (["K1", "K2", "K3", "K4", "K5", "K6", "K7"] as const).map((id) => ({
    id,
    status: "PASS" as const,
    reason: `${id} terbukti pada gagasan ini.`,
    evidence: `Bagian ${id} pada mekanisme tim.`,
    explanation: `${id} terbukti pada gagasan ini.`,
    weakness: "Asumsi yang tersisa: data tim tersedia.",
  }));
}

function auditPass(id: string): string {
  return JSON.stringify({
    status: "PASS",
    evidence: `Bagian ${id} pada mekanisme tim.`,
    explanation: `${id} terbukti karena mekanisme itu menghasilkan akibat yang disebut.`,
    weakness: "Asumsi yang tersisa: data tim tersedia.",
    masterThoughtLink: "Synckerja Office menyatukan kerja harian lewat keputusan tim.",
    bigThoughtLink: "Integrasi fungsi bisnis muncul saat tugas dibagi bersama.",
    territoryLink: "Kinerja karyawan berubah lewat cara penugasan.",
  });
}

describe("idea K1–K7", () => {
  it("rejects a problem statement and leaves the other criteria unverified", () => {
    for (const statement of PROBLEM_STATEMENTS) {
      const validation = classifyLegacyIdea(statement, ANGLE, NOW);
      expect(validation.decision).toBe("DITOLAK");
      expect(validation.criteria.find((criterion) => criterion.id === "K1")).toMatchObject({
        status: "FAIL",
        explanation: "This is not a how-if proposal.",
      });
      expect(validation.criteria.find((criterion) => criterion.id === "K1")?.reason).toContain("STATUS: FAIL");
      expect(validation.criteria.find((criterion) => criterion.id === "K1")?.reason).toContain("BUKTI:");
      expect(validation.criteria.filter((criterion) => criterion.id !== "K1").every((criterion) => criterion.status === "BELUM_TERVERIFIKASI")).toBe(true);
      expect(admissionForDecision(validation.decision)).toBe("GENERATE_REJECT");
      expect(statement).toBe(statement);
    }
  });

  it("leaves a how-if statement unverified until K1–K7 are judged", () => {
    const validation = classifyLegacyIdea("Bagaimana jika penugasan memakai skor tim?", ANGLE, NOW);
    expect(validation.decision).toBe("BELUM_TERVERIFIKASI");
    expect(validation.criteria.every((criterion) => criterion.status === "BELUM_TERVERIFIKASI")).toBe(true);
    expect(admissionForDecision(validation.decision)).toBe("UNRESOLVED");
  });

  it("accepts an idea only when every criterion passes", async () => {
    const statement = "Bagaimana jika penugasan proyek memakai skor tim?";
    const validation = await judgeIdeaValidation({
      statement,
      title: "Skor tim",
      concept: "Skor tim menggantikan skor orang",
      mechanism: "Tugas dibagi menurut hasil tim",
      value: "Orang tidak dipilah sendirian",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      validatedAt: NOW,
      ask: async () =>
        JSON.stringify({
          criteria: passedCriteria(),
          classification: "",
          recommendation: "",
          title: "Skor tim",
          concept: "Skor tim menggantikan skor orang",
          mechanism: "Tugas dibagi menurut hasil tim",
          value: "Orang tidak dipilah sendirian",
        }),
    });
    expect(validation.decision).toBe("LOLOS");
    expect(validation.criteria.every((criterion) => criterion.status === "PASS")).toBe(true);
    expect(admitIdea(ideaFactsForValidation("ID04", statement, validation.decision))).toBe("GENERATE_VALID");
  });

  it("rejects the idea when one criterion fails", async () => {
    const criteria = passedCriteria().map((criterion) =>
      criterion.id === "K4" ? { ...criterion, status: "FAIL" as const, reason: "Nilainya belum terasa." } : criterion,
    );
    const validation = await judgeIdeaValidation({
      statement: "Bagaimana jika dashboard menampilkan skor tim?",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      validatedAt: NOW,
      ask: async () => JSON.stringify({ criteria }),
    });
    expect(validation.decision).toBe("DITOLAK");
    expect(validation.decisionReason).toContain("K4");
    expect(admitIdea(ideaFactsForValidation("ID05", "Bagaimana jika dashboard menampilkan skor tim?", validation.decision))).toBe(
      "GENERATE_REJECT",
    );
  });

  it("keeps K6 unverified when Master Thought, Big Thought, or Territory cannot be checked", async () => {
    const criteria = passedCriteria().map((criterion) =>
      criterion.id === "K6" ? { ...criterion, status: "BELUM_TERVERIFIKASI" as const, reason: "" } : criterion,
    );
    const missing = await judgeIdeaValidation({
      statement: "Bagaimana jika skor tim menutup skor orang?",
      angle: ANGLE,
      territory: "",
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      validatedAt: NOW,
      ask: async () => JSON.stringify({ criteria }),
    });
    expect(missing.criteria.find((criterion) => criterion.id === "K6")?.status).toBe("BELUM_TERVERIFIKASI");
    expect(missing.decision).toBe("BELUM_TERVERIFIKASI");

    const present = await judgeIdeaValidation({
      statement: "Bagaimana jika skor tim menutup skor orang?",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      validatedAt: NOW,
      ask: async () => JSON.stringify({ criteria }),
    });
    expect(present.criteria.find((criterion) => criterion.id === "K6")?.status).toBe("BELUM_TERVERIFIKASI");
    expect(present.decision).toBe("BELUM_TERVERIFIKASI");

    const assumed = passedCriteria();
    const missingMaster = await judgeIdeaValidation({
      statement: "Bagaimana jika skor tim menutup skor orang?",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: "",
      failures: [],
      validatedAt: NOW,
      ask: async () => JSON.stringify({ criteria: assumed }),
    });
    expect(missingMaster.criteria.find((criterion) => criterion.id === "K6")?.status).toBe("BELUM_TERVERIFIKASI");
    expect(missingMaster.decision).toBe("BELUM_TERVERIFIKASI");
  });

  it("fails the same criterion when the substance was already rejected", async () => {
    const rejected = "Bagaimana jika penugasan proyek memakai skor individu?";
    const validation = await judgeIdeaValidation({
      statement: rejected,
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [
        {
          code: "ID01",
          statement: rejected,
          angleId: "angle-1",
          sameAngle: true,
          failed: [{ id: "K5", reason: "Ini skor individu yang sama." }],
        },
      ],
      validatedAt: NOW,
      ask: async () => JSON.stringify({ criteria: passedCriteria() }),
    });
    expect(validation.criteria.find((criterion) => criterion.id === "K5")).toMatchObject({
      status: "FAIL",
      reason: "Ini skor individu yang sama.",
    });
    expect(validation.decision).toBe("DITOLAK");
  });

  it("does not reject an idea only because it shares words with a failed idea", async () => {
    const validation = await judgeIdeaValidation({
      statement: "Bagaimana jika giliran kerja dibagi menurut hasil tim?",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [
        {
          code: "ID01",
          statement: "Bagaimana jika penugasan proyek memakai skor individu?",
          angleId: "angle-1",
          sameAngle: true,
          failed: [{ id: "K5", reason: "Ini skor individu yang sama." }],
        },
      ],
      validatedAt: NOW,
      ask: async () => JSON.stringify({ criteria: passedCriteria() }),
    });
    expect(validation.decision).toBe("LOLOS");
  });

  it("stops a rejected idea after three revisions", () => {
    const rows = [
      { id: "root", parentIdeaId: null },
      { id: "r1", parentIdeaId: "root" },
      { id: "r2", parentIdeaId: "r1" },
      { id: "r3", parentIdeaId: "r2" },
    ];
    expect(revisionCount("root", rows)).toBe(3);
    expect(canReviseIdea(rows[0], rows, "DITOLAK")).toBe(false);
    expect(canReviseIdea(rows[0], rows.slice(0, 3), "DITOLAK")).toBe(true);
    expect(canReviseIdea(rows[0], rows.slice(0, 3), "BELUM_TERVERIFIKASI")).toBe(true);
    expect(canReviseIdea(rows[0], rows, "BELUM_TERVERIFIKASI")).toBe(false);
    expect(canReviseIdea(rows[0], rows.slice(0, 3), "LOLOS")).toBe(false);
  });

  it("reads rejected ideas on this Angle before sibling Angles", () => {
    const validation = classifyLegacyIdea("Penugasan proyek berdasarkan skor individu", ANGLE, NOW);
    const sibling = classifyLegacyIdea("Promosi berdasarkan metrik individu", ANGLE, NOW);
    const items = failureItemsFromIdeas(
      [
        { code: "ID09", statement: sibling.decisionReason, angleId: "other", admission: "GENERATE_REJECT", validation: sibling },
        { code: "ID01", statement: "Penugasan proyek berdasarkan skor individu", angleId: "angle-1", admission: "GENERATE_REJECT", validation },
      ],
      "angle-1",
    );
    expect(items.map((item) => item.code)).toEqual(["ID01", "ID09"]);
    expect(items[0]?.sameAngle).toBe(true);
    expect(items[0]?.failed.map((failed) => failed.id)).toEqual(["K1"]);
    expect(items[0]?.failed[0]?.reason).toContain("This is not a how-if proposal.");
  });

  it("puts the stored failure into the next generate prompt", () => {
    const prompt = buildIdeaGeneratePrompt({
      parentStatement: ANGLE,
      incumbents: [],
      needed: 1,
      failures: [
        {
          code: "ID01",
          statement: "Penugasan proyek berdasarkan skor individu",
          angleId: "angle-1",
          sameAngle: true,
          failed: [{ id: "K1", reason: "This is not a how-if proposal." }],
        },
      ],
    });
    expect(prompt).toContain('Begin the statement with "Bagaimana jika".');
    expect(prompt).toContain("Penugasan proyek berdasarkan skor individu");
    expect(prompt).toContain("K1 FAIL: This is not a how-if proposal.");
    expect(prompt).toContain("Similar words alone are not a repeat.");
    expect(prompt).toContain("only a fact, an insight, a problem");
  });

  it("checks K1 through K7 one requirement at a time", async () => {
    const statement = "Bagaimana jika penugasan proyek memakai skor tim?";
    const seen: string[] = [];
    const frames: string[] = [];
    const validation = await runIdeaPassChecks({
      statement,
      title: "Skor tim",
      concept: "Skor tim",
      mechanism: "Tugas dibagi menurut hasil tim",
      value: "Orang tidak dipilah sendirian",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      validatedAt: NOW,
      onStep: (checks) => {
        frames.push(checks.map((check) => `${check.id}:${check.state}`).join(" "));
      },
      ask: async (prompt) => {
        const id = prompt.match(/Decide check (K\d)/)?.[1] ?? "";
        seen.push(id);
        return auditPass(id);
      },
    });
    expect(seen).toEqual(["K1", "K2", "K3", "K4", "K6", "K7"]);
    expect(frames[0]).toBe("K1:pending K2:pending K3:pending K4:pending K5:pending K6:pending K7:pending");
    expect(frames.some((frame) => frame.startsWith("K1:running") && frame.includes("K2:pending"))).toBe(true);
    expect(frames[frames.length - 1]).toBe("K1:pass K2:pass K3:pass K4:pass K5:pass K6:pass K7:pass");
    expect(validation.decision).toBe("LOLOS");
  });

  it("shows the failed requirement and stops there", async () => {
    const asked: string[] = [];
    const validation = await runIdeaPassChecks({
      statement: "Penugasan proyek berdasarkan skor individu",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      validatedAt: NOW,
      ask: async (prompt) => {
        asked.push(prompt);
        return JSON.stringify({ pass: true, reason: "" });
      },
    });
    expect(asked).toEqual([]);
    expect(validation.decision).toBe("DITOLAK");
    expect(validation.criteria.find((criterion) => criterion.id === "K1")?.status).toBe("FAIL");
    expect(validation.criteria.filter((criterion) => criterion.id !== "K1").every((criterion) => criterion.status === "BELUM_TERVERIFIKASI")).toBe(true);
  });

  it("counts passed, rejected, and the criterion that fails most often", () => {
    const rejected = classifyLegacyIdea("Penugasan proyek berdasarkan skor individu", ANGLE, NOW);
    const passed = classifyLegacyIdea("Bagaimana jika penugasan memakai skor tim?", ANGLE, NOW);
    const summary = ideaHistorySummary([
      { ...passed, decision: "LOLOS", criteria: passedCriteria() },
      rejected,
      rejected,
    ]);
    expect(summary).toMatchObject({ passed: 1, rejected: 2, unverified: 0, topFailed: "K1" });
  });

  it("does not pass a criterion that has no evidence", async () => {
    const validation = await runIdeaPassChecks({
      statement: "Bagaimana jika penugasan proyek memakai skor tim?",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      validatedAt: NOW,
      ask: async () => JSON.stringify({ pass: true, reason: "" }),
    });
    expect(validation.decision).toBe("BELUM_TERVERIFIKASI");
    expect(validation.criteria.every((criterion) => criterion.status === "BELUM_TERVERIFIKASI")).toBe(true);
  });

  it("stops at the first unverified requirement and teaches that sentence", async () => {
    const statement = "Bagaimana jika penugasan memakai skor tim?";
    const asked: string[] = [];
    const validation = await runIdeaPassChecks({
      statement,
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      validatedAt: NOW,
      ask: async (prompt) => {
        asked.push(prompt);
        const id = prompt.match(/Decide check (K\d)/)?.[1];
        if (id === "K3") return JSON.stringify({ status: "BELUM_TERVERIFIKASI", reason: "Asumsi data tim belum jelas." });
        return JSON.stringify({ pass: true, reason: "Mekanisme tim menutup syarat ini." });
      },
    });
    expect(asked).toHaveLength(3);
    expect(validation.criteria.find((criterion) => criterion.id === "K3")).toMatchObject({
      status: "BELUM_TERVERIFIKASI",
      explanation: "Asumsi data tim belum jelas.",
    });
    expect(validation.criteria.find((criterion) => criterion.id === "K3")?.reason).toContain("STATUS: BELUM_TERVERIFIKASI");
    expect(validation.criteria.find((criterion) => criterion.id === "K4")?.explanation).toBe("");
    expect(validation.decision).toBe("BELUM_TERVERIFIKASI");
    expect(checksFromValidation(validation).find((check) => check.id === "K3")?.reason).toBe("Asumsi data tim belum jelas.");
    expect(checksFromValidation(validation).find((check) => check.id === "K3")?.state).toBe("fail");
    expect(checksFromValidation(validation).find((check) => check.id === "K4")?.state).toBe("pending");
    expect(checksFromValidation(validation).find((check) => check.id === "K4")?.reason).toBeUndefined();
    const items = failureItemsFromIdeas(
      [{ code: "ID03", statement, angleId: "angle-1", admission: "UNRESOLVED", validation }],
      "angle-1",
    );
    const prompt = buildIdeaGeneratePrompt({
      parentStatement: ANGLE,
      incumbents: [],
      needed: 1,
      failures: items,
    });
    expect(prompt).toContain("K3 BELUM_TERVERIFIKASI: Asumsi data tim belum jelas.");
    expect(prompt).not.toContain("STATUS:");
  });

  it("asks once more only when the answer cannot be read", async () => {
    let calls = 0;
    const validation = await runIdeaPassChecks({
      statement: "Bagaimana jika penugasan memakai skor tim?",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      validatedAt: NOW,
      ask: async () => {
        calls += 1;
        if (calls === 1) return "not json";
        return JSON.stringify({ pass: false, reason: "Mekanismenya belum konkret." });
      },
    });
    expect(calls).toBe(2);
    expect(validation.criteria.find((criterion) => criterion.id === "K1")).toMatchObject({
      status: "FAIL",
      explanation: "Mekanismenya belum konkret.",
    });
    expect(validation.criteria.find((criterion) => criterion.id === "K2")?.status).toBe("BELUM_TERVERIFIKASI");
    expect(validation.criteria.find((criterion) => criterion.id === "K1")?.reason).toContain("STATUS: FAIL");
    expect(checksFromValidation(validation).find((check) => check.id === "K1")?.reason).toBe("Mekanismenya belum konkret.");
  });

  it("does not ask again when the model says the check is unverified", async () => {
    let calls = 0;
    const validation = await runIdeaPassChecks({
      statement: "Bagaimana jika penugasan memakai skor tim?",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      validatedAt: NOW,
      ask: async () => {
        calls += 1;
        return JSON.stringify({ status: "BELUM_TERVERIFIKASI", reason: "Asumsi data tim belum jelas." });
      },
    });
    expect(calls).toBe(1);
    expect(validation.decision).toBe("BELUM_TERVERIFIKASI");
    expect(validation.criteria.find((criterion) => criterion.id === "K1")?.explanation).toBe("Asumsi data tim belum jelas.");
  });

  const passSentence = JSON.stringify({ pass: true, reason: "Mekanisme tim menutup syarat ini." });

  it("lets a legally binding commitment pass K2 when the mechanism is accepted", async () => {
    const asked: string[] = [];
    const validation = await runIdeaPassChecks({
      statement: "Bagaimana jika Presiden membuat komitmen yang mengikat secara hukum?",
      mechanism: "Komitmen diumumkan kepada publik.",
      value: "Perizinan lebih mudah diprediksi.",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      validatedAt: NOW,
      ask: async (prompt) => {
        const id = prompt.match(/Decide check (K\d)/)?.[1] ?? "";
        asked.push(id);
        if (id === "K3") return JSON.stringify({ status: "BELUM_TERVERIFIKASI", reason: "Berhenti setelah K2." });
        return passSentence;
      },
    });
    expect(asked).toEqual(["K1", "K2", "K3"]);
    expect(validation.criteria.find((criterion) => criterion.id === "K2")?.status).toBe("PASS");
    expect(validation.criteria.find((criterion) => criterion.id === "K2")?.explanation).toBe("Mekanisme tim menutup syarat ini.");
  });

  it("does not reject a policy idea that does not claim a legally binding commitment", async () => {
    const asked: string[] = [];
    const validation = await runIdeaPassChecks({
      statement: "Bagaimana jika setiap perubahan regulasi perizinan dijelaskan kepada publik?",
      mechanism: "Pemerintah mempublikasikan alasan perubahan.",
      value: "Pelaku usaha dapat membaca alasan perubahan sebelum aturan berlaku.",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      validatedAt: NOW,
      ask: async (prompt) => {
        const id = prompt.match(/Decide check (K\d)/)?.[1] ?? "";
        asked.push(id);
        if (id === "K1") return passSentence;
        return JSON.stringify({ status: "BELUM_TERVERIFIKASI", reason: "Mekanismenya masih umum." });
      },
    });
    expect(asked).toEqual(["K1", "K2"]);
    expect(validation.decision).toBe("BELUM_TERVERIFIKASI");
    expect(validation.criteria.find((criterion) => criterion.id === "K1")?.status).toBe("PASS");
  });

  it("lets K3 pass when the stated value is a leadership judgment", async () => {
    const asked: string[] = [];
    const validation = await runIdeaPassChecks({
      statement: "Bagaimana jika setiap perubahan regulasi disertai justifikasi publik?",
      mechanism: "Pemerintah mempublikasikan justifikasi perubahan regulasi perizinan.",
      value: "Mekanisme ini secara langsung akan menguji dan mengekspos efektivitas kepemimpinan.",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      validatedAt: NOW,
      ask: async (prompt) => {
        const id = prompt.match(/Decide check (K\d)/)?.[1] ?? "";
        asked.push(id);
        if (id === "K4") return JSON.stringify({ status: "BELUM_TERVERIFIKASI", reason: "Berhenti setelah K3." });
        return passSentence;
      },
    });
    expect(asked).toEqual(["K1", "K2", "K3", "K4"]);
    expect(validation.criteria.find((criterion) => criterion.id === "K3")?.status).toBe("PASS");
    expect(validation.criteria.find((criterion) => criterion.id === "K3")?.explanation).toBe("Mekanisme tim menutup syarat ini.");
  });

  it("does not pass K5 when the reason never names a passed idea", async () => {
    const asked: string[] = [];
    const validation = await runIdeaPassChecks({
      statement: "Bagaimana jika setiap perubahan regulasi disertai penjelasan publik?",
      mechanism: "Pemerintah menjelaskan urgensi, dampak, dan alasan perubahan tidak ditunda.",
      value: "Konsistensi kebijakan dapat dievaluasi secara terbuka.",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      peers: [
        {
          code: "ID04",
          statement: "Bagaimana jika penugasan memakai skor tim?",
          concept: "Skor tim",
          mechanism: "Tugas dibagi menurut hasil tim",
          value: "Orang tidak dipilah sendirian",
          decision: "LOLOS",
        },
      ],
      validatedAt: NOW,
      ask: async (prompt) => {
        const id = prompt.match(/Decide check (K\d)/)?.[1] ?? "";
        asked.push(id);
        if (id === "K5") return JSON.stringify({ pass: true, reason: "Mekanisme ini secara unik mengikat Presiden pada komitmen stabilitas regulasi." });
        return passSentence;
      },
    });
    expect(asked).toContain("K5");
    expect(asked).not.toContain("K6");
    expect(validation.criteria.find((criterion) => criterion.id === "K5")?.status).toBe("BELUM_TERVERIFIKASI");
    expect(validation.criteria.find((criterion) => criterion.id === "K5")?.explanation).toContain("lolos");
    expect(validation.decision).toBe("BELUM_TERVERIFIKASI");
  });

  it("passes K5 without a comparison until one idea has passed", async () => {
    const asked: string[] = [];
    const validation = await runIdeaPassChecks({
      statement: "Bagaimana jika setiap perubahan regulasi disertai penjelasan publik?",
      mechanism: "Pemerintah menjelaskan urgensi, dampak, dan alasan perubahan tidak ditunda.",
      value: "Konsistensi kebijakan dapat dievaluasi secara terbuka.",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      peers: [
        {
          code: "ID02",
          statement: "Bagaimana jika jadwal anak disusun dari rencana masa depan?",
          concept: "Jadwal masa depan",
          mechanism: "Rencana jangka panjang mengisi minggu anak",
          value: "Masa depan terlihat lebih dulu",
          decision: "DITOLAK",
        },
      ],
      validatedAt: NOW,
      ask: async (prompt) => {
        const id = prompt.match(/Decide check (K\d)/)?.[1] ?? "";
        asked.push(id);
        if (id === "K5") return JSON.stringify({ status: "BELUM_TERVERIFIKASI", reason: "Tidak ada bukti perbandingan." });
        return passSentence;
      },
    });
    expect(asked).not.toContain("K5");
    expect(validation.criteria.find((criterion) => criterion.id === "K5")?.status).toBe("PASS");
    expect(validation.criteria.find((criterion) => criterion.id === "K5")?.explanation).toContain("belum berlaku");
    expect(asked).toContain("K6");
  });

  it("does not compare K5 with a passed idea on another angle", async () => {
    const asked: string[] = [];
    const validation = await runIdeaPassChecks({
      statement: "Bagaimana jika setiap perubahan regulasi disertai penjelasan publik?",
      mechanism: "Pemerintah menjelaskan urgensi, dampak, dan alasan perubahan tidak ditunda.",
      value: "Konsistensi kebijakan dapat dievaluasi secara terbuka.",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      peers: [
        {
          code: "ID03",
          statement: "Bagaimana jika ibu menanyakan keinginan anak sebelum aktivitas dimulai?",
          concept: "Keinginan anak",
          mechanism: "Ibu bertanya lalu mengubah aktivitas",
          value: "Pilihan ibu mengikuti keinginan anak",
          decision: "LOLOS",
          sameAngle: false,
        },
      ],
      validatedAt: NOW,
      ask: async (prompt) => {
        const id = prompt.match(/Decide check (K\d)/)?.[1] ?? "";
        asked.push(id);
        if (id === "K5") return JSON.stringify({ status: "BELUM_TERVERIFIKASI", reason: "Tidak ada bukti perbandingan dengan ide yang sudah lolos." });
        return passSentence;
      },
    });
    expect(asked).not.toContain("K5");
    expect(validation.criteria.find((criterion) => criterion.id === "K5")?.status).toBe("PASS");
    expect(validation.criteria.find((criterion) => criterion.id === "K5")?.explanation).toContain("belum berlaku");
    expect(validation.criteria.find((criterion) => criterion.id === "K5")?.explanation).not.toContain("bukti perbandingan");
  });

  it("repairs only the failed requirements and keeps the ones that already passed", async () => {
    const asked: string[] = [];
    const kept = passedCriteria().map((criterion) =>
      criterion.id === "K5"
        ? { ...criterion, status: "FAIL" as const, explanation: "Konsepnya sama dengan ide yang sudah lolos.", reason: "Konsepnya sama dengan ide yang sudah lolos." }
        : criterion.id === "K6" || criterion.id === "K7"
          ? { ...criterion, status: "BELUM_TERVERIFIKASI" as const, explanation: "", reason: "", evidence: "", weakness: "" }
          : criterion,
    );
    const validation = await runIdeaPassChecks({
      statement: "Bagaimana jika setiap perubahan regulasi disertai penjelasan publik?",
      mechanism: "Pemerintah menjelaskan urgensi, dampak, dan alasan perubahan tidak ditunda.",
      value: "Konsistensi kebijakan dapat dievaluasi secara terbuka.",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      keptPasses: kept,
      validatedAt: NOW,
      ask: async (prompt) => {
        const id = prompt.match(/Decide check (K\d)/)?.[1] ?? "";
        asked.push(id);
        if (id === "K6") return auditPass(id);
        return passSentence;
      },
    });
    expect(asked).toEqual(["K6", "K7"]);
    expect(validation.criteria.find((criterion) => criterion.id === "K1")?.explanation).toBe("K1 terbukti pada gagasan ini.");
    expect(validation.criteria.find((criterion) => criterion.id === "K4")?.status).toBe("PASS");
    expect(validation.criteria.find((criterion) => criterion.id === "K5")?.status).toBe("PASS");
    expect(validation.decision).toBe("LOLOS");
    const prompt = buildIdeaRevisionPrompt({
      angle: ANGLE,
      statement: "Bagaimana jika setiap perubahan regulasi disertai penjelasan publik?",
      failed: [{ id: "K5", reason: "Konsepnya sama dengan ide yang sudah lolos." }],
      passed: [{ id: "K1", reason: "K1 terbukti pada gagasan ini." }],
      revision: 1,
    });
    expect(prompt).toContain("Repair this same Idea");
    expect(prompt).toContain("Failed requirements to repair:");
    expect(prompt).toContain("K5: Konsepnya sama dengan ide yang sudah lolos.");
    expect(prompt).not.toContain("new proposal");
  });

  it("does not pass K6 when the answer only names Master Thought, Big Thought, and Territory", async () => {
    const validation = await runIdeaPassChecks({
      statement: "Bagaimana jika setiap perubahan regulasi disertai penjelasan publik?",
      mechanism: "Pemerintah menjelaskan urgensi, dampak, dan alasan perubahan tidak ditunda.",
      value: "Konsistensi kebijakan dapat dievaluasi secara terbuka.",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      validatedAt: NOW,
      ask: async (prompt) => {
        const id = prompt.match(/Decide check (K\d)/)?.[1] ?? "";
        if (id === "K6") {
          return JSON.stringify({
            pass: true,
            reason: "Ide ini terkait dengan Master Thought, Big Thought, dan Territory.",
          });
        }
        return passSentence;
      },
    });
    expect(validation.criteria.find((criterion) => criterion.id === "K6")?.status).toBe("BELUM_TERVERIFIKASI");
    expect(validation.criteria.find((criterion) => criterion.id === "K6")?.explanation).toContain("isi tersimpan");
    expect(validation.criteria.find((criterion) => criterion.id === "K7")?.explanation).toBe("");
    expect(validation.decision).toBe("BELUM_TERVERIFIKASI");
  });

  it("asks K7 with the stored audience even when the audience field is empty", async () => {
    const prompts: string[] = [];
    const validation = await runIdeaPassChecks({
      statement: "Bagaimana jika ibu menulis satu baris tentang anaknya setiap malam?",
      mechanism: "Satu baris ditulis saat anak sudah tidur.",
      value: "Ibu melihat kebutuhan anak hari ini tanpa jurnal panjang.",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: "Seorang ibu yang bekerja ingin tetap menjadi ibu yang baik.",
      audience: "",
      priorBelief: "",
      rootBelief: "",
      failures: [],
      validatedAt: NOW,
      ask: async (prompt) => {
        const id = prompt.match(/Decide check (K\d)/)?.[1] ?? "";
        if (id === "K7") prompts.push(prompt);
        if (id === "K6") {
          return JSON.stringify({
            pass: true,
            reason: "Hubungan ketiga konteks ditunjukkan.",
            masterThoughtLink: "Seorang ibu yang bekerja ingin tetap menjadi ibu yang baik, dan ide ini menolong ibu itu.",
            bigThoughtLink: "Integrasi fungsi bisnis muncul saat tugas dibagi bersama.",
            territoryLink: "Kinerja karyawan berubah lewat cara penugasan.",
          });
        }
        return passSentence;
      },
    });
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("Audience: (not stored)");
    expect(prompts[0]).toContain("Seorang ibu yang bekerja");
    expect(prompts[0]).toContain("Do not invent an audience");
    expect(prompts[0]).toContain("not yet common is not automatically unrealistic");
    expect(prompts[0]).toContain("what this audience already does and what is still missing");
    expect(prompts[0]).toContain("cannot prepare from their current conditions");
    expect(prompts[0]).toContain("A short action inside time this audience already spends is a realistic way to adopt it.");
    expect(prompts[0]).toContain("Do not treat the idea's own boundary as the obstacle.");
    const mechanism = buildIdeaCriterionPrompt({
      id: "K2",
      statement: "Bagaimana jika aplikasi menganalisis jadwal anak secara otomatis?",
      title: "Asisten jadwal",
      concept: "Aplikasi menganalisis jadwal",
      mechanism: "Fitur otomatis menghitung proporsi waktu dan mengirim saran.",
      value: "Ibu melihat keseimbangan tanpa kebiasaan baru.",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
    });
    expect(mechanism).toContain("specific action people already do in ordinary life");
    expect(mechanism).toContain("automatic analysis");
    expect(mechanism).toContain("only restates the proposed product is not evidence");
    expect(validation.criteria.find((criterion) => criterion.id === "K7")?.status).toBe("PASS");
  });

  it("keeps K7 unverified when the model cannot find a stored audience", async () => {
    const validation = await runIdeaPassChecks({
      statement: "Bagaimana jika ibu menulis jurnal panjang setiap hari?",
      mechanism: "Seluruh pengalaman emosional anak dicatat setiap malam.",
      value: "Ibu memahami anaknya secara utuh.",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      audience: "",
      priorBelief: "",
      rootBelief: "",
      failures: [],
      validatedAt: NOW,
      ask: async (prompt) => {
        const id = prompt.match(/Decide check (K\d)/)?.[1] ?? "";
        if (id === "K7") {
          return JSON.stringify({
            status: "BELUM_TERVERIFIKASI",
            reason: "Audiens Master Thought perlu diisi sebelum kelayakan kebiasaan ini diperiksa.",
          });
        }
        if (id === "K6") {
          return JSON.stringify({
            pass: true,
            reason: "Hubungan ketiga konteks ditunjukkan.",
            masterThoughtLink: `${MASTER}, dan ide ini menolong keyakinan itu.`,
            bigThoughtLink: `${BIG} muncul saat tugas dibagi bersama.`,
            territoryLink: `${TERRITORY} berubah lewat cara penugasan.`,
          });
        }
        return passSentence;
      },
    });
    expect(validation.criteria.find((criterion) => criterion.id === "K7")?.status).toBe("BELUM_TERVERIFIKASI");
    expect(validation.criteria.find((criterion) => criterion.id === "K7")?.explanation).toContain("Audiens Master Thought");
    expect(validation.decision).toBe("BELUM_TERVERIFIKASI");
  });

  it("keeps the strongest idea and stores the duplicate concept", async () => {
    const keeperStatement = "Bagaimana jika penugasan memakai skor tim?";
    const copyStatement = "Bagaimana jika papan menampilkan skor tim?";
    const keeper = await judgeIdeaValidation({
      statement: keeperStatement,
      title: "Skor tim",
      concept: "Skor tim menggantikan skor orang",
      mechanism: "Tugas dibagi menurut hasil tim",
      value: "Orang tidak dipilah sendirian",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      validatedAt: NOW,
      ask: async () => JSON.stringify({ criteria: passedCriteria() }),
    });
    const copy = await judgeIdeaValidation({
      statement: copyStatement,
      title: "Papan skor",
      concept: "Skor tim menggantikan skor orang",
      mechanism: "Dashboard menampilkan hasil tim",
      value: "Orang tidak dipilah sendirian",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      validatedAt: NOW,
      ask: async () => JSON.stringify({ criteria: passedCriteria() }),
    });
    const prompt = buildCrossIdeaPrompt(
      [
        { code: "ID01", statement: keeperStatement, concept: keeper.concept, mechanism: keeper.mechanism, value: keeper.value, validation: keeper },
        { code: "ID02", statement: copyStatement, concept: copy.concept, mechanism: copy.mechanism, value: copy.value, validation: copy },
      ],
      [],
    );
    expect(prompt).toContain("same Big Thought is not the same concept");
    expect(prompt).toContain("visualization");
    const applied = applyCrossIdeaGroups(
      [
        { code: "ID01", statement: keeperStatement, concept: keeper.concept, mechanism: keeper.mechanism, value: keeper.value, validation: keeper },
        { code: "ID02", statement: copyStatement, concept: copy.concept, mechanism: copy.mechanism, value: copy.value, validation: copy },
      ],
      [{ id: "stored-1", code: "ID09", statement: "Bagaimana jika giliran kerja dibagi menurut hasil tim?", concept: "Giliran", mechanism: "Jadwal", value: "Beban merata", validation: keeper }],
      {
        groups: [
          {
            keeperCode: "ID01",
            duplicates: [
              {
                code: "ID02",
                comparedCode: "ID01",
                sameConcept: "Skor tim menggantikan skor orang",
                overlappingMechanism: "Hasil tim tetap menjadi dasar penugasan",
                overlappingValue: "Orang tidak dipilah sendirian",
                reason: "Hanya cara menampilkan skor yang berubah.",
              },
            ],
          },
        ],
      },
    );
    expect(applied?.[0]?.validation.decision).toBe("LOLOS");
    expect(applied?.[0]?.validation.crossIdea).toBe("PASS");
    const rejected = applied?.[1]?.validation;
    expect(rejected?.decision).toBe("DITOLAK");
    expect(rejected?.classification).toBe("DUPLICATE_CONCEPT");
    expect(rejected?.duplicate).toMatchObject({
      code: "DUPLICATE_CONCEPT",
      comparedIdeaId: "",
      comparedCode: "ID01",
      comparedStatement: keeperStatement,
      sameConcept: "Skor tim menggantikan skor orang",
      overlappingMechanism: "Hasil tim tetap menjadi dasar penugasan",
      overlappingValue: "Orang tidak dipilah sendirian",
      reason: "Hanya cara menampilkan skor yang berubah.",
    });
    expect(rejected?.criteria.find((criterion) => criterion.id === "K5")?.reason).toContain("DUPLICATE_CONCEPT");
    const stored = readIdeaValidation({ ...rejected, schema: rejected?.schema, generatorVersion: rejected?.generatorVersion });
    expect(stored?.duplicate?.comparedCode).toBe("ID01");
  });

  it("does not reject two ideas that only share a topic", async () => {
    const first = await judgeIdeaValidation({
      statement: "Bagaimana jika penugasan memakai skor tim?",
      concept: "Skor tim",
      mechanism: "Tugas dibagi menurut hasil tim",
      value: "Orang tidak dipilah sendirian",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      validatedAt: NOW,
      ask: async () => JSON.stringify({ criteria: passedCriteria() }),
    });
    const second = await judgeIdeaValidation({
      statement: "Bagaimana jika giliran kerja dibagi menurut hasil tim?",
      concept: "Giliran kerja",
      mechanism: "Jadwal bergilir menutup antrean",
      value: "Beban terasa merata",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      validatedAt: NOW,
      ask: async () => JSON.stringify({ criteria: passedCriteria() }),
    });
    const settled = await judgeCrossIdeas({
      candidates: [
        { code: "ID01", statement: first.concept, concept: "Skor tim", mechanism: "Tugas dibagi menurut hasil tim", value: "Orang tidak dipilah sendirian", validation: first },
        { code: "ID02", statement: second.concept, concept: "Giliran kerja", mechanism: "Jadwal bergilir menutup antrean", value: "Beban terasa merata", validation: second },
      ],
      peers: [],
      ask: async () => JSON.stringify({ groups: [] }),
    });
    expect(settled.map((row) => row.validation.decision)).toEqual(["LOLOS", "LOLOS"]);
    expect(settled.every((row) => row.validation.duplicate === null)).toBe(true);
  });

  it("does not invent a duplicate when the comparison cannot be checked", async () => {
    const validation = await judgeIdeaValidation({
      statement: "Bagaimana jika penugasan memakai skor tim?",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      validatedAt: NOW,
      ask: async () => JSON.stringify({ criteria: passedCriteria() }),
    });
    const settled = await judgeCrossIdeas({
      candidates: [
        {
          code: "ID01",
          statement: "Bagaimana jika penugasan memakai skor tim?",
          concept: "Skor tim",
          mechanism: "Tugas dibagi menurut hasil tim",
          value: "Orang tidak dipilah sendirian",
          validation,
        },
      ],
      peers: [],
      ask: async () => "bukan json",
    });
    expect(settled[0]?.validation.decision).toBe("BELUM_TERVERIFIKASI");
    expect(settled[0]?.validation.crossIdea).toBe("BELUM_TERVERIFIKASI");
    expect(settled[0]?.validation.duplicate).toBeNull();
    expect(settled[0]?.validation.classification).not.toBe("DUPLICATE_CONCEPT");
  });

  it("does not reject a duplicate that has no evidence", async () => {
    const validation = await judgeIdeaValidation({
      statement: "Bagaimana jika penugasan memakai skor tim?",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      validatedAt: NOW,
      ask: async () => JSON.stringify({ criteria: passedCriteria() }),
    });
    const candidates = [
      {
        code: "ID01",
        statement: "Bagaimana jika penugasan memakai skor tim?",
        concept: "Skor tim",
        mechanism: "Tugas dibagi menurut hasil tim",
        value: "Orang tidak dipilah sendirian",
        validation,
      },
      {
        code: "ID02",
        statement: "Bagaimana jika papan menampilkan skor tim?",
        concept: "Skor tim",
        mechanism: "Dashboard",
        value: "Orang tidak dipilah sendirian",
        validation,
      },
    ];
    const applied = applyCrossIdeaGroups(candidates, [], {
      groups: [
        {
          keeperCode: "ID01",
          duplicates: [
            {
              code: "ID02",
              comparedCode: "ID01",
              sameConcept: "",
              overlappingMechanism: "Dashboard",
              overlappingValue: "Orang tidak dipilah sendirian",
              reason: "Mirip.",
            },
          ],
        },
      ],
    });
    expect(applied?.every((row) => row.validation.decision === "LOLOS")).toBe(true);
    expect(applied?.every((row) => row.validation.duplicate === null)).toBe(true);
  });

  it("puts the stored duplicate into the next generate prompt", () => {
    const prompt = buildIdeaGeneratePrompt({
      parentStatement: ANGLE,
      incumbents: [],
      needed: 1,
      failures: [
        {
          code: "ID02",
          statement: "Bagaimana jika dashboard menampilkan skor individu?",
          angleId: "angle-1",
          sameAngle: true,
          failed: [{ id: "K5", reason: "Hanya visualisasi yang berbeda." }],
          duplicate: {
            code: "DUPLICATE_CONCEPT",
            comparedIdeaId: "idea-1",
            comparedCode: "ID01",
            comparedStatement: "Bagaimana jika papan skor menampilkan skor individu?",
            sameConcept: "skor individu",
            overlappingMechanism: "menampilkan skor",
            overlappingValue: "melihat angka sendiri",
            reason: "Hanya visualisasi yang berbeda.",
          },
        },
      ],
    });
    expect(prompt).toContain("DUPLICATE_CONCEPT");
    expect(prompt).toContain("idea-1");
    expect(prompt).toContain("ID01");
    expect(prompt).toContain("Bagaimana jika papan skor menampilkan skor individu?");
    expect(prompt).toContain("Same concept: skor individu");
    expect(prompt).toContain("Overlapping mechanism: menampilkan skor");
    expect(prompt).toContain("Overlapping value: melihat angka sendiri");
    expect(prompt).toContain("Hanya visualisasi yang berbeda.");
    const criterion = buildIdeaCriterionPrompt({
      id: "K5",
      statement: "Bagaimana jika bagan menampilkan skor individu?",
      title: "Bagan",
      concept: "skor individu",
      mechanism: "bagan",
      value: "melihat angka sendiri",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      peers: [
        {
          code: "ID01",
          statement: "Bagaimana jika papan skor menampilkan skor individu?",
          concept: "skor individu",
          mechanism: "papan skor",
          value: "melihat angka sendiri",
          decision: "LOLOS",
        },
      ],
    });
    expect(criterion).toContain("the visualization");
    expect(criterion).toContain("emphasis of the communication");
    expect(criterion).toContain("not yet verified");
    expect(criterion).toContain("same Big Thought is not a failure");
    expect(criterion).toContain("ID01 (LOLOS)");
  });

  it("does not pass when the only evidence is the idea sentence", () => {
    const statement = "Bagaimana jika penugasan memakai skor tim?";
    const parsed = parseIdeaCriterion(
      JSON.stringify({
        status: "PASS",
        evidence: statement,
        explanation: "Kalimat ini sudah berbentuk usulan.",
        weakness: "Belum ada bagian yang lebih spesifik.",
      }),
      { statement },
    );
    expect(parsed.status).toBe("BELUM_TERVERIFIKASI");
    expect(parsed.explanation).toContain("repeats the idea sentence");
  });

  it("keeps the K6 quotes in the sentence that is shown", () => {
    const parsed = parseIdeaCriterion(
      JSON.stringify({
        pass: true,
        reason: "Ide ini sesuai dengan masalah yang diangkat oleh Angle.",
        masterThoughtLink: "dia ibu yang baik sedunia, dan cek-in ini menolong ibu itu.",
        bigThoughtLink: "Prioritas Anak muncul saat momen kini ikut dipilih.",
        territoryLink: "Pilihan ibu berubah lewat waktu singkat bersama anak.",
      }),
      { statement: "Bagaimana jika ibu mendedikasikan waktu singkat setiap hari?", requireContextLinks: true },
    );
    expect(parsed.status).toBe("PASS");
    expect(parsed.explanation).toContain("Master Thought link: dia ibu yang baik sedunia");
    expect(parsed.explanation).toContain("Big Thought link: Prioritas Anak");
    expect(parsed.explanation).toContain("Territory link: Pilihan ibu");
    expect(lessonSentence(parsed)).toContain("Master Thought link: dia ibu yang baik sedunia");
  });

  it("keeps K5 unverified when the comparison history could not be loaded", async () => {
    const validation = await runIdeaPassChecks({
      statement: "Bagaimana jika penugasan memakai skor tim?",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      historyAvailable: false,
      validatedAt: NOW,
      ask: async (prompt) => {
        const id = prompt.match(/Decide check (K\d)/)?.[1] ?? "K1";
        return auditPass(id);
      },
    });
    expect(validation.criteria.find((criterion) => criterion.id === "K5")?.status).toBe("BELUM_TERVERIFIKASI");
    expect(validation.criteria.find((criterion) => criterion.id === "K5")?.explanation).toContain("could not be loaded");
    expect(validation.decision).toBe("BELUM_TERVERIFIKASI");
    expect(auditVerdictForValidation(validation)).toBe("UNRESOLVED");
  });

  it("does not claim a cross-idea pass when the history could not be loaded", async () => {
    const validation = await judgeIdeaValidation({
      statement: "Bagaimana jika penugasan memakai skor tim?",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      validatedAt: NOW,
      ask: async () => JSON.stringify({ criteria: passedCriteria() }),
    });
    const [settled] = await judgeCrossIdeas({
      candidates: [
        {
          code: "ID01",
          statement: "Bagaimana jika penugasan memakai skor tim?",
          concept: "Skor tim",
          mechanism: "Tugas dibagi menurut hasil tim",
          value: "Orang tidak dipilah sendirian",
          validation,
        },
      ],
      peers: [],
      historyAvailable: false,
      ask: async () => JSON.stringify({ groups: [] }),
    });
    expect(settled?.validation.decision).toBe("BELUM_TERVERIFIKASI");
    expect(settled?.validation.decisionReason).toContain("could not be loaded");
    expect(settled?.validation.crossIdea).toBe("BELUM_TERVERIFIKASI");
  });

  it("gives AUDIT_PASS only when all seven criteria pass", async () => {
    const validation = await judgeIdeaValidation({
      statement: "Bagaimana jika penugasan memakai skor tim?",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      validatedAt: NOW,
      ask: async () => JSON.stringify({ criteria: passedCriteria() }),
    });
    expect(auditVerdictForValidation(validation)).toBe("AUDIT_PASS");
    const rejected = {
      ...validation,
      decision: "DITOLAK" as const,
      criteria: validation.criteria.map((criterion) =>
        criterion.id === "K4" ? { ...criterion, status: "FAIL" as const } : criterion,
      ),
    };
    expect(auditVerdictForValidation(rejected)).toBe("AUDIT_FAIL");
  });

  it("keeps the previous audit when a new one is linked", async () => {
    const first = await judgeIdeaValidation({
      statement: "Bagaimana jika penugasan memakai skor tim?",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      validatedAt: NOW,
      ask: async () => JSON.stringify({ criteria: passedCriteria() }),
    });
    const second = await judgeIdeaValidation({
      statement: "Bagaimana jika giliran kerja dibagi menurut hasil tim?",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      validatedAt: "2026-10-24T01:00:00.000Z",
      ask: async () => JSON.stringify({ criteria: passedCriteria() }),
    });
    const linked = withAuditHistory({ ...first, statement: "Bagaimana jika penugasan memakai skor tim?" }, second);
    expect(linked.statement).toBe("Bagaimana jika giliran kerja dibagi menurut hasil tim?");
    expect(linked.auditHistory[0]?.statement).toBe("Bagaimana jika penugasan memakai skor tim?");
    expect(linked.auditHistory[0]?.validatedAt).toBe(NOW);
    expect(linked.validatorVersion).toBe("idea-audit/v2");
    const stored = readIdeaValidation({ ...linked, auditHistory: linked.auditHistory });
    expect(stored?.auditHistory[0]?.statement).toBe("Bagaimana jika penugasan memakai skor tim?");
    expect(stored?.statement).toBe(linked.statement);
  });

  it("keeps a failed requirement as a lesson after the same card passes", async () => {
    const passed = await judgeIdeaValidation({
      statement: "Bagaimana jika giliran kerja dibagi menurut hasil tim?",
      angle: ANGLE,
      territory: TERRITORY,
      bigThought: BIG,
      masterThought: MASTER,
      failures: [],
      validatedAt: NOW,
      ask: async () => JSON.stringify({ criteria: passedCriteria() }),
    });
    const failed = {
      ...passed,
      statement: "Bagaimana jika penugasan memakai skor individu?",
      decision: "DITOLAK" as const,
      criteria: passed.criteria.map((criterion) =>
        criterion.id === "K5"
          ? {
              ...criterion,
              status: "FAIL" as const,
              explanation: "Konsepnya sama dengan ide yang sudah lolos.",
              reason: "Konsepnya sama dengan ide yang sudah lolos.",
            }
          : criterion,
      ),
    };
    const current = { ...passed, auditHistory: [auditSnapshot(failed)] };
    const items = failureItemsFromIdeas(
      [{ code: "ID03", statement: current.statement, angleId: "angle-1", admission: "GENERATE_VALID", validation: current }],
      "angle-1",
    );
    expect(items.some((item) => item.failed.some((failedItem) => failedItem.id === "K5" && failedItem.reason.includes("sudah lolos")))).toBe(true);
    const prompt = buildIdeaGeneratePrompt({
      parentStatement: ANGLE,
      incumbents: [],
      needed: 1,
      failures: items,
    });
    expect(prompt).toContain("K5 FAIL: Konsepnya sama dengan ide yang sudah lolos.");
  });
});
