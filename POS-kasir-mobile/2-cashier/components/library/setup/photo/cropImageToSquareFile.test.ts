import { describe, expect, it } from "vitest";
import {
  clampSquareCropOffset,
  coverScale,
} from "./cropImageToSquareFile";

describe("coverScale", () => {
  it("covers a portrait image in a square viewport", () => {
    expect(coverScale(1000, 2000, 300)).toBeCloseTo(0.3);
  });

  it("covers a landscape image in a square viewport", () => {
    expect(coverScale(2000, 1000, 300)).toBeCloseTo(0.3);
  });
});

describe("clampSquareCropOffset", () => {
  it("keeps the square fully covered for a tall image", () => {
    const viewport = 300;
    const { offsetX, offsetY } = clampSquareCropOffset(1000, 2000, viewport, 1, -9999, -9999);
    const scale = coverScale(1000, 2000, viewport);
    expect(offsetX).toBe(0);
    expect(offsetY).toBe(viewport - 2000 * scale);
  });
});
