import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CONTENT_STUDIO_BASE, STUDIO_TABS } from "./studioTabs";

describe("Content Studio routes", () => {
  it("every ready tab has its own route in App.tsx, or the tab opens a 404", () => {
    const app = fs.readFileSync(path.resolve(__dirname, "../App.tsx"), "utf8");
    for (const t of STUDIO_TABS.filter((x) => x.ready)) {
      expect(app, `route for ${t.id}`).toContain(`path="${CONTENT_STUDIO_BASE}/${t.id}"`);
    }
  });
});
