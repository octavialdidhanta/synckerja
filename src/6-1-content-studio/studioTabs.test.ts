import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONTENT_STUDIO_BASE,
  CONTENT_STUDIO_DEFAULT_RETURN,
  STUDIO_TABS,
  contentStudioNavState,
  contentStudioReturnPath,
} from "./studioTabs";

describe("Content Studio routes", () => {
  it("every ready tab has its own route in App.tsx, or the tab opens a 404", () => {
    const app = fs.readFileSync(path.resolve(__dirname, "../App.tsx"), "utf8");
    for (const t of STUDIO_TABS.filter((x) => x.ready)) {
      expect(app, `route for ${t.id}`).toContain(`path="${CONTENT_STUDIO_BASE}/${t.id}"`);
    }
  });
});

describe("contentStudioReturnPath", () => {
  it("returns the opener path from location state", () => {
    expect(
      contentStudioReturnPath(contentStudioNavState("/digital-marketing/social-media/dashboard")),
    ).toBe("/digital-marketing/social-media/dashboard");
  });

  it("falls back to dashboard when state is missing or invalid", () => {
    expect(contentStudioReturnPath(null)).toBe(CONTENT_STUDIO_DEFAULT_RETURN);
    expect(contentStudioReturnPath({ contentStudioReturnTo: "/content-studio" })).toBe(
      CONTENT_STUDIO_DEFAULT_RETURN,
    );
    expect(
      contentStudioReturnPath({
        contentStudioReturnTo: "/digital-marketing/social-media/content-studio/footage",
      }),
    ).toBe(CONTENT_STUDIO_DEFAULT_RETURN);
  });
});
