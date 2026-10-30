import { describe, expect, it } from "vitest";
import { leadMagnetBriefForPillar } from "@/thinking-lab/creative-idea/paths";
import type { DevelopmentPath } from "@/thinking-lab/creative-idea/types";

const path = (savedAt: string, reviews: DevelopmentPath["reviews"]): DevelopmentPath => ({
  contentPillarId: "pillar-a",
  pillarName: "Cerita",
  format: "video",
  status: "RECOMMENDED",
  reason: "Cocok.",
  reviews,
  savedAt,
});

describe("leadMagnetBriefForPillar", () => {
  it("returns the offer, comment, and trigger stored on the pillar", () => {
    const brief = leadMagnetBriefForPillar([
      path("2026-10-30T00:00:00.000Z", [{
        contentPillarId: "pillar-a",
        pillarName: "Cerita",
        status: "RECOMMENDED",
        reason: "Cocok.",
        development: "Adegan yang sama.",
        offer: "Rumus harga jasa",
        comment: "MAU HARGA",
        trigger: "Video berhenti sebelum rumus.",
      }]),
    ], "pillar-a");
    expect(brief).toEqual({
      offer: "Rumus harga jasa",
      comment: "MAU HARGA",
      trigger: "Video berhenti sebelum rumus.",
      pillarName: "Cerita",
      development: "Adegan yang sama.",
    });
  });

  it("returns null when the pillar review has no offer", () => {
    const brief = leadMagnetBriefForPillar([
      path("2026-10-30T00:00:00.000Z", [{
        contentPillarId: "pillar-a",
        pillarName: "Cerita",
        status: "RECOMMENDED",
        reason: "Cocok.",
        development: "Adegan yang sama.",
      }]),
    ], "pillar-a");
    expect(brief).toBeNull();
  });
});
