import { describe, expect, it } from "vitest";
import {
  moveCoverPath,
  orderCoverOutputSize,
  publicOrderCoverPaths,
  synckerjaOrderCoverSlidePath,
} from "./orderCoverSlides";

describe("orderCoverSlides", () => {
  it("builds a unique banner path inside the outlet folder", () => {
    expect(synckerjaOrderCoverSlidePath("org", "outlet", "Banner.PNG", "ABC-123")).toBe(
      "org/synckerja-order/outlet/cover-abc123.png",
    );
  });

  it("prefers the photo list and falls back to the single banner", () => {
    expect(
      publicOrderCoverPaths({
        cover_paths: ["branch/one.jpg", " ", "branch/two.jpg", "branch/one.jpg"],
        cover_path: "shared/cover.jpg",
      }),
    ).toEqual(["branch/one.jpg", "branch/two.jpg"]);
    expect(publicOrderCoverPaths({ cover_paths: [], cover_path: "shared/cover.jpg" })).toEqual([
      "shared/cover.jpg",
    ]);
    expect(publicOrderCoverPaths({ cover_path: null })).toEqual([]);
  });

  it("shrinks a banner so the longest side is 1200 px", () => {
    expect(orderCoverOutputSize(1376, 768)).toEqual({ width: 1200, height: 670 });
    expect(orderCoverOutputSize(800, 450)).toEqual({ width: 800, height: 450 });
  });

  it("moves a photo without dropping the others", () => {
    expect(moveCoverPath(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveCoverPath(["a", "b"], 1, 5)).toEqual(["a", "b"]);
  });
});
