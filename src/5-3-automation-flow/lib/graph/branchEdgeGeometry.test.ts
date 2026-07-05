import { describe, expect, it } from "vitest";
import { getBranchRailPath } from "@/5-3-automation-flow/lib/graph/branchEdgeGeometry";

describe("getBranchRailPath", () => {
  it("builds orthogonal path with vertical trunk, horizontal rail, and vertical drop", () => {
    const { path, railY } = getBranchRailPath(0, 100, -120, 400);

    expect(railY).toBe(144);
    expect(path).toBe("M 0,100 L 0,144 L -120,144 L -120,400");
  });

  it("places anchor between rail and target on the vertical drop", () => {
    const { labelX, anchorY, railY } = getBranchRailPath(0, 100, 120, 400);

    expect(labelX).toBe(120);
    expect(anchorY).toBeGreaterThan(railY);
    expect(anchorY).toBeLessThan(400);
  });
});
