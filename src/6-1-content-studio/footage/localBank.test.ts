import { describe, expect, it } from "vitest";
import { isInboxFileKey, localRelPath } from "./localBank";

describe("localBank path helpers", () => {
  it("detects INBOX keys and strips the prefix for the upload folder", () => {
    expect(isInboxFileKey("INBOX/clip.mp4")).toBe(true);
    expect(isInboxFileKey("PIK1/sate/clip.mp4")).toBe(false);
    expect(localRelPath("INBOX/Serving_soup.mp4")).toBe("Serving_soup.mp4");
    expect(localRelPath("PIK1/sop sumsum/a.mp4")).toBe("PIK1/sop sumsum/a.mp4");
  });
});
