import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { briefVoicePublicUrl, generateBriefVoiceClip, listBriefVoiceClips } from "../src/db/briefVoice";
import { MCP_TOOLS } from "../src/mcp/registry";
import { generateBriefVoiceInput } from "../src/tools/content/briefsVoiceGenerate";
import { listBriefVoiceInput } from "../src/tools/content/briefsVoiceList";

const sql = readFileSync(
  new URL("../../../supabase/migrations/20261117080000_mcp_list_brief_voice_clips.sql", import.meta.url),
  "utf8",
);

const me = { userId: "11111111-1111-4111-8111-111111111111", organizationId: "22222222-2222-4222-8222-222222222222" };
const planId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

describe("content.briefs.voice registry", () => {
  it("lists as a read tool and generate as a mutating write tool", () => {
    const list = MCP_TOOLS.find((item) => item.name === "content.briefs.voice.list");
    const generate = MCP_TOOLS.find((item) => item.name === "content.briefs.voice.generate");
    expect(list?.scopes).toEqual(["content:read"]);
    expect(list?.moduleKey).toBe("digitalMarketing");
    expect(list?.mutates).toBeUndefined();
    expect(generate?.scopes).toEqual(["content:write"]);
    expect(generate?.mutates).toBe(true);
  });

  it("validates list and generate inputs", () => {
    expect(listBriefVoiceInput.safeParse({ plan_id: planId }).success).toBe(true);
    expect(listBriefVoiceInput.safeParse({ plan_id: "nope" }).success).toBe(false);
    expect(generateBriefVoiceInput.safeParse({ plan_id: planId, row_index: 0 }).success).toBe(true);
    expect(generateBriefVoiceInput.safeParse({ plan_id: planId, row_index: -1 }).success).toBe(false);
    expect(generateBriefVoiceInput.safeParse({ plan_id: planId, row_index: 0, text: "x".repeat(5001) }).success).toBe(
      false,
    );
  });
});

describe("mcp_list_brief_voice_clips SQL", () => {
  it("is locked to the session organization and to service_role", () => {
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path TO 'public'");
    expect(sql).toContain("plan.organization_id = p_organization_id");
    expect(sql).toContain("RAISE EXCEPTION 'not_a_member'");
    expect(sql).toContain("clip.kind = 'vo'");
    expect(sql).toContain("FROM anon, authenticated");
    expect(sql).toContain("TO service_role");
    expect(sql).not.toMatch(/GRANT EXECUTE[^;]*(anon|authenticated)/);
  });
});

describe("briefVoicePublicUrl", () => {
  it("builds a public brief-visual-images URL without exposing raw path encoding mistakes", () => {
    const url = briefVoicePublicUrl("https://proj.supabase.co/", "org/plan/voice/a b.mp3");
    expect(url).toBe("https://proj.supabase.co/storage/v1/object/public/brief-visual-images/org/plan/voice/a%20b.mp3");
  });
});

describe("listBriefVoiceClips", () => {
  it("returns empty clips without error and hides storage_path", async () => {
    const admin = {
      rpc: vi.fn(async () => ({ data: [], error: null })),
    };
    const result = await listBriefVoiceClips(admin as never, "https://proj.supabase.co", me, planId);
    expect(result.count).toBe(0);
    expect(result.clips).toEqual([]);
    expect(result.plan_id).toBe(planId);
    expect(JSON.stringify(result)).not.toContain("storage_path");
  });

  it("dedupes by row_index keeping the newest first row from RPC", async () => {
    const admin = {
      rpc: vi.fn(async () => ({
        data: [
          {
            id: "c1",
            kind: "vo",
            row_index: 0,
            file_name: "vo-1.mp3",
            spoken_text: "Halo",
            storage_path: "org/plan/voice/c1.mp3",
            created_at: "2026-11-17T01:00:00Z",
          },
          {
            id: "c0",
            kind: "vo",
            row_index: 0,
            file_name: "vo-1-old.mp3",
            spoken_text: "Lama",
            storage_path: "org/plan/voice/c0.mp3",
            created_at: "2026-11-16T01:00:00Z",
          },
        ],
        error: null,
      })),
    };
    const result = await listBriefVoiceClips(admin as never, "https://proj.supabase.co", me, planId);
    expect(result.count).toBe(1);
    expect(result.clips[0].id).toBe("c1");
    expect(result.clips[0].download_url).toContain("/brief-visual-images/org/plan/voice/c1.mp3");
    expect(result.clips[0]).not.toHaveProperty("storage_path");
  });

  it("maps membership errors to forbidden", async () => {
    const admin = {
      rpc: vi.fn(async () => ({ data: null, error: { message: "not_a_member" } })),
    };
    await expect(listBriefVoiceClips(admin as never, "https://proj.supabase.co", me, planId)).rejects.toThrow(
      "forbidden",
    );
  });
});

describe("generateBriefVoiceClip", () => {
  it("maps PIC rejection and returns download_url on success", async () => {
    const admin = { rpc: vi.fn() };
    const config = {
      supabaseUrl: "https://proj.supabase.co",
      supabaseServiceRoleKey: "service",
      scheduledPostsInternalSecret: "secret",
    };

    const denied = vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: "Hanya PIC plan yang bisa membuat suara." }),
    }));
    await expect(
      generateBriefVoiceClip(admin as never, config, me, { planId, rowIndex: 0, text: "Halo" }, denied as never),
    ).rejects.toThrow("not_pic");

    const ok = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        clip: {
          id: "clip-1",
          kind: "vo",
          row_index: 0,
          file_name: "vo-1.wav",
          spoken_text: "Halo",
          storage_path: "org/plan/voice/clip-1.wav",
          created_at: "2026-11-17T02:00:00Z",
        },
        taggedText: null,
      }),
    }));
    const result = await generateBriefVoiceClip(
      admin as never,
      config,
      me,
      { planId, rowIndex: 0, text: "Halo" },
      ok as never,
    );
    expect(result.clip.download_url).toContain("clip-1.wav");
    expect(result.clip).not.toHaveProperty("storage_path");
  });
});
