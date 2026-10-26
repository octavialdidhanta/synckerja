import { describe, expect, it } from "vitest";
import { buildIdeaFixOptionsPrompt } from "@/thinking-lab/idea/fix";
import { buildIdeaGeneratePrompt } from "@/thinking-lab/idea/generate";
import {
  buildIdeaDiscoveryPrompt,
  ideaDiscoveryMatches,
  parseIdeaDiscoveryQuestions,
} from "@/thinking-lab/idea/discover";

const INDUSTRY_BAN = "Do not use examples from any specific industry, belief system, or brand.";

describe("idea discovery", () => {
  it("rejects a broken question list and accepts an empty one", () => {
    expect(parseIdeaDiscoveryQuestions(null)).toEqual({ ok: false });
    expect(parseIdeaDiscoveryQuestions({ questions: "no" })).toEqual({ ok: false });
    expect(parseIdeaDiscoveryQuestions({ questions: [] })).toEqual({ ok: true, questions: [] });
  });

  it("drops a question with fewer than two options and keeps at most three", () => {
    const parsed = parseIdeaDiscoveryQuestions({
      questions: [
        { category: "World", prompt: "Satu opsi", options: ["Hanya ini"] },
        { category: "World", prompt: "Situasi pertama?", options: ["Serah terima sif", "Ruang konsultasi", "Meja resepsionis", "Gudang", "Parkir"] },
        { category: "World", prompt: "Situasi kedua?", options: ["Dapur pagi", "Meja kasir"] },
        { category: "World", prompt: "Situasi ketiga?", options: ["Ruang ganti", "Lantai penjualan"] },
        { category: "World", prompt: "Situasi keempat?", options: ["Halaman", "Lorong"] },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.questions.map((question) => question.prompt)).toEqual([
      "Situasi pertama?",
      "Situasi kedua?",
      "Situasi ketiga?",
    ]);
    expect(parsed.questions[0]?.options).toEqual(["Serah terima sif", "Ruang konsultasi", "Meja resepsionis", "Gudang"]);
  });

  it("asks the model to read the chain before naming a world", () => {
    const prompt = buildIdeaDiscoveryPrompt({
      masterStatement: "Evaluasi terpisah membuat koordinasi tidak terlihat.",
      masterSubject: "Evaluasi individu",
      angleStatement: "Catatan pribadi tetap masuk akal tanpa melihat kerja bersama.",
      ancestors: [{ label: "Territory", statement: "Cara tim mengukur kontribusi." }],
    });
    expect(prompt).toContain("Before any Idea is written");
    expect(prompt).toContain("Do not write an Idea.");
    expect(prompt).toContain("general human situation");
    expect(prompt).toContain("Do not lock one scene");
    expect(prompt).toContain("Catatan pribadi tetap masuk akal tanpa melihat kerja bersama.");
    expect(prompt).toContain("Territory: Cara tim mengukur kontribusi.");
  });

  it("reuses a discovery only while the angle fingerprint matches", () => {
    const discovery = {
      angleFingerprint: "angle-fp",
      decisions: [{ category: "World", question: "Di mana?", answer: "Serah terima sif" }],
    };
    expect(ideaDiscoveryMatches(discovery, "angle-fp")).toBe(true);
    expect(ideaDiscoveryMatches(discovery, "other")).toBe(false);
    expect(ideaDiscoveryMatches(null, "angle-fp")).toBe(false);
  });

  it("locks the chosen world in generate and fix without repeating one mechanism", () => {
    const decisions = [{ category: "World", question: "Di mana mekanisme ini terjadi?", answer: "Serah terima sif perawat" }];
    const generate = buildIdeaGeneratePrompt({
      parentStatement: "Catatan pribadi tetap masuk akal.",
      incumbents: [],
      decisions,
      needed: 1,
    });
    const fix = buildIdeaFixOptionsPrompt({
      parentStatement: "Catatan pribadi tetap masuk akal.",
      failed: { code: "ID01", statement: "Sebuah mesin mencatat komponen." },
      keepers: [],
      conflicts: [],
      decisions,
    });
    for (const prompt of [generate, fix]) {
      expect(prompt).toContain('The mechanisms live in this world: "Serah terima sif perawat".');
      expect(prompt).toContain("Each Idea is still a different mechanism.");
      expect(prompt).not.toContain(INDUSTRY_BAN);
    }
    expect(generate).toContain("A new wording of the same mechanism is still a repeat.");
  });

  it("keeps an unanswered chain inside the situation it already states", () => {
    const prompt = buildIdeaGeneratePrompt({
      parentStatement: "Catatan pribadi tetap masuk akal.",
      incumbents: [],
      needed: 1,
    });
    expect(prompt).toContain("Stay inside the situation the chain already states.");
    expect(prompt).toContain("Do not invent a setting the chain does not contain.");
    expect(prompt).not.toContain(INDUSTRY_BAN);
  });
});
