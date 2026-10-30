import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreativePathPanel, type CreativePathView } from "@/thinking-lab/section/CreativePathPanel";

vi.mock("@/shared/i18n/useAppTranslation", () => ({
  useAppTranslation: () => ({
    t: (key: string, fallback?: string, variables?: Record<string, string | number>) => {
      const template = fallback ?? key;
      if (!variables) return template;
      return Object.entries(variables).reduce((text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)), template);
    },
  }),
}));

function path(overrides: Partial<CreativePathView> = {}): CreativePathView {
  return {
    reviews: [],
    selectedPillarId: null,
    selectedPillarName: "",
    selectedFormat: null,
    onReview: vi.fn(),
    onReviewLeadMagnet: vi.fn(),
    onSelectPillar: vi.fn(),
    onSelectFormat: vi.fn(),
    ...overrides,
  };
}

describe("CreativePathPanel lead magnet checklist", () => {
  it("keeps the pass requirements hidden until Review pillar Lead Magnet is pressed", () => {
    render(<CreativePathPanel path={path()} />);
    expect(screen.queryByText("Pass requirements")).toBeNull();
    expect(screen.queryByText("The offered material is concrete, not a generic label.")).toBeNull();
  });

  it("spins the requirement the model is checking and checks the ones already passed", () => {
    render(
      <CreativePathPanel
        path={path({
          leadMagnetStep: {
            pillarName: "Did You Know?",
            drafting: false,
            checks: [
              { id: "offer", state: "pass" },
              { id: "comment", state: "running" },
              { id: "trigger", state: "pending" },
              { id: "withheld", state: "pending" },
              { id: "fit", state: "pending" },
            ],
          },
        })}
        pendingAction="creative-review-lead-magnet"
      />,
    );
    expect(screen.getByText("Checking this requirement: The comment is a short phrase the viewer must type.")).toBeTruthy();
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
    const comment = screen.getByText("The comment is a short phrase the viewer must type.");
    expect(comment.parentElement?.querySelector(".animate-spin")).toBeTruthy();
    const offer = screen.getByText("The offered material is concrete, not a generic label.");
    expect(offer.parentElement?.querySelector("svg")).toBeTruthy();
    expect(offer.parentElement?.querySelector(".animate-spin")).toBeNull();
  });

  it("keeps the spinner on the drafting line while the model is still writing", () => {
    render(
      <CreativePathPanel
        path={path({
          leadMagnetStep: {
            pillarName: "",
            drafting: true,
            checks: [
              { id: "offer", state: "pending" },
              { id: "comment", state: "pending" },
              { id: "trigger", state: "pending" },
              { id: "withheld", state: "pending" },
              { id: "fit", state: "pending" },
            ],
          },
        })}
      />,
    );
    expect(screen.getByText("The model is writing the offer, the comment, and the curiosity trigger.")).toBeTruthy();
    expect(document.querySelectorAll(".animate-spin")).toHaveLength(1);
  });
});
