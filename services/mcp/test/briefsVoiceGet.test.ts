import { describe, expect, it, vi } from "vitest";
import { getBriefVoiceClip } from "../src/db/briefVoice";
import { MCP_TOOLS } from "../src/mcp/registry";
import { mp3FileName, readMp3, VOICE_GET_MAX_BYTES } from "../src/tools/content/briefVoiceMp3";
import { getBriefVoiceInput } from "../src/tools/content/briefsVoiceGet";

const me = { userId: "11111111-1111-4111-8111-111111111111", organizationId: "22222222-2222-4222-8222-222222222222" };
const planId = "78a62cc4-1886-4d4c-8112-6095a079425e";
const clipId = "b5b22dec-2f9e-4440-9fb0-56e43925e4ab";

function cbrMp3(audioBytes: number): Uint8Array {
  const bytes = new Uint8Array(10 + audioBytes);
  bytes.set([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], 0);
  bytes.set([0xff, 0xfb, 0x90, 0x00], 10);
  return bytes;
}

function adminFor(rows: unknown[], file: Uint8Array, size = file.byteLength) {
  const download = vi.fn(async () => ({
    data: { arrayBuffer: async () => file.slice().buffer },
    error: null,
  }));
  return {
    download,
    admin: {
      rpc: vi.fn(async () => ({ data: rows, error: null })),
      storage: {
        from: () => ({
          list: async () => ({ data: [{ name: "c1.wav", metadata: { size } }], error: null }),
          download,
        }),
      },
    },
  };
}

const row = {
  id: clipId,
  kind: "vo",
  row_index: 0,
  file_name: "vo-1.wav",
  spoken_text: "Halo",
  storage_path: "org/plan/voice/c1.wav",
  created_at: "2026-11-17T03:33:59Z",
};

describe("content.briefs.voice.get", () => {
  it("is a read tool and accepts exactly one of clip_id or row_index", () => {
    const tool = MCP_TOOLS.find((item) => item.name === "content.briefs.voice.get");
    expect(tool?.scopes).toEqual(["content:read"]);
    expect(tool?.moduleKey).toBe("digitalMarketing");
    expect(tool?.mutates).toBeUndefined();
    expect(getBriefVoiceInput.safeParse({ plan_id: planId, row_index: 0 }).success).toBe(true);
    expect(getBriefVoiceInput.safeParse({ plan_id: planId, clip_id: clipId }).success).toBe(true);
    expect(getBriefVoiceInput.safeParse({ plan_id: planId }).success).toBe(false);
    expect(getBriefVoiceInput.safeParse({ plan_id: planId, clip_id: clipId, row_index: 0 }).success).toBe(false);
  });

  it("estimates one second for 16000 MP3 audio bytes at 128 kbps", () => {
    const info = readMp3(cbrMp3(16000));
    expect(info).toEqual({ mimeType: "audio/mpeg", durationSeconds: 1 });
    expect(mp3FileName("vo-1.wav", 0)).toBe("vo-1.mp3");
    expect(readMp3(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0]))).toBeNull();
  });

  it("returns the newest MP3 bytes and hides the storage path", async () => {
    const file = cbrMp3(16000);
    const { admin } = adminFor(
      [
        row,
        { ...row, id: "40f0592b-12a8-40f9-9dc2-de829e2c65e3", created_at: "2026-11-17T02:53:15Z" },
      ],
      file,
    );
    const result = await getBriefVoiceClip(admin as never, me, { planId, clipId: null, rowIndex: 0 });
    expect(result.clip.id).toBe(clipId);
    expect(result.clip.file_name).toBe("vo-1.mp3");
    expect(result.clip.mime_type).toBe("audio/mpeg");
    expect(result.clip.duration_seconds).toBe(1);
    expect(result.clip.byte_length).toBe(file.byteLength);
    expect(Buffer.from(result.clip.audio_base64, "base64")).toEqual(Buffer.from(file));
    expect(result.clip).not.toHaveProperty("storage_path");
    expect(result.clip).not.toHaveProperty("download_url");
    expect(JSON.stringify(result.clip)).not.toContain("supabase");
  });

  it("refuses a file over 1 MB before download and a non-mp3 after download", async () => {
    const huge = adminFor([row], cbrMp3(32), VOICE_GET_MAX_BYTES + 1);
    await expect(
      getBriefVoiceClip(huge.admin as never, me, { planId, clipId, rowIndex: null }),
    ).rejects.toThrow("clip_too_large");
    expect(huge.download).not.toHaveBeenCalled();

    const wav = adminFor([row], Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4]));
    await expect(
      getBriefVoiceClip(wav.admin as never, me, { planId, clipId, rowIndex: null }),
    ).rejects.toThrow("clip_not_mp3");
  });

  it("maps a missing clip and a membership error", async () => {
    const empty = adminFor([], cbrMp3(32));
    await expect(
      getBriefVoiceClip(empty.admin as never, me, { planId, clipId: null, rowIndex: 3 }),
    ).rejects.toThrow("not_found");
    const denied = {
      rpc: vi.fn(async () => ({ data: null, error: { message: "not_a_member" } })),
      storage: { from: () => ({ list: async () => ({ data: [], error: null }), download: async () => ({ data: null, error: {} }) }) },
    };
    await expect(
      getBriefVoiceClip(denied as never, me, { planId, clipId: null, rowIndex: 0 }),
    ).rejects.toThrow("forbidden");
  });
});
