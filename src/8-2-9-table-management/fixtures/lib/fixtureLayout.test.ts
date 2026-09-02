import { describe, expect, it } from "vitest";
import {
  edgeStripLayout,
  normalizeEdgeStripFootprint,
  normalizeFixedCellFootprint,
  resizeFixtureAlongAxis,
} from "./fixtureLayout";

describe("edgeStripLayout", () => {
  it("pins horizontal walls to the top by default", () => {
    expect(edgeStripLayout({ rotation: 0, grid_w: 3, grid_h: 1 })).toEqual({
      vertical: false,
      pinEnd: false,
    });
  });

  it("uses the right edge after 90° rotation", () => {
    expect(edgeStripLayout({ rotation: 90, grid_w: 1, grid_h: 3 })).toEqual({
      vertical: true,
      pinEnd: true,
    });
  });
});

describe("normalizeFixedCellFootprint", () => {
  it("locks washbasin to a single cell", () => {
    expect(normalizeFixedCellFootprint()).toEqual({ grid_w: 1, grid_h: 1 });
  });
});

describe("normalizeEdgeStripFootprint", () => {
  it("keeps a horizontal wall one cell thick", () => {
    expect(normalizeEdgeStripFootprint(4, 2, 0)).toEqual({
      grid_w: 4,
      grid_h: 1,
    });
  });

  it("keeps a vertical wall one cell thick", () => {
    expect(normalizeEdgeStripFootprint(2, 5, 0)).toEqual({
      grid_w: 1,
      grid_h: 5,
    });
  });
});

describe("resizeFixtureAlongAxis", () => {
  const wall = {
    grid_x: 2,
    grid_y: 1,
    grid_w: 3,
    grid_h: 1,
    rotation: 0 as const,
  };

  it("lengthens the right end", () => {
    expect(resizeFixtureAlongAxis(wall, "end", 2)).toEqual({
      grid_x: 2,
      grid_y: 1,
      grid_w: 5,
      grid_h: 1,
    });
  });

  it("lengthens the left end without going negative", () => {
    expect(resizeFixtureAlongAxis(wall, "start", -2)).toEqual({
      grid_x: 0,
      grid_y: 1,
      grid_w: 5,
      grid_h: 1,
    });
  });

  it("shrinks the left end down to one cell", () => {
    expect(resizeFixtureAlongAxis(wall, "start", 5)).toEqual({
      grid_x: 4,
      grid_y: 1,
      grid_w: 1,
      grid_h: 1,
    });
  });

  it("lengthens a vertical wall downward", () => {
    expect(
      resizeFixtureAlongAxis(
        { grid_x: 1, grid_y: 1, grid_w: 1, grid_h: 2, rotation: 90 },
        "end",
        3,
      ),
    ).toEqual({
      grid_x: 1,
      grid_y: 1,
      grid_w: 1,
      grid_h: 5,
    });
  });
});
