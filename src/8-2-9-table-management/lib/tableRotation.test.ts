import { describe, expect, it } from "vitest";
import {
  applyTableRotation,
  axisAlignedFootprint,
  dimsAfterRotation,
  isSidewaysRotation,
  nextRotation,
  normalizeRotation,
  normalizeTableLayoutForRotation,
} from "./tableRotation";

describe("normalizeRotation", () => {
  it("snaps to 0/90/180/270", () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(90)).toBe(90);
    expect(normalizeRotation(180)).toBe(180);
    expect(normalizeRotation(270)).toBe(270);
    expect(normalizeRotation(360)).toBe(0);
    expect(normalizeRotation(-90)).toBe(270);
  });
});

describe("nextRotation", () => {
  it("steps clockwise by 90", () => {
    expect(nextRotation(0)).toBe(90);
    expect(nextRotation(90)).toBe(180);
    expect(nextRotation(180)).toBe(270);
    expect(nextRotation(270)).toBe(0);
  });
});

describe("dimsAfterRotation", () => {
  it("swaps on odd 90° steps", () => {
    expect(dimsAfterRotation(3, 1, 0, 90)).toEqual({ grid_w: 1, grid_h: 3 });
    expect(dimsAfterRotation(3, 1, 0, 270)).toEqual({ grid_w: 1, grid_h: 3 });
    expect(dimsAfterRotation(3, 1, 0, 180)).toEqual({ grid_w: 3, grid_h: 1 });
    expect(dimsAfterRotation(3, 1, 90, 180)).toEqual({ grid_w: 1, grid_h: 3 });
  });
});

describe("isSidewaysRotation", () => {
  it("is true for 90 and 270", () => {
    expect(isSidewaysRotation(90)).toBe(true);
    expect(isSidewaysRotation(270)).toBe(true);
    expect(isSidewaysRotation(0)).toBe(false);
    expect(isSidewaysRotation(180)).toBe(false);
  });
});

describe("normalizeTableLayoutForRotation", () => {
  it("swaps legacy CSS-only vertical rectangle footprints", () => {
    const normalized = normalizeTableLayoutForRotation({
      shape: "rectangle" as const,
      grid_w: 2,
      grid_h: 1,
      rotation: 90 as const,
    });
    expect(normalized).toEqual({
      shape: "rectangle",
      grid_w: 1,
      grid_h: 2,
      rotation: 90,
    });
  });
});

describe("axisAlignedFootprint", () => {
  it("uses stored dims", () => {
    expect(axisAlignedFootprint({ grid_w: 1, grid_h: 4, rotation: 90 })).toEqual({
      grid_w: 1,
      grid_h: 4,
    });
  });
});

describe("applyTableRotation", () => {
  const base = {
    id: "a",
    grid_x: 0,
    grid_y: 0,
    grid_w: 3,
    grid_h: 1,
    rotation: 0 as const,
  };

  it("swaps footprint when rotating to 90", () => {
    const result = applyTableRotation(base, 90, []);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.table.rotation).toBe(90);
      expect(result.table.grid_w).toBe(1);
      expect(result.table.grid_h).toBe(3);
    }
  });

  it("rejects when AABB would overlap", () => {
    const blocker = {
      id: "b",
      grid_x: 0,
      grid_y: 1,
      grid_w: 1,
      grid_h: 1,
      rotation: 0 as const,
    };
    const result = applyTableRotation(base, 90, [blocker]);
    expect(result).toEqual({ ok: false, reason: "overlap" });
  });
});
