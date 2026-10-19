import { describe, expect, it } from "vitest";
import {
  buildExecutionConfirmPrompt,
  confirmedDecisionRules,
  confirmedViewpointRules,
  parseDiscoveredQuestions,
  parseViewpointOptions,
} from "@/thinking-lab/execution/confirm";
import { buildExecutionGeneratePrompt } from "@/thinking-lab/execution/generate";
import { buildViewpointAuditPrompt } from "@/thinking-lab/execution/script";

describe("execution confirmation", () => {
  it("asks the model to discover every open choice from the chain", () => {
    const prompt = buildExecutionConfirmPrompt({
      masterStatement: "Dokumentasi pernikahan saya siap dalam tiga hari.",
      angleStatement: "Penantian foto membuat hari pertama terasa belum selesai.",
      ideaStatement: "Pasangan pengantin baru menghabiskan malam-malam pertama dengan foto buram.",
      pillars: [{ name: "Behind The Scene", funnel: "top", category: "Story" }],
      look: "ugc",
      durationSeconds: 90,
      brandName: "Vialdi Wedding",
      cta: "Like & Comment",
    });
    expect(prompt).toContain("find every choice that is still open");
    expect(prompt).toContain("Do not write the script.");
    expect(prompt).toContain("Five or six are allowed");
    expect(prompt).toContain("how the viewer gets from the last moment of one beat to the first moment of the next");
    expect(prompt).toContain("unexplained discovery");
    expect(prompt).toContain("If nothing is open, return an empty question list.");
    expect(prompt).toContain("Angle:");
    expect(prompt).toContain("Behind The Scene (top, Story)");
    expect(prompt).toContain("Duration: 90 seconds.");
    expect(prompt).toContain("Vialdi Wedding");
    expect(prompt).toContain("Like & Comment");
    expect(prompt).not.toContain("Do not write the question.");
    expect(prompt).not.toContain("Write one voice-over script");
  });

  it("keeps every open choice and drops locked, generic, or duplicate ones", () => {
    const discovered = parseDiscoveredQuestions({
      questions: [
        {
          category: "Sudut pandang",
          prompt: "Narasi ini diceritakan dari sudut pandang siapa?",
          binds: "viewpoint",
          options: ["Pengantin Wanita", "orang ketiga", "Keluarga yang Berkunjung"],
        },
        {
          category: "Kamera",
          prompt: "Kamera mengikuti siapa?",
          binds: "frame",
          options: ["Pengantin Pria", "Keluarga yang Berkunjung"],
        },
        {
          category: "Kamera",
          prompt: "Gambar mengikuti siapa?",
          binds: "frame",
          options: ["Pengantin Wanita", "Keluarga yang Berkunjung"],
        },
        {
          category: "Momen",
          prompt: "Momen mana yang diceritakan?",
          binds: "story",
          options: ["Malam pertama", "Tiga hari kemudian"],
        },
        {
          category: "Durasi",
          prompt: "Berapa detik durasi videonya?",
          binds: "story",
          options: ["30 detik", "90 detik"],
        },
      ],
    });
    expect(discovered.ok).toBe(true);
    if (!discovered.ok) return;
    expect(discovered.questions.map((question) => question.binds)).toEqual(["viewpoint", "frame", "story"]);
    expect(discovered.questions[0]?.options).toEqual(["Pengantin Wanita", "Keluarga yang Berkunjung"]);
    expect(parseDiscoveredQuestions({ questions: [] })).toEqual({ ok: true, questions: [] });
    expect(parseDiscoveredQuestions({ options: ["Istri", "Suami"] }).ok).toBe(false);
  });

  it("keeps two to four concrete options and drops generic ones", () => {
    expect(
      parseViewpointOptions({
        options: ["Suami", "Istri", "Orang di rumah yang melihat keduanya", "Suami", "Brand", "Tamu yang melihat keduanya"],
      }),
    ).toEqual(["Suami", "Istri", "Orang di rumah yang melihat keduanya", "Tamu yang melihat keduanya"]);
    expect(parseViewpointOptions({ options: ["Istri", "orang ketiga", "narrator"] })).toEqual(null);
    expect(parseViewpointOptions({ options: ["Suami"] })).toBeNull();
    expect(parseViewpointOptions({ options: ["someone", "seseorang"] })).toBeNull();
  });

  it("locks the chosen point of view into the script prompt", () => {
    const prompt = buildExecutionGeneratePrompt({
      masterStatement: "Kepekaan suami tidak menghentikan kemarahan istri.",
      ideaStatement: "Suami membereskan rumah setelah bertengkar.",
      pillar: "Dos and Don'ts",
      pointOfView: "Istri",
    });
    expect(prompt).toContain('The narration has one point of view: "Istri".');
    expect(prompt).toContain("follows from the last sentence of the previous story scene");
    expect(prompt).toContain("Do not narrate another person's private thoughts.");
    expect(prompt).not.toContain("Kamera mengikuti siapa?");
    expect(confirmedViewpointRules("")).toEqual([]);
    expect(
      confirmedDecisionRules([
        { category: "Sudut pandang", question: "Siapa yang bercerita?", answer: "Istri", binds: "viewpoint" },
        { category: "Momen", question: "Momen mana?", answer: "Malam pertama", binds: "story" },
      ]).join("\n"),
    ).toContain('Locked choice — Momen: "Malam pertama".');
    expect(
      buildExecutionGeneratePrompt({
        masterStatement: "Kepekaan suami tidak menghentikan kemarahan istri.",
        ideaStatement: "Suami membereskan rumah setelah bertengkar.",
        pillar: "Dos and Don'ts",
      }),
    ).not.toContain("one point of view");
  });

  it("asks the viewpoint audit to reject another person's private thoughts", () => {
    const prompt = buildViewpointAuditPrompt({
      ideaStatement: "Suami membereskan rumah setelah bertengkar.",
      pointOfView: "Istri",
      lines: [{ id: "s1-l1", narration: "Dalam benaknya, suaminya berharap amarah itu luluh." }],
    });
    expect(prompt).toContain('The locked point of view is "Istri".');
    expect(prompt).toContain("private thoughts, feelings, intentions, or knowledge");
    expect(prompt).toContain("s1-l1: Dalam benaknya, suaminya berharap amarah itu luluh.");
  });
});
