import { describe, expect, it } from "vitest";
import { ago, deviceLink, isOnline, sortJobs, tokenState, toolList, uploadSkippedNote, visibleDevices, type AgentJobRow } from "./agentData";

const NOW = new Date("2026-11-23T06:00:00Z").getTime();
const before = (ms: number) => new Date(NOW - ms).toISOString();

describe("Agent tab helpers", () => {
  it("token state: revoked wins, then expiry", () => {
    expect(tokenState({ revoked_at: null, expires_at: before(-1000) }, NOW)).toBe("aktif");
    expect(tokenState({ revoked_at: null, expires_at: before(1000) }, NOW)).toBe("kadaluarsa");
    expect(tokenState({ revoked_at: before(5), expires_at: before(-1000) }, NOW)).toBe("dicabut");
    expect(tokenState({ revoked_at: null, expires_at: null }, NOW)).toBe("aktif");
  });

  it("online only within two minutes of the last heartbeat", () => {
    expect(isOnline(before(60_000), NOW)).toBe(true);
    expect(isOnline(before(130_000), NOW)).toBe(false);
    expect(isOnline(null, NOW)).toBe(false);
  });

  it("drops a laptop as soon as its token is revoked, even after a fresh heartbeat", () => {
    const active = { revoked_at: null, expires_at: before(-86_400_000) };
    const cut = {
      id: "cut",
      last_seen_at: before(10_000),
      token_id: "revoked",
      token: { revoked_at: before(1_000), expires_at: before(-86_400_000) },
    };
    const live = { id: "live", last_seen_at: before(10_000), token_id: "ok", token: active };
    expect(deviceLink(cut, NOW)).toBe("terputus");
    expect(deviceLink({ last_seen_at: before(10_000), token_id: "old", token: { revoked_at: null, expires_at: before(1_000) } }, NOW)).toBe("terputus");
    expect(deviceLink({ last_seen_at: before(10_000), token_id: null, token: null }, NOW)).toBe("terputus");
    expect(deviceLink(live, NOW)).toBe("online");
    expect(visibleDevices([cut, live], NOW).map((row) => row.id)).toEqual(["live"]);
    expect(visibleDevices([cut], NOW).map((row) => row.id)).toEqual(["cut"]);
    const older = { ...cut, id: "older", last_seen_at: before(30 * 60_000) };
    expect(visibleDevices([older, { ...cut, id: "newer" }], NOW).map((row) => row.id)).toEqual(["newer"]);
  });

  it("ago reads naturally", () => {
    expect(ago(before(10_000), NOW)).toBe("baru saja");
    expect(ago(before(5 * 60_000), NOW)).toBe("5 menit lalu");
    expect(ago(before(3 * 3600_000), NOW)).toBe("3 jam lalu");
    expect(ago(before(2 * 86400_000), NOW)).toBe("2 hari lalu");
    expect(ago(null, NOW)).toBe("belum pernah");
  });

  it("tool list puts missing tools first and ignores junk", () => {
    const list = toolList({
      ffmpeg: { ok: true, version: "7.1" },
      sam2: { ok: false, detail: "model tidak ada" },
      junk: "x",
    });
    expect(list).toEqual([
      { key: "sam2", ok: false, detail: "model tidak ada" },
      { key: "ffmpeg", ok: true, detail: "7.1" },
    ]);
    expect(toolList(null)).toEqual([]);
  });
});

describe("render queue order", () => {
  it("shows waiting and running jobs first, oldest first, then the rest newest first", () => {
    const job = (id: string, status: AgentJobRow["status"], created_at: string) => ({ id, status, created_at }) as AgentJobRow;
    const out = sortJobs([
      job("old-done", "done", "2026-11-23T01:00:00Z"),
      job("q2", "queued", "2026-11-23T03:00:00Z"),
      job("run", "running", "2026-11-23T02:00:00Z"),
      job("new-fail", "failed", "2026-11-23T04:00:00Z"),
    ]);
    expect(out.map((j) => j.id)).toEqual(["run", "q2", "new-fail", "old-done"]);
  });
});

describe("stillsPath", () => {
  const org = "5fa70166-0a35-4f0d-94b3-54f19b3f8c30";
  it("returns the uploaded sheet of a done still job in this organization only", async () => {
    const { stillsPath } = await import("./agentData");
    const ok = `${org}/render-stills/j1.jpg`;
    expect(stillsPath({ status: "done", result: { stills_path: ok } }, org)).toBe(ok);
    expect(stillsPath({ status: "running", result: { stills_path: ok } }, org)).toBeNull();
    expect(stillsPath({ status: "done", result: { stills_path: "other/render-stills/j1.jpg" } }, org)).toBeNull();
    expect(stillsPath({ status: "done", result: { stills_file: "P/_build/still/a.jpg" } }, org)).toBeNull();
    expect(stillsPath({ status: "done", result: { stills_path: `${org}/render-stills/../x.jpg` } }, org)).toBeNull();
  });
});

describe("uploadSkippedNote", () => {
  it("explains why a finished render is not in the plan, and stays quiet otherwise", () => {
    expect(uploadSkippedNote({ output_file: "a.mp4", upload_skipped: "not_approved" })).toMatch(/brief belum di-approve/);
    expect(uploadSkippedNote({ upload_skipped: "not_connected" })).toMatch(/Google Drive/);
    expect(uploadSkippedNote({ upload_skipped: "something_new" })).toBe("Belum masuk plan (something_new).");
    expect(uploadSkippedNote({ upload_skipped: "stills" })).toBeNull();
    expect(uploadSkippedNote({ version_no: 1, google_drive_link: "https://d/x", upload_skipped: null })).toBeNull();
    expect(uploadSkippedNote({ upload_skipped: "not_approved", google_drive_link: "https://d/x" })).toBeNull();
    expect(uploadSkippedNote(null)).toBeNull();
  });
});
