import { describe, expect, it } from "vitest";
import { menuIdsToDrop } from "./dropEmptyLinkedMenu";

describe("menuIdsToDrop", () => {
  it("drops an empty linked product and keeps one that already has a description or a photo", () => {
    expect(
      menuIdsToDrop([
        { id: "empty", fieldCount: 0, livePhotoCount: 0 },
        { id: "written", fieldCount: 2, livePhotoCount: 0 },
        { id: "photo", fieldCount: 0, livePhotoCount: 1 },
      ]),
    ).toEqual(["empty"]);
  });
});
