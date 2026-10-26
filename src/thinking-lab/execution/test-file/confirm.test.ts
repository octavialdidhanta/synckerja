import { describe, expect, it } from "vitest";
import {
  buildExecutionConfirmPrompt,
  claimMaterialLines,
  confirmedDecisionRules,
  confirmedViewpointRules,
  parseDiscoveredQuestions,
  parseViewpointOptions,
} from "@/thinking-lab/execution/confirm";
import { buildExecutionGeneratePrompt } from "@/thinking-lab/execution/generate";
import { buildImageGeneratePrompt } from "@/thinking-lab/execution/imageGenerate";
import { buildViewpointAuditPrompt } from "@/thinking-lab/execution/script";

describe("execution confirmation", () => {
  it("lets a claim check read the locked pillar and the locked story answers", () => {
    const lines = claimMaterialLines({
      pillarDevelopment: "Tanyakan satu hal kecil sebelum les tambahan.",
      decisions: [
        { category: "Momen", question: "Apa yang terlihat?", answer: "Anak sedang bermain game.", binds: "story" },
        { category: "Sudut", question: "Siapa yang berbicara?", answer: "Ibu yang lebih tua.", binds: "viewpoint" },
      ],
    });
    expect(lines.join("\n")).toContain("Tanyakan satu hal kecil sebelum les tambahan.");
    expect(lines.join("\n")).toContain("Anak sedang bermain game.");
    expect(lines.join("\n")).not.toContain("Ibu yang lebih tua.");
    expect(lines.join("\n")).toContain("Keep the time and the status of every step");
    expect(lines.join("\n")).toContain("andai saja aku tahu");
    expect(lines.join("\n")).toContain("saat itu aku mulai bertanya");
    expect(lines.join("\n")).toContain("ibu yang baik sedunia");
    expect(claimMaterialLines({ decisions: [] })).toEqual([]);
  });

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
    expect(prompt).not.toContain("Pillar development.");
    const withDevelopment = buildExecutionConfirmPrompt({
      masterStatement: "Dokumentasi pernikahan saya siap dalam tiga hari.",
      ideaStatement: "Pasangan pengantin baru menghabiskan malam-malam pertama dengan foto buram.",
      pillars: [{ name: "Letter to Younger Self" }],
      pillarDevelopment: "Untuk diriku yang dulu, tanyakan satu hal kecil hari ini.",
    });
    expect(withDevelopment).toContain("Pillar development. Realize this communication.");
    expect(withDevelopment).toContain("Untuk diriku yang dulu, tanyakan satu hal kecil hari ini.");
    expect(withDevelopment).toContain("do not invent a different communication.");
    expect(withDevelopment).toContain("leaves unnamed on purpose");
    expect(withDevelopment).toContain("already states how the step is carried out");
    expect(withDevelopment).toContain("that join is closed");
    const follow = buildExecutionConfirmPrompt({
      masterStatement: "Dokumentasi pernikahan saya siap dalam tiga hari.",
      ideaStatement: "Pasangan pengantin baru menghabiskan malam-malam pertama dengan foto buram.",
      pillars: [{ name: "Letter to Younger Self" }],
      pillarDevelopment: "Untuk diriku yang dulu, yang menulis surat ini.",
      discovery: "follow",
    });
    expect(follow).toContain("Return no story question.");
    expect(follow).toContain("does not already say who is speaking");
    expect(follow).toContain("return an empty question list");
    expect(follow).not.toContain("find every choice that is still open");
    expect(follow).not.toContain("how the viewer gets from the last moment");
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
      confirmedDecisionRules([
        { category: "Momen", question: "Momen mana?", answer: "Malam pertama", binds: "story" },
      ]).join("\n"),
    ).toContain("Do not add a scene for this choice.");
    expect(
      confirmedDecisionRules([
        { category: "Momen", question: "Momen mana?", answer: "Malam pertama", binds: "story" },
      ]).join("\n"),
    ).toContain("Advice stays advice. A step that has not happened yet does not become a memory of it already having happened.");
    expect(
      confirmedDecisionRules([
        { category: "Momen", question: "Momen mana?", answer: "Malam pertama", binds: "story" },
      ]).join("\n"),
    ).not.toContain("Write that choice");
    const letter = buildExecutionGeneratePrompt({
      masterStatement: "Kepekaan suami tidak menghentikan kemarahan istri.",
      ideaStatement: "Suami membereskan rumah setelah bertengkar.",
      pillar: "Letter to Younger Self",
      durationSeconds: 60,
      pillarDevelopment: "Untuk diriku yang dulu, tanyakan satu hal kecil.",
    });
    expect(letter).toContain("The locked pillar communication comes first.");
    expect(letter).toContain("in order to fill the duration");
    expect(letter).not.toContain("Do not make the script much shorter or much longer than that.");
    expect(letter).not.toContain("andai saja aku tahu");
    const claimed = buildExecutionGeneratePrompt({
      masterStatement: "Kepekaan suami tidak menghentikan kemarahan istri.",
      ideaStatement: "Suami membereskan rumah setelah bertengkar.",
      pillar: "Letter to Younger Self",
      pillarDevelopment: "Untuk diriku yang dulu, tanyakan satu hal kecil.",
      enabled: ["messageStays"],
    });
    expect(claimed).toContain("andai saja aku tahu");
    expect(claimed).toContain("A smile, or the words ibu yang baik sedunia, is a new claim");
    const sharpened = buildExecutionGeneratePrompt({
      masterStatement: "Kepekaan suami tidak menghentikan kemarahan istri.",
      ideaStatement: "Suami membereskan rumah setelah bertengkar.",
      pillar: "Letter to Younger Self",
      pillarDevelopment: "Untuk diriku yang dulu, tanyakan satu hal kecil.",
      decisions: [{ category: "Momen", question: "Momen mana?", answer: "Malam pertama", binds: "story" }],
    });
    expect(sharpened).toContain("Advice stays advice. A step that has not happened yet does not become a memory of it already having happened.");
    const slides = buildImageGeneratePrompt({
      masterStatement: "Kepekaan suami tidak menghentikan kemarahan istri.",
      ideaStatement: "Suami membereskan rumah setelah bertengkar.",
      pillar: "Letter to Younger Self",
      image: { format: "single", slideCountMode: "idea", slideCount: null, withImage: false },
      decisions: [{ category: "Momen", question: "Momen mana?", answer: "Malam pertama", binds: "story" }],
    });
    expect(slides).toContain("Do not add a scene for this choice.");
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
