import { describe, expect, it } from "vitest";
import { imageSettingsForCreativeFormat } from "@/thinking-lab/creative-idea/formats";
import { buildCreativeGeneratePrompt, nextCreativeCode, parseCreativeDrafts } from "@/thinking-lab/creative-idea/generate";
import { developmentPathPatch, lockedPillarCards, mergeLockedPillar, readDevelopmentPaths, upsertDevelopmentPath } from "@/thinking-lab/creative-idea/paths";
import { mergePillarReviews, parsePillarReviews, reviewContentPillars, selectPillarReviewSet } from "@/thinking-lab/creative-idea/recommend";
import { creativeIdeaInsertRow } from "@/thinking-lab/creative-idea/repository";
import {
  canEnterExecution,
  creativeFailureItems,
  decideCreativeChecks,
  judgeCreativeDraft,
  sealCreativeValidation,
} from "@/thinking-lab/creative-idea/validation";
import { buildExecutionGeneratePrompt } from "@/thinking-lab/execution/generate";
import { buildImageGeneratePrompt } from "@/thinking-lab/execution/imageGenerate";
import type { CreativeCriterion, CreativeDraft, CreativeValidation, DevelopmentPath } from "@/thinking-lab/creative-idea/types";
import { CREATIVE_CRITERIA, CREATIVE_VALIDATION_SCHEMA } from "@/thinking-lab/creative-idea/types";

const PARENT = "Bagaimana jika skor individu diganti jejak kerja yang bisa ditunjuk.";

function checks(statuses: Array<CreativeCriterion["status"]>): CreativeCriterion[] {
  return CREATIVE_CRITERIA.map((id, index) => ({
    id,
    status: statuses[index] ?? "BELUM_TERVERIFIKASI",
    reason: statuses[index] === "PASS" ? `${id} holds.` : `${id} does not hold.`,
  }));
}

function draft(statement = "Bagaimana jika jejak kerja itu tampil sebagai tiga kartu."): CreativeDraft {
  return {
    title: "Tiga kartu",
    statement,
    concept: "Kartu jejak kerja",
    mechanism: "Satu kartu menunjukkan satu jejak",
    value: "Kinerja terlihat tanpa skor individu",
  };
}

function validation(decision: CreativeValidation["decision"]): CreativeValidation {
  const statuses = {
    READY: ["PASS", "PASS", "PASS", "PASS", "PASS"],
    NEEDS_REFINEMENT: ["PASS", "PASS", "PASS", "PASS", "FAIL"],
    REVISE: ["PASS", "PASS", "FAIL", "FAIL", "PASS"],
    REJECTED: ["FAIL", "PASS", "PASS", "PASS", "PASS"],
    NOT_VERIFIED: ["BELUM_TERVERIFIKASI", "PASS", "PASS", "PASS", "PASS"],
  } as const;
  return {
    schema: CREATIVE_VALIDATION_SCHEMA,
    criteria: checks([...statuses[decision]]),
    decision,
    recommendation: decision === "READY" ? "" : "Perbaiki mekanismenya.",
    title: "Tiga kartu",
    concept: "Kartu",
    mechanism: "Satu kartu",
    value: "Terlihat",
    generatorVersion: "creative-idea/v1",
    validatorVersion: "creative-audit/v1",
    validatedAt: "2026-10-25T00:00:00.000Z",
    statement: PARENT,
  };
}

describe("creative idea decisions", () => {
  it("keeps execution for five passes only", () => {
    expect(decideCreativeChecks(checks(["PASS", "PASS", "PASS", "PASS", "PASS"]))).toBe("READY");
    expect(canEnterExecution("READY")).toBe(true);
    expect(canEnterExecution("NEEDS_REFINEMENT")).toBe(false);
    expect(canEnterExecution("NOT_VERIFIED")).toBe(false);
  });

  it("rejects when CK1 or CK2 fails and holds execution when either is unverified", () => {
    expect(decideCreativeChecks(checks(["FAIL", "PASS", "PASS", "PASS", "PASS"]))).toBe("REJECTED");
    expect(decideCreativeChecks(checks(["PASS", "FAIL", "PASS", "PASS", "PASS"]))).toBe("REJECTED");
    expect(decideCreativeChecks(checks(["BELUM_TERVERIFIKASI", "PASS", "PASS", "PASS", "PASS"]))).toBe("NOT_VERIFIED");
    expect(decideCreativeChecks(checks(["PASS", "BELUM_TERVERIFIKASI", "PASS", "PASS", "PASS"]))).toBe("NOT_VERIFIED");
  });

  it("refines four passes and revises fewer when CK1 and CK2 pass", () => {
    expect(decideCreativeChecks(checks(["PASS", "PASS", "PASS", "PASS", "BELUM_TERVERIFIKASI"]))).toBe("NEEDS_REFINEMENT");
    expect(decideCreativeChecks(checks(["PASS", "PASS", "PASS", "FAIL", "PASS"]))).toBe("NEEDS_REFINEMENT");
    expect(decideCreativeChecks(checks(["PASS", "PASS", "FAIL", "FAIL", "PASS"]))).toBe("REVISE");
  });

  it("fails a creative idea that does not open as a how-if", () => {
    const sealed = sealCreativeValidation(
      { criteria: checks(["PASS", "PASS", "PASS", "PASS", "PASS"]) },
      draft("Tiga kartu jejak kerja."),
      { statement: "Tiga kartu jejak kerja.", parentStatement: PARENT, concept: "Kartu", mechanism: "Satu", value: "Terlihat", peers: [] },
    );
    expect(sealed?.criteria.find((item) => item.id === "CK3")?.status).toBe("FAIL");
    expect(sealed?.decision).toBe("NEEDS_REFINEMENT");
  });

  it("keeps failure memory on the creative idea and leaves the parent idea out of the insert", () => {
    const items = creativeFailureItems(
      [
        { code: "ID01-CI01", statement: "Bagaimana jika satu.", contentPillarId: "pillar-a", format: "video", validation: validation("REJECTED") },
        { code: "ID01-CI02", statement: "Bagaimana jika dua.", contentPillarId: "pillar-b", format: "video", validation: validation("REJECTED") },
        { code: "ID01-CI03", statement: "Bagaimana jika tiga.", contentPillarId: "pillar-a", format: "video", validation: validation("READY") },
      ],
      "pillar-a",
      "video",
    );
    expect(items.map((item) => item.code)).toEqual(["ID01-CI01"]);
    const row = creativeIdeaInsertRow({
      organizationId: "org",
      ideaId: "idea-1",
      contentPillarId: "pillar-a",
      format: "video",
      code: "ID01-CI04",
      title: "Tiga kartu",
      statement: PARENT,
      concept: "Kartu",
      mechanism: "Satu kartu",
      value: "Terlihat",
      validation: validation("READY"),
    });
    expect(row.idea_id).toBe("idea-1");
    expect(row).not.toHaveProperty("parent_validation");
    expect(Object.keys(row)).not.toContain("validation_parent");
  });

  it("asks the next generate to read the creative-idea failures", () => {
    const prompt = buildCreativeGeneratePrompt({
      parentCode: "ID01",
      parentStatement: PARENT,
      parentConcept: "Jejak",
      parentMechanism: "Kartu",
      parentValue: "Terlihat",
      pillarName: "Cerita tim",
      format: "carousel",
      masterThought: "Synckerja menyatukan kerja harian",
      audience: "Ibu pemimpin tim",
      priorBelief: "",
      rootBelief: "",
      bigThought: "Integrasi",
      territory: "Kinerja",
      angle: "Skor individu",
      failures: creativeFailureItems(
        [{ code: "ID01-CI01", statement: "Bagaimana jika lama.", contentPillarId: "p", format: "carousel", validation: validation("REVISE") }],
        "p",
        "carousel",
      ),
    });
    expect(prompt).toContain("ID01-CI01");
    expect(prompt).toContain("CK3");
    expect(prompt).not.toContain("idea-k1k7");
  });

  it("retries an unreadable check once and then leaves CK1 unverified", async () => {
    let calls = 0;
    const result = await judgeCreativeDraft({
      draft: draft(),
      parentStatement: PARENT,
      parentConcept: "",
      parentMechanism: "",
      parentValue: "",
      pillarName: "Cerita",
      format: "post",
      masterThought: "Synckerja",
      audience: "Ibu",
      priorBelief: "",
      rootBelief: "",
      bigThought: "",
      territory: "",
      angle: "",
      peers: [],
      ask: async () => {
        calls += 1;
        return "not json";
      },
    });
    expect(calls).toBe(2);
    expect(result.decision).toBe("NOT_VERIFIED");
    expect(canEnterExecution(result.decision)).toBe(false);
  });
});

describe("development paths", () => {
  const first: DevelopmentPath = {
    contentPillarId: "pillar-a",
    pillarName: "Cerita",
    format: "video",
    status: "RECOMMENDED",
    reason: "Cocok.",
    reviews: [],
    savedAt: "2026-10-25T01:00:00.000Z",
  };
  const second: DevelopmentPath = { ...first, contentPillarId: "pillar-b", pillarName: "Daftar", format: "post", savedAt: "2026-10-25T02:00:00.000Z" };

  it("keeps a different pillar or format beside the one just saved", () => {
    const saved = upsertDevelopmentPath(upsertDevelopmentPath([], first), second);
    expect(saved).toHaveLength(2);
    const again = upsertDevelopmentPath(saved, { ...first, savedAt: "2026-10-25T03:00:00.000Z" });
    expect(again).toHaveLength(2);
    expect(again.find((path) => path.contentPillarId === "pillar-b")?.format).toBe("post");
    expect(again.find((path) => path.contentPillarId === "pillar-a")?.savedAt).toBe("2026-10-25T03:00:00.000Z");
  });

  it("collects one card per locked pillar and keeps the chosen format", () => {
    const locked = { ...first, format: null, savedAt: "2026-10-25T04:00:00.000Z", reviews: [{ contentPillarId: "pillar-a", pillarName: "Cerita", status: "RECOMMENDED" as const, reason: "Cocok.", development: "Adegan yang sama." }] };
    const chosen = { ...locked, format: "carousel" as const, savedAt: "2026-10-25T05:00:00.000Z" };
    const cards = lockedPillarCards([locked, chosen, second]);
    expect(cards.map((card) => [card.contentPillarId, card.format, card.development])).toEqual([
      ["pillar-b", "post", ""],
      ["pillar-a", "carousel", "Adegan yang sama."],
    ]);
    const pending = mergeLockedPillar(cards, { contentPillarId: "pillar-c", pillarName: "Surat", development: "Surat untuk diri.", reason: "Cocok.", format: null });
    expect(pending.map((card) => card.pillarName)).toEqual(["Daftar", "Cerita", "Surat"]);
  });

  it("keeps a locked pillar beside the format already saved for it", () => {
    const locked: DevelopmentPath = { ...first, format: null, savedAt: "2026-10-25T04:00:00.000Z" };
    const saved = upsertDevelopmentPath([first], locked);
    expect(saved.map((path) => path.format)).toEqual(["video", null]);
    expect(readDevelopmentPaths([{ contentPillarId: "pillar-a", pillarName: "Cerita", format: null, status: "RECOMMENDED", reason: "Cocok.", reviews: [], savedAt: "2026-10-25T04:00:00.000Z" }])).toEqual([locked]);
    expect(readDevelopmentPaths([{ contentPillarId: "pillar-a", pillarName: "Cerita" }])).toEqual([]);
  });

  it("writes only the path column, so a failed generate cannot drop a saved path", () => {
    const saved = upsertDevelopmentPath([first], second);
    expect(developmentPathPatch(saved)).toEqual({ development_paths: saved });
    expect(Object.keys(developmentPathPatch(saved))).toEqual(["development_paths"]);
    expect(readDevelopmentPaths(saved)).toEqual(saved);
  });
});

describe("pillar review", () => {
  const pillars = Array.from({ length: 14 }, (_, index) => ({
    id: `p${index + 1}`,
    name: index === 0 ? "Kinerja tim" : `Pillar ${index + 1}`,
    description: index === 0 ? "Cerita kinerja karyawan" : "Umum",
  }));

  it("reviews a bounded subset and leaves the rest not reviewed", () => {
    const split = selectPillarReviewSet(pillars, "kinerja karyawan yang tersebar");
    expect(split.reviewed).toHaveLength(12);
    expect(split.reviewed[0]?.name).toBe("Kinerja tim");
    expect(split.unreviewed).toHaveLength(2);
    const parsed = parsePillarReviews(
      {
        reviews: [
          { pillar: "Kinerja tim", development: "Jejak kerja tampil sebagai cerita tim yang bisa ditunjuk.", reason: "Cerita itu membawa mekanisme yang sama." },
          { pillar: "Kinerja tim", status: "RECOMMENDED", reason: "Hanya label." },
          { pillar: "Pillar 2", status: "NOT_SUITABLE", development: "Ide diganti.", reason: "Tidak cocok." },
          { pillar: "Pillar khayalan", development: "Nama yang tidak ada.", reason: "Tidak ada." },
        ],
      },
      split.reviewed,
    );
    expect(parsed.map((item) => item.pillarName)).toEqual(["Kinerja tim"]);
    expect(parsed[0]?.development).toContain("cerita tim");
    const merged = mergePillarReviews(pillars, parsed);
    expect(merged.find((item) => item.pillarName === "Kinerja tim")?.status).toBe("RECOMMENDED");
    expect(merged.filter((item) => item.status === "NOT_SUITABLE")).toHaveLength(0);
    expect(merged.filter((item) => item.status === "NOT_REVIEWED").length).toBe(13);
  });

  it("keeps a recommendation only after the check confirms the fit", async () => {
    const pillars = [
      { id: "p1", name: "Cerita tim", description: "Adegan yang diceritakan" },
      { id: "p2", name: "Daftar", description: "Butir yang terpisah" },
    ];
    const result = await reviewContentPillars({
      pillars,
      context: "Bagaimana jika jejak kerja tampil tanpa skor.",
      ask: async (prompt) => {
        if (prompt.startsWith("Check this pillar recommendation")) {
          return prompt.includes("Cerita tim")
            ? JSON.stringify({ pass: true, reason: "Adegan cerita membawa jejak kerja yang sama tanpa skor." })
            : JSON.stringify({ pass: false, reason: "Daftar ini mengganti mekanisme ide." });
        }
        return JSON.stringify({
          reviews: [
            { pillar: "Cerita tim", development: "Jejak kerja tampil sebagai adegan yang diceritakan.", reason: "Klaim awal." },
            { pillar: "Daftar", development: "Jejak kerja menjadi daftar butir.", reason: "Klaim awal." },
          ],
        });
      },
    });
    expect(result.map((item) => item.pillarName)).toEqual(["Cerita tim"]);
    expect(result[0]?.reason).toBe("Adegan cerita membawa jejak kerja yang sama tanpa skor.");
    expect(result[0]?.development).toContain("adegan yang diceritakan");
  });

  it("asks for three recommendations and leaves locked pillars out", async () => {
    const pillars = Array.from({ length: 6 }, (_, index) => ({ id: `p${index}`, name: `Pillar ${index}` }));
    let reviewPrompt = "";
    const checked: string[] = [];
    const result = await reviewContentPillars({
      pillars,
      context: "Bagaimana jika jejak kerja tampil tanpa skor.",
      excludeIds: ["p0"],
      keep: 3,
      ask: async (prompt) => {
        if (prompt.startsWith("Check this pillar recommendation")) {
          checked.push(prompt);
          return JSON.stringify({ pass: true, reason: "Mekanisme yang sama tetap terbawa." });
        }
        reviewPrompt = prompt;
        return JSON.stringify({
          reviews: [0, 1, 2, 3, 4].map((index) => ({
            pillar: `Pillar ${index}`,
            development: `Jejak kerja menjadi bentuk ${index} tanpa mengganti idenya.`,
            reason: "Klaim awal.",
          })),
        });
      },
    });
    const listed = reviewPrompt.split("Pillars to review:")[1] ?? "";
    expect(listed).not.toContain("Pillar 0");
    expect(reviewPrompt).toContain("These pillars are already locked.");
    expect(reviewPrompt).toContain("Return exactly 3 recommendations");
    expect(result.map((item) => item.pillarName)).toEqual(["Pillar 1", "Pillar 2", "Pillar 3"]);
    expect(checked).toHaveLength(3);
  });
});

describe("creative idea drafts", () => {
  it("numbers the next code from the parent idea", () => {
    expect(nextCreativeCode("ID01", [])).toBe("ID01-CI01");
    expect(nextCreativeCode("id01", ["ID01-CI01", "ID01-CI09"])).toBe("ID01-CI10");
  });

  it("reads three different drafts and drops an exact repeat", () => {
    const drafts = parseCreativeDrafts({
      ideas: [
        { title: "A", statement: "Bagaimana jika satu.", concept: "A", mechanism: "A", value: "A" },
        { title: "B", statement: "Bagaimana jika satu.", concept: "B", mechanism: "B", value: "B" },
        { title: "C", statement: "Bagaimana jika dua.", concept: "C", mechanism: "C", value: "C" },
        { title: "D", statement: "Bagaimana jika tiga.", concept: "D", mechanism: "D", value: "D" },
        { title: "E", statement: "Bagaimana jika empat.", concept: "E", mechanism: "E", value: "E" },
      ],
    });
    expect(drafts.map((item) => item.title)).toEqual(["A", "C", "D"]);
  });
});

describe("execution link", () => {
  const base = {
    masterStatement: "Synckerja menyatukan kerja harian.",
    ideaStatement: PARENT,
    pillar: "Cerita tim",
  };

  it("adds the creative idea to the existing script prompt", () => {
    const plain = buildExecutionGeneratePrompt(base);
    const linked = buildExecutionGeneratePrompt({
      ...base,
      creativeIdea: { statement: "Bagaimana jika tiga kartu.", concept: "Kartu", mechanism: "Satu jejak", value: "Terlihat" },
    });
    expect(plain).not.toContain("Creative Idea.");
    expect(plain).not.toContain("Pillar development.");
    expect(linked).toContain("Bagaimana jika tiga kartu.");
    expect(linked).toContain("Do not replace its core");
    const developed = buildExecutionGeneratePrompt({
      ...base,
      pillarDevelopment: "Jejak kerja tampil sebagai adegan yang bisa ditonton.",
    });
    expect(developed).toContain("Pillar development. Realize this communication.");
    expect(developed).toContain("Jejak kerja tampil sebagai adegan yang bisa ditonton.");
    expect(developed).not.toContain("Creative Idea.");
  });

  it("uses the image generator for carousel and post, and video for video", () => {
    expect(imageSettingsForCreativeFormat("video")).toBeNull();
    expect(imageSettingsForCreativeFormat("carousel")?.format).toBe("carousel");
    expect(imageSettingsForCreativeFormat("post")?.format).toBe("single");
    const slides = buildImageGeneratePrompt({
      ...base,
      image: imageSettingsForCreativeFormat("post")!,
      creativeIdea: { statement: "Bagaimana jika satu kartu." },
    });
    expect(slides).toContain("Bagaimana jika satu kartu.");
    expect(buildImageGeneratePrompt({ ...base, image: imageSettingsForCreativeFormat("post")! })).not.toContain("Creative Idea.");
    expect(buildImageGeneratePrompt({ ...base, image: imageSettingsForCreativeFormat("post")! })).not.toContain("Pillar development.");
    const developedSlides = buildImageGeneratePrompt({
      ...base,
      image: imageSettingsForCreativeFormat("carousel")!,
      pillarDevelopment: "Jejak kerja tampil sebagai adegan yang bisa ditonton.",
    });
    expect(developedSlides).toContain("Pillar development. Realize this communication.");
    expect(developedSlides).toContain("Jejak kerja tampil sebagai adegan yang bisa ditonton.");
    expect(developedSlides).not.toContain("Creative Idea.");
  });
});
