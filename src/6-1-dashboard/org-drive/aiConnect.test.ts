import { describe, expect, it } from "vitest";
import { aiConnectSteps, mcpConnectorUrl, mcpUploadHost, relativeIdTime } from "./aiConnect";

describe("aiConnect", () => {
  it("builds the connector URL and upload host from the public origin", () => {
    expect(mcpConnectorUrl("https://mcp.synckerja.com")).toBe("https://mcp.synckerja.com/mcp");
    expect(mcpConnectorUrl("https://mcp.synckerja.com/mcp/")).toBe("https://mcp.synckerja.com/mcp");
    expect(mcpUploadHost("https://mcp.synckerja.com/mcp")).toBe("mcp.synckerja.com");
    expect(mcpUploadHost("not a url")).toBe("mcp.synckerja.com");
  });

  it("marks steps done only on real evidence", () => {
    expect(aiConnectSteps({ driveConnected: false, lastToolCallAt: null, lastUploadAt: null })).toEqual({
      connector: "todo",
      drive: "todo",
      upload: "todo",
    });
    expect(
      aiConnectSteps({ driveConnected: true, lastToolCallAt: "2026-11-18T01:00:00Z", lastUploadAt: undefined }),
    ).toEqual({ connector: "done", drive: "done", upload: "todo" });
    // An AI upload proves the connector works even if the call log is empty.
    expect(aiConnectSteps({ driveConnected: true, lastToolCallAt: null, lastUploadAt: "2026-11-18T01:00:00Z" }).connector).toBe(
      "done",
    );
  });

  it("formats relative time in Indonesian", () => {
    const now = new Date("2026-11-18T10:00:00Z");
    expect(relativeIdTime("2026-11-18T09:59:40Z", now)).toBe("baru saja");
    expect(relativeIdTime("2026-11-18T09:45:00Z", now)).toBe("15 menit lalu");
    expect(relativeIdTime("2026-11-18T07:00:00Z", now)).toBe("3 jam lalu");
    expect(relativeIdTime("2026-11-16T10:00:00Z", now)).toBe("2 hari lalu");
    expect(relativeIdTime("garbage", now)).toBe("");
  });
});
