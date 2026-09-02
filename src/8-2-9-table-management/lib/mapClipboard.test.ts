import { describe, expect, it } from "vitest";
import { findPasteCell, nextUniqueMapName } from "./mapClipboard";

describe("nextUniqueMapName", () => {
  it("keeps the name when unused", () => {
    expect(nextUniqueMapName("Kasir", ["Tangga"])).toBe("Kasir");
  });

  it("increments a taken name", () => {
    expect(nextUniqueMapName("Kasir", ["Kasir"])).toBe("Kasir 2");
    expect(nextUniqueMapName("Kasir 2", ["Kasir", "Kasir 2"])).toBe("Kasir 3");
  });
});

describe("findPasteCell", () => {
  it("places to the right of a 1-cell item when free", () => {
    expect(
      findPasteCell(
        [
          {
            id: "a",
            grid_x: 2,
            grid_y: 1,
            grid_w: 1,
            grid_h: 1,
          },
        ],
        { grid_w: 1, grid_h: 1 },
        { grid_x: 2, grid_y: 1, grid_w: 1, grid_h: 1 },
      ),
    ).toEqual({ grid_x: 3, grid_y: 1 });
  });

  it("places below when the space to the right is blocked", () => {
    expect(
      findPasteCell(
        [
          { id: "a", grid_x: 2, grid_y: 1, grid_w: 2, grid_h: 1 },
          { id: "b", grid_x: 4, grid_y: 1, grid_w: 2, grid_h: 1 },
        ],
        { grid_w: 2, grid_h: 1 },
        { grid_x: 2, grid_y: 1, grid_w: 2, grid_h: 1 },
      ),
    ).toEqual({ grid_x: 2, grid_y: 2 });
  });
});
