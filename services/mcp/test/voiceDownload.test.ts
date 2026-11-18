import { describe, expect, it, vi } from "vitest";
import { downloadVoiceClip, getBriefVoiceClip } from "../src/db/briefVoice";
import {
  mintVoiceDownloadToken,
  verifyVoiceDownloadToken,
  voiceDownloadKey,
  VOICE_DOWNLOAD_NEXT_STEP,
  VOICE_DOWNLOAD_TTL_SECONDS,
} from "../src/tools/content/voiceDownload";

const me = { userId: "11111111-1111-4111-8111-111111111111", organizationId: "22222222-2222-4222-8222-222222222222" };
const planId = "78a62cc4-1886-4d4c-8112-6095a079425e";
const clipId = "b5b22dec-2f9e-4440-9fb0-56e43925e4ab";
const NOW = Date.parse("2026-11-18T05:00:00Z");
const key = voiceDownloadKey("test-secret-at-least-16");
const signer = { key, publicUrl: "https://mcp.synckerja.com/", now: () => NOW };

function cbrMp3(audioBytes: number): Uint8Array {
  const bytes = new Uint8Array(10 + audioBytes);
  bytes.set([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], 0);
  bytes.set([0xff, 0xfb, 0x90, 0x00], 10);
  return bytes;
}

const row = {
  id: clipId,
  kind: "vo",
  row_index: 2,
  file_name: "vo-3.wav",
  spoken_text: "Malam Minggu di Sate Sultan",
  storage_path: "org/plan/voice/c1.wav",
  created_at: "2026-11-17T03:33:59Z",
};

function adminFor(rows: unknown[] | null, file: Uint8Array, rpcError: string | null = null) {
  const rpc = vi.fn(async () => (rpcError ? { data: null, error: { message: rpcError } } : { data: rows, error: null }));
  return {
    rpc,
    admin: {
      rpc,
      storage: {
        from: () => ({
          list: async () => ({ data: [{ name: "c1.wav", metadata: { size: file.byteLength } }], error: null }),
          download: async () => ({ data: { arrayBuffer: async () => file.slice().buffer }, error: null }),
        }),
      },
    },
  };
}

describe("VO download token", () => {
  it("round-trips and binds user, org, plan and clip", () => {
    const { token, expiresAt } = mintVoiceDownloadToken(key, { ...me, planId, clipId }, NOW);
    expect(expiresAt).toBe(NOW / 1000 + VOICE_DOWNLOAD_TTL_SECONDS);
    const check = verifyVoiceDownloadToken(key, token, NOW + 60_000);
    expect(check).toEqual({ ok: true, claims: { ...me, planId, clipId, expiresAt } });
  });

  it("rejects expiry, tampering, another key and garbage", () => {
    const { token } = mintVoiceDownloadToken(key, { ...me, planId, clipId }, NOW);
    expect(verifyVoiceDownloadToken(key, token, NOW + VOICE_DOWNLOAD_TTL_SECONDS * 1000)).toEqual({
      ok: false,
      reason: "expired",
    });
    const [v, payload, sig] = token.split(".");
    const other = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(payload!, "base64url").toString()), c: "40f0592b-12a8-40f9-9dc2-de829e2c65e3" }),
    ).toString("base64url");
    expect(verifyVoiceDownloadToken(key, `${v}.${other}.${sig}`, NOW).ok).toBe(false);
    expect(verifyVoiceDownloadToken(voiceDownloadKey("another-secret-16chars"), token, NOW)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
    expect(verifyVoiceDownloadToken(key, "nope", NOW)).toEqual({ ok: false, reason: "malformed" });
    expect(verifyVoiceDownloadToken(key, "", NOW).ok).toBe(false);
  });

  it("uses a key separate from the raw JWT secret", () => {
    expect(voiceDownloadKey("abc-secret-123456").equals(Buffer.from("abc-secret-123456"))).toBe(false);
  });
});

describe("content.briefs.voice.get download link", () => {
  it("returns a 15-minute MCP-host link and no base64 by default", async () => {
    const { admin } = adminFor([row], cbrMp3(16000));
    const result = await getBriefVoiceClip(admin as never, me, { planId, clipId: null, rowIndex: 2, includeBase64: false }, signer);
    expect(result.clip.file_name).toBe("vo-3.mp3");
    expect(result.clip.duration_seconds).toBe(1);
    expect(result.clip.download_url).toMatch(/^https:\/\/mcp\.synckerja\.com\/downloads\/voice\/v1\.[^/]+$/);
    expect(result.clip.download_expires_at).toBe("2026-11-18T05:15:00.000Z");
    expect(result.clip).not.toHaveProperty("audio_base64");
    expect(JSON.stringify(result)).not.toContain("supabase");
    expect(JSON.stringify(result)).not.toContain("storage_path");
  });

  it("adds base64 only on request, still capped at 1 MB", async () => {
    const { admin } = adminFor([row], cbrMp3(16000));
    const result = await getBriefVoiceClip(admin as never, me, { planId, clipId, rowIndex: null, includeBase64: true }, signer);
    expect(Buffer.from(result.clip.audio_base64!, "base64").byteLength).toBe(16010);

    const big = adminFor([row], cbrMp3(1_200_000));
    await expect(
      getBriefVoiceClip(big.admin as never, me, { planId, clipId, rowIndex: null, includeBase64: true }, signer),
    ).rejects.toThrow("clip_too_large");
    const link = await getBriefVoiceClip(big.admin as never, me, { planId, clipId, rowIndex: null, includeBase64: false }, signer);
    expect(link.clip.byte_length).toBe(1_200_010);
  });
});

describe("GET /downloads/voice/<token>", () => {
  const fresh = () => mintVoiceDownloadToken(key, { ...me, planId, clipId }, NOW).token;

  it("re-checks membership with the token's user and org, then serves the MP3", async () => {
    const file = cbrMp3(16000);
    const { admin, rpc } = adminFor([row], file);
    const res = await downloadVoiceClip(admin as never, key, fresh(), NOW + 1000);
    expect(res).toEqual({ status: 200, fileName: "vo-3.mp3", bytes: file });
    expect(rpc).toHaveBeenCalledWith("mcp_list_brief_voice_clips", {
      p_user_id: me.userId,
      p_organization_id: me.organizationId,
      p_plan_id: planId,
    });
  });

  it("answers each failure with a code and next step", async () => {
    const file = cbrMp3(16000);
    const expired = await downloadVoiceClip(adminFor([row], file).admin as never, key, fresh(), NOW + 16 * 60_000);
    expect(expired).toEqual({ status: 410, body: { error: "expired", next_step: VOICE_DOWNLOAD_NEXT_STEP.expired } });

    const forged = await downloadVoiceClip(adminFor([row], file).admin as never, voiceDownloadKey("x".repeat(20)), fresh(), NOW);
    expect(forged.status).toBe(404);
    expect("body" in forged && forged.body.error).toBe("unknown_link");

    const removed = await downloadVoiceClip(adminFor([], file).admin as never, key, fresh(), NOW);
    expect("body" in removed && removed.body.error).toBe("not_found");

    const leftOrg = await downloadVoiceClip(adminFor(null, file, "not_a_member").admin as never, key, fresh(), NOW);
    expect(leftOrg.status).toBe(403);

    const wav = await downloadVoiceClip(
      adminFor([row], Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4])).admin as never,
      key,
      fresh(),
      NOW,
    );
    expect("body" in wav && wav.body.error).toBe("clip_not_mp3");

    for (const step of Object.values(VOICE_DOWNLOAD_NEXT_STEP)) expect(step.length).toBeGreaterThan(20);
  });
});
