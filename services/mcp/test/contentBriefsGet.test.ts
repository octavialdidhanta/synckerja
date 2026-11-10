import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { getContentBrief, toContentBriefDetail } from "../src/db/contentBriefs";
import { MCP_TOOLS } from "../src/mcp/registry";
import { buildBriefMarkdown } from "../src/tools/content/briefMarkdown";
import { parseStoredBrief } from "../src/tools/content/briefRead";
import { getBriefInput } from "../src/tools/content/briefsGet";

const sql = readFileSync(
  new URL("../../../supabase/migrations/20261110090000_mcp_get_content_brief.sql", import.meta.url),
  "utf8",
);
const me = { userId: "user-1", organizationId: "org-1" };
const planId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

function storedRow(brief: string, extra: Record<string, unknown> = {}) {
  return {
    id: planId,
    title: "Sum sum kambing dapur",
    status: "draft",
    approved: false,
    production_status: null,
    post_date: null,
    updated_at: "2026-11-10T02:00:00Z",
    content_type_name: "Reel",
    service_name: "Sate",
    sub_service_name: null,
    feature_name: null,
    pillar_name: null,
    pic_name: "Octa",
    brief,
    concept: null,
    concept_text: null,
    caption: null,
    has_drive_file: true,
    published: false,
    ...extra,
  };
}

describe("content.briefs.get registry", () => {
  it("is a read-only content tool behind the content page", () => {
    const tool = MCP_TOOLS.find((item) => item.name === "content.briefs.get");
    expect(tool?.scopes).toEqual(["content:read"]);
    expect(tool?.moduleKey).toBe("digitalMarketing");
    expect(tool?.mutates).toBeUndefined();
  });

  it("only accepts one uuid id", () => {
    expect(getBriefInput.safeParse({ id: planId }).success).toBe(true);
    expect(getBriefInput.safeParse({ id: "nope" }).success).toBe(false);
    expect(getBriefInput.safeParse({ id: planId, organization_id: planId }).success).toBe(false);
  });
});

describe("mcp_get_content_brief SQL", () => {
  it("is locked to the session organization and to service_role", () => {
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path TO 'public'");
    expect(sql).toContain("plan.organization_id = p_organization_id");
    expect(sql).toContain("RAISE EXCEPTION 'not_a_member'");
    expect(sql).toContain("FROM anon, authenticated");
    expect(sql).toContain("TO service_role");
    expect(sql).not.toMatch(/GRANT EXECUTE[^;]*(anon|authenticated)/);
  });

  it("never returns Drive links, published links, or image paths", () => {
    expect(sql.match(/google_drive_link/g)).toHaveLength(1);
    expect(sql).toContain("NULLIF(btrim(COALESCE(plan.google_drive_link, '')), '') IS NOT NULL");
    expect(sql.match(/post_link/g)).toHaveLength(1);
    expect(sql).toContain("COALESCE(plan.post_link::text, 'null') NOT IN");
    expect(sql).not.toMatch(/'(portraitPath|bodyPath|locationPath|propertyPath)'/);
  });
});

describe("parseStoredBrief", () => {
  it("reads a brief written by content.briefs.create back into its sequences", () => {
    const markdown = buildBriefMarkdown([
      {
        name: "Hook",
        shots: [{ timing: "0-2 dtk", visual: "Close-up sumsum disedot", vo: "Sumsumnya sampai disedot!", element: "", tagging: "" }],
      },
      {
        name: "CTA",
        shots: [
          { timing: "3-5 dtk", visual: "Gerai malam", vo: "Chat WA sekarang", element: "Teks: PIK 1", tagging: "@satesultan" },
          { timing: "6-8 dtk", visual: "Logo", vo: "", element: "", tagging: "" },
        ],
      },
    ]);
    const { storyboard, notes } = parseStoredBrief(markdown);
    expect(notes).toBeNull();
    expect(storyboard?.shot_count).toBe(3);
    expect(storyboard?.sequences.map((sequence) => sequence.name)).toEqual(["Hook", "CTA"]);
    const hook = storyboard?.sequences[0].shots[0];
    expect(hook?.vo).toBe("Sumsumnya sampai disedot!");
    expect(hook?.scene).toBe("Close-up sumsum disedot");
    expect(storyboard?.sequences[1].shots[0].element).toBe("Teks: PIK 1");
  });

  it("keeps unknown columns in extra and hides image references", () => {
    const markdown = [
      "Catatan: fokus malam hari",
      "",
      "| Timing | Visual | VO (Voice Over) | Shot | Column 5 |",
      "| --- | --- | --- | --- | --- |",
      "| 0-2 | ![img](storage/org/a.png) | Halo<br>PIK | ECU | |",
    ].join("\n");
    const { storyboard, notes } = parseStoredBrief(markdown);
    expect(notes).toBe("Catatan: fokus malam hari");
    expect(storyboard?.columns).toEqual(["Timing", "Visual", "VO (Voice Over)", "Shot"]);
    const shot = storyboard?.sequences[0].shots[0];
    expect(shot?.has_image).toBe(true);
    expect(shot?.visual).toBe("");
    expect(shot?.vo).toBe("Halo\nPIK");
    expect(shot?.extra).toEqual({ Shot: "ECU" });
    expect(JSON.stringify(storyboard)).not.toContain("storage/");
  });

  it("ignores hidden editor comments and blank rows", () => {
    const markdown = [
      "| Timing | VO (Voice Over) | Brief | Column 9 |",
      "| --- | --- | --- | --- |",
      "| 15 - 20 | | Hook<br>flow | |",
      "| | | | |",
      "| | | | |",
      "",
      '<!--synckerja-brief-sequences:[{"id":"a","name":"Opening","rowCount":1},{"id":"b","name":"Sequence 2","rowCount":2}]-->',
      '<!--synckerja-brief-scene-meta:[{"row":0,"characterIds":["x"]}]-->',
    ].join("\n");
    const { storyboard, notes } = parseStoredBrief(markdown);
    expect(notes).toBeNull();
    expect(storyboard?.shot_count).toBe(1);
    expect(storyboard?.sequences).toHaveLength(1);
    expect(storyboard?.sequences[0].name).toBe("Opening");
    expect(storyboard?.sequences[0].shots[0].extra).toEqual({ Brief: "Hook\nflow" });
  });

  it("returns plain text briefs as notes", () => {
    expect(parseStoredBrief("GRAND Opening minggu ini")).toEqual({
      storyboard: null,
      notes: "GRAND Opening minggu ini",
    });
    expect(parseStoredBrief(null)).toEqual({ storyboard: null, notes: null });
  });
});

describe("getContentBrief", () => {
  it("passes the session ids and maps errors to clean codes", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "ERROR: not_found" } });
    const admin = { rpc } as unknown as SupabaseClient;
    await expect(getContentBrief(admin, me, planId)).rejects.toThrow("not_found");
    expect(rpc).toHaveBeenCalledWith("mcp_get_content_brief", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_id: planId,
    });

    rpc.mockResolvedValueOnce({ data: null, error: { message: "permission denied for table x" } });
    await expect(getContentBrief(admin, me, planId)).rejects.toThrow("request_failed");
    rpc.mockResolvedValueOnce({ data: [], error: null });
    await expect(getContentBrief(admin, me, planId)).rejects.toThrow("not_found");
  });

  it("returns the concept assets, caption, and reading guide", () => {
    const detail = toContentBriefDetail(
      storedRow("| Timing | VO (Voice Over) |\n| --- | --- |\n| 0-2 | Halo |", {
        concept: {
          voice_over: "Halo warga PIK",
          post_aspect: null,
          locations: [{ handle: "@location_gerai", description: "Gerai malam" }],
          characters: [],
          properties: "bad",
        },
        caption: "  Chat WA  ",
      }),
    );
    expect(detail.voice_over).toBe("Halo warga PIK");
    expect(detail.locations).toEqual([{ handle: "@location_gerai", description: "Gerai malam" }]);
    expect(detail.properties).toEqual([]);
    expect(detail.caption).toBe("Chat WA");
    expect(detail.storyboard?.shot_count).toBe(1);
    expect(detail.how_to_read).toContain("ads.performance.breakdown");
    expect(detail).not.toHaveProperty("google_drive_link");
  });
});
