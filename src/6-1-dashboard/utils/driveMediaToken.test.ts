import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@/shared/lib/supabaseClient", () => ({
  SUPABASE_URL: "https://example.supabase.co",
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

import { buildDriveMediaUrl, clearDriveMediaTokens, getDriveMediaToken } from "./driveMediaToken";

const nowSec = () => Math.floor(Date.now() / 1000);

describe("driveMediaToken", () => {
  beforeEach(() => {
    invoke.mockReset();
    clearDriveMediaTokens();
  });

  it("mints once and reuses a fresh token (also for concurrent callers)", async () => {
    invoke.mockResolvedValue({ data: { media_token: "tok-1", expires_at: nowSec() + 6 * 3600 }, error: null });
    const [a, b] = await Promise.all([getDriveMediaToken("FILE"), getDriveMediaToken("FILE")]);
    const c = await getDriveMediaToken("FILE");
    expect([a, b, c]).toEqual(["tok-1", "tok-1", "tok-1"]);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("google-drive-media-token", { body: { file_id: "FILE" } });
  });

  it("re-mints when the cached token is about to expire", async () => {
    invoke
      .mockResolvedValueOnce({ data: { media_token: "old", expires_at: nowSec() + 60 }, error: null })
      .mockResolvedValueOnce({ data: { media_token: "new", expires_at: nowSec() + 6 * 3600 }, error: null });
    expect(await getDriveMediaToken("FILE")).toBe("old");
    expect(await getDriveMediaToken("FILE")).toBe("new");
  });

  it("returns null on error and does not cache the failure", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new Error("401") });
    expect(await getDriveMediaToken("FILE")).toBeNull();
    invoke.mockResolvedValueOnce({ data: { media_token: "ok", expires_at: nowSec() + 3600 }, error: null });
    expect(await getDriveMediaToken("FILE")).toBe("ok");
  });

  it("builds URLs with media_token and never a session token", () => {
    const url = new URL(buildDriveMediaUrl("google-drive-file-media", "FILE", "tok"));
    expect(url.pathname).toBe("/functions/v1/google-drive-file-media");
    expect(url.searchParams.get("file_id")).toBe("FILE");
    expect(url.searchParams.get("media_token")).toBe("tok");
    expect(url.searchParams.has("supabase_token")).toBe(false);
  });
});
