import { describe, expect, it } from "vitest";
import { mapMetaFlowToRow, parseMetaFlowUpdatedAt } from "./mapMetaFlowToRow";

describe("parseMetaFlowUpdatedAt", () => {
  it("parses ISO string", () => {
    expect(parseMetaFlowUpdatedAt("2024-03-15T10:30:00.000Z")).toBe("2024-03-15T10:30:00.000Z");
  });

  it("parses Unix seconds", () => {
    const iso = parseMetaFlowUpdatedAt(1710000000);
    expect(iso).toBe(new Date(1710000000 * 1000).toISOString());
  });

  it("parses Unix milliseconds", () => {
    const ms = 1710000000000;
    expect(parseMetaFlowUpdatedAt(ms)).toBe(new Date(ms).toISOString());
  });

  it("returns null for empty or invalid", () => {
    expect(parseMetaFlowUpdatedAt(null)).toBeNull();
    expect(parseMetaFlowUpdatedAt("")).toBeNull();
    expect(parseMetaFlowUpdatedAt("not-a-date")).toBeNull();
  });
});

describe("mapMetaFlowToRow", () => {
  it("maps updated_at ISO to lastUpdatedAt", () => {
    const row = mapMetaFlowToRow({
      id: "flow-1",
      name: "Test Flow",
      status: "DRAFT",
      updated_at: "2024-06-01T12:00:00.000Z",
    });
    expect(row.lastUpdatedAt).toBe("2024-06-01T12:00:00.000Z");
    expect(row.kind).toBe("meta_form");
  });

  it("falls back to updated_time when updated_at absent", () => {
    const row = mapMetaFlowToRow({
      id: "flow-2",
      name: "Legacy",
      status: "PUBLISHED",
      updated_time: "2024-07-01T08:00:00.000Z",
    });
    expect(row.lastUpdatedAt).toBe("2024-07-01T08:00:00.000Z");
    expect(row.status).toBe("ACTIVE");
  });

  it("returns null lastUpdatedAt when no timestamp fields", () => {
    const row = mapMetaFlowToRow({ id: "flow-3", name: "No date", status: "DRAFT" });
    expect(row.lastUpdatedAt).toBeNull();
  });
});
