import { describe, expect, it } from "vitest";
import { normalizeExecutionFacts } from "@/thinking-lab/execution/semantic";
import {
  buildPillarRecommendationPrompt,
  parsePillarRecommendation,
  pillarNeedsRecommendation,
  pillarWasRecommended,
} from "@/thinking-lab/execution/recommend";

describe("pillar recommendation", () => {
  it("asks for one other pillar that can carry the Idea", () => {
    const prompt = buildPillarRecommendationPrompt({
      masterStatement: "Dokumentasi pernikahan saya siap dalam tiga hari.",
      ideaStatement: "Pasangan pengantin baru membesarkan foto buram dari ponsel tamu.",
      failedPillar: "B-Roll Storytelling",
      explanation: "Konten ini menyajikan cerita positif di luar kesadaran negatif pada Idea.",
      pillars: [
        { name: "B-Roll Storytelling", funnel: "Awareness", category: "Story" },
        { name: "Behind The Scene", funnel: "Awareness", category: "Story", description: "Proses kerja yang penonton bisa lihat." },
      ],
    });
    expect(prompt).toContain("should not have to try the formats one by one");
    expect(prompt).toContain("Behind The Scene");
    expect(prompt).not.toContain("- B-Roll Storytelling");
    expect(prompt).toContain("cerita positif");
  });

  it("keeps a listed pillar and drops the one that already failed", () => {
    expect(
      parsePillarRecommendation(
        { pillar: "behind the scene", reason: "Format ini menunjukkan proses tanpa menambah klaim baru." },
        ["Behind The Scene", "Did You Know?"],
        "B-Roll Storytelling",
      ),
    ).toEqual({
      pillarName: "Behind The Scene",
      reason: "Format ini menunjukkan proses tanpa menambah klaim baru.",
    });
    expect(
      parsePillarRecommendation(
        { pillar: "B-Roll Storytelling", reason: "Tetap format yang gagal." },
        ["Behind The Scene", "B-Roll Storytelling"],
        "B-Roll Storytelling",
      ),
    ).toBeNull();
    expect(pillarNeedsRecommendation("MESSAGE_ADDED")).toBe(false);
    expect(pillarNeedsRecommendation("MECHANISM_HIDDEN")).toBe(true);
    expect(pillarNeedsRecommendation("CLIMB_MISSED")).toBe(false);
    expect(pillarWasRecommended("Letter to Younger Self", ["B-Roll Storytelling", "Letter to Younger Self"])).toBe(true);
    expect(pillarWasRecommended("Story Telling - The Lowest Point", ["Letter to Younger Self"])).toBe(false);
  });

  it("stores the recommendation only when the pillar itself is the problem", () => {
    const kept = normalizeExecutionFacts({
      pillar: "B-Roll Storytelling",
      messageAdded: false,
      mechanismVisible: false,
      pillarOutside: false,
      masterSells: false,
      viewerClimb: "CLIMBS",
      subjectMatch: "MATCH",
      recommendation: { pillarName: "Behind The Scene", reason: "Prosesnya terlihat tanpa menutup kecemasan." },
    });
    expect(kept.relationToParent).toBe("MECHANISM_HIDDEN");
    expect(kept.recommendation?.pillarName).toBe("Behind The Scene");
    const claim = normalizeExecutionFacts({
      ...kept,
      mechanismVisible: true,
      messageAdded: true,
      recommendation: { pillarName: "Behind The Scene", reason: "Klaim baru bukan salah pilar." },
    });
    expect(claim.relationToParent).toBe("MESSAGE_ADDED");
    expect(claim.recommendation).toBeUndefined();
    const dropped = normalizeExecutionFacts({
      ...kept,
      messageAdded: false,
      mechanismVisible: true,
      recommendation: { pillarName: "Behind The Scene", reason: "Tidak dipakai saat lolos." },
    });
    expect(dropped.relationToParent).toBe("VALID_EXECUTION");
    expect(dropped.recommendation).toBeUndefined();
  });
});
