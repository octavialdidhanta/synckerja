import { describe, expect, it } from "vitest";
import { ago, isOnline, sortJobs, tokenState, toolList, type AgentJobRow } from "./agentData";

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
