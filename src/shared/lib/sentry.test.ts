import { describe, expect, it } from "vitest";
import { scrubUrl } from "./sentry";

describe("scrubUrl", () => {
  it("redacts review tokens and OAuth params but keeps the rest", () => {
    expect(scrubUrl("https://app.synckerja.id/review/abc?review_token=SECRET&file_id=1")).toBe(
      "https://app.synckerja.id/review/abc?review_token=[redacted]&file_id=1",
    );
    expect(scrubUrl("https://x.id/cb?code=123&state=xyz#access_token=t0k")).toBe(
      "https://x.id/cb?code=[redacted]&state=[redacted]#access_token=[redacted]",
    );
  });

  it("leaves URLs without sensitive params unchanged", () => {
    const url = "https://app.synckerja.id/daily-task?tab=today";
    expect(scrubUrl(url)).toBe(url);
  });
});
