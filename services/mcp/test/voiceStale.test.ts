import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { getContentBrief } from "../src/db/contentBriefs";
import { listBriefVoiceClips } from "../src/db/briefVoice";
import { MCP_SERVER_INSTRUCTIONS } from "../src/mcp/instructions";
import { MCP_TOOLS } from "../src/mcp/registry";
import { narrationSource, voiceClipStale } from "../src/tools/content/voiceStale";

const me = { userId: "user-1", organizationId: "org-1" };
const planId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

function storyboard(firstVo: string, secondVo: string) {
  return [
    "| Timing | VO (Voice Over) |",
    "| --- | --- |",
    `| 0-2 | ${firstVo} |`,
    `| 3-5 | ${secondVo} |`,
  ].join("\n");
}

function clip(rowIndex: number, spoken: string, id = `c-${rowIndex}`) {
  return {
    id,
    kind: "vo",
    row_index: rowIndex,
    file_name: `vo-${rowIndex + 1}.mp3`,
    spoken_text: spoken,
    storage_path: `org/plan/voice/${id}.mp3`,
    created_at: "2026-11-17T01:00:00Z",
  };
}

function adminFor(
  brief: string,
  voiceOver: string | null,
  clips: ReturnType<typeof clip>[],
  shots?: Array<{ id: string; row_index: number }>,
) {
  const rpc = vi.fn(async (name: string) => {
    if (name === "mcp_list_brief_voice_clips") return { data: clips, error: null };
    if (name === "mcp_get_content_brief") {
      return {
        data: [
          {
            id: planId,
            title: "Sate",
            status: "draft",
            approved: false,
            production_status: null,
            post_date: null,
            updated_at: null,
            content_type_name: "Reel",
            service_name: null,
            sub_service_name: null,
            feature_name: null,
            pillar_name: null,
            pic_name: null,
            brief,
            concept: voiceOver ? { voice_over: voiceOver } : null,
            concept_text: null,
            caption: null,
            has_drive_file: false,
            published: false,
            version_no: 1,
          },
        ],
        error: null,
      };
    }
    throw new Error(name);
  });
  const admin = {
    rpc,
    from: shots
      ? () => ({
          select: () => ({
            eq: () => ({
              order: async () => ({ data: shots, error: null }),
            }),
          }),
        })
      : undefined,
  };
  return admin as unknown as SupabaseClient;
}

describe("voiceClipStale", () => {
  it("keeps a clip fresh when the line is unchanged", () => {
    expect(voiceClipStale("Halo warga PIK", "Halo warga PIK")).toBe(false);
  });

  it("marks a clip stale when the line changes", () => {
    expect(voiceClipStale("Halo warga PIK", "Halo warga Bandung")).toBe(true);
  });

  it("ignores audio tags and extra spaces", () => {
    expect(voiceClipStale("[playful]  Halo   PIK", "Halo PIK")).toBe(false);
  });

  it("uses the full voice over only when the vo cell is empty", () => {
    expect(narrationSource("", "Naskah penuh")).toBe("Naskah penuh");
    expect(narrationSource("  ", "Naskah penuh")).toBe("Naskah penuh");
    expect(voiceClipStale("Naskah penuh", narrationSource("", "Naskah penuh"))).toBe(false);
    expect(voiceClipStale("Naskah penuh", narrationSource("", "Naskah baru"))).toBe(true);
    expect(narrationSource("Halo", "Naskah baru")).toBe("Halo");
    expect(voiceClipStale("Halo", narrationSource("Halo", "Naskah baru"))).toBe(false);
  });
});

describe("content.briefs.get voice_stale", () => {
  it("marks only the row whose vo changed, and keeps has_voice when the file still exists", async () => {
    const admin = adminFor(storyboard("Halo", ""), "Naskah penuh", [
      clip(0, "[curious] Halo"),
      clip(1, "Naskah lama"),
    ]);
    const detail = await getContentBrief(admin, me, planId);
    const shots = detail.storyboard?.sequences.flatMap((sequence) => sequence.shots) ?? [];
    expect(shots[0]).toMatchObject({ has_voice: true, voice_stale: false, vo: "Halo" });
    expect(shots[1]).toMatchObject({ has_voice: true, voice_stale: true, vo: "" });
  });

  it("does not mark a filled vo cell stale when only voice_over changes", async () => {
    const admin = adminFor(storyboard("Halo", "Baris dua"), "Naskah yang berubah", [clip(0, "Halo")]);
    const detail = await getContentBrief(admin, me, planId);
    const shots = detail.storyboard?.sequences.flatMap((sequence) => sequence.shots) ?? [];
    expect(shots[0]).toMatchObject({ has_voice: true, voice_stale: false });
    expect(shots[1]).toMatchObject({ has_voice: false, voice_stale: false });
  });

  it("follows shot_id when the stored row index is old", async () => {
    const moved = { ...clip(0, "Baris dua", "moved"), shot_id: "shot-b" };
    const admin = adminFor(storyboard("Halo", "Baris dua"), null, [moved], [
      { id: "shot-a", row_index: 0 },
      { id: "shot-b", row_index: 1 },
    ]);
    const detail = await getContentBrief(admin, me, planId);
    const shots = detail.storyboard?.sequences.flatMap((sequence) => sequence.shots) ?? [];
    expect(shots[0]).toMatchObject({ shot_id: "shot-a", has_voice: false, voice_stale: false });
    expect(shots[1]).toMatchObject({ shot_id: "shot-b", has_voice: true, voice_stale: false, vo: "Baris dua" });
  });

  it("says the file exists and that voice_stale means generate again", () => {
    const tool = MCP_TOOLS.find((item) => item.name === "content.briefs.get");
    expect(tool?.description).toContain("has_voice means an ElevenLabs VO file exists");
    expect(tool?.description).toContain("voice_stale");
    expect(tool?.description).toContain("generate again");
    expect(MCP_SERVER_INSTRUCTIONS).toContain("voice_stale");
    expect(tool?.description).toContain("shot_id");
  });
});

describe("content.briefs.voice.list stale", () => {
  it("compares the newest clip with the same source as content.briefs.get", async () => {
    const admin = adminFor(storyboard("Halo", ""), "Naskah penuh", [
      clip(0, "Halo", "new"),
      { ...clip(0, "Lama", "old"), created_at: "2026-11-16T01:00:00Z" },
      clip(1, "Naskah penuh"),
    ]);
    const result = await listBriefVoiceClips(admin, "https://proj.supabase.co", me, planId);
    expect(result.clips).toEqual([
      expect.objectContaining({ id: "new", row_index: 0, stale: false }),
      expect.objectContaining({ id: "c-1", row_index: 1, stale: false }),
    ]);
    expect(result.how_to_read).toContain("stale is true");
    const tool = MCP_TOOLS.find((item) => item.name === "content.briefs.voice.list");
    expect(tool?.description).toContain("stale means the clip no longer matches");
  });
});
