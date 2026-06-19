import { describe, expect, it } from "vitest";

type Severity = "unavailable" | "stable" | "moderate" | "significant_increase" | "significant_decrease";

function computeSeverity(deltaPercent: number | null): {
  severity: Severity;
  requires_review_ack: boolean;
} {
  if (deltaPercent === null) {
    return { severity: "unavailable", requires_review_ack: false };
  }
  if (deltaPercent >= 15) {
    return { severity: "significant_increase", requires_review_ack: true };
  }
  if (deltaPercent <= -15) {
    return { severity: "significant_decrease", requires_review_ack: true };
  }
  if (Math.abs(deltaPercent) >= 5) {
    return { severity: "moderate", requires_review_ack: false };
  }
  return { severity: "stable", requires_review_ack: false };
}

describe("payroll disburse period comparison severity", () => {
  it("marks stable when change is below 5%", () => {
    expect(computeSeverity(3.2)).toEqual({ severity: "stable", requires_review_ack: false });
    expect(computeSeverity(-4.9)).toEqual({ severity: "stable", requires_review_ack: false });
  });

  it("marks moderate between 5% and 15%", () => {
    expect(computeSeverity(8)).toEqual({ severity: "moderate", requires_review_ack: false });
    expect(computeSeverity(-10)).toEqual({ severity: "moderate", requires_review_ack: false });
  });

  it("requires review ack for significant changes", () => {
    expect(computeSeverity(15)).toEqual({ severity: "significant_increase", requires_review_ack: true });
    expect(computeSeverity(-15)).toEqual({ severity: "significant_decrease", requires_review_ack: true });
  });
});
