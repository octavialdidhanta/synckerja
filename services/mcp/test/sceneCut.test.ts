import { describe, expect, it } from "vitest";
import { renderSpecV1 } from "../src/tools/render/renderSpec";
import { footageFindings, sceneCutFinding } from "../src/tools/render/specChecks";

/** Scene starts of the AI clips in "Sumsumnya Masih Nyangkut" (26 Nov 2026), as the catalog has them. */
const SCENES: Record<string, number[]> = {
  "PIK1/a_8953aea4.mp4": [3.13, 5.46, 8],
  "PIK1/b_7c79aeba.mp4": [6.58],
  "PIK1/c_da1ed666.mp4": [],
};

function spec(shots: Array<[string, number, number]>) {
  return renderSpecV1.parse({
    version: 1,
    production: "P1 Tes",
    output_name: "P1_tes_VO_v1_9x16",
    shots: shots.map(([file_key, i, o]) => ({ file_key, in: i, out: o })),
  });
}

const lookup = async (k: string) => (k in SCENES ? { duration_seconds: 10, scene_starts: SCENES[k] } : null);

describe("scene cuts inside a shot", () => {
  it("flags the four stray-frame cuts of v2", async () => {
    const f = await footageFindings(
      spec([
        ["PIK1/a_8953aea4.mp4", 3.0, 4.3],
        ["PIK1/a_8953aea4.mp4", 5.4, 6.9],
        ["PIK1/b_7c79aeba.mp4", 6.5, 7.6],
        ["PIK1/b_7c79aeba.mp4", 4.2, 6.5],
      ]),
      lookup,
    );
    expect(f.map((x) => x.code)).toEqual(["shot_near_scene_cut", "shot_near_scene_cut", "shot_near_scene_cut"]);
    expect(f[0]!.message).toContain("Set in ke 3.18s");
  });

  it("passes the v4 cuts", async () => {
    const f = await footageFindings(
      spec([
        ["PIK1/a_8953aea4.mp4", 8.08, 10],
        ["PIK1/a_8953aea4.mp4", 3.2, 4.5],
        ["PIK1/a_8953aea4.mp4", 5.55, 7.05],
        ["PIK1/b_7c79aeba.mp4", 6.67, 7.77],
        ["PIK1/c_da1ed666.mp4", 4.4, 6.7],
      ]),
      lookup,
    );
    expect(f).toEqual([]);
  });

  it("asks to split a shot that runs through a scene change", () => {
    expect(sceneCutFinding(0, "x", 1, 6, [3.13])?.code).toBe("shot_crosses_scene");
    expect(sceneCutFinding(0, "x", 4, 5.3, [3.13, 5.46])).toBeNull();
    expect(sceneCutFinding(0, "x", 4, 5.2, [5.46])).toBeNull();
    expect(sceneCutFinding(0, "x", 4, 5.6, [5.46])?.message).toContain("Set out ke 5.41s");
  });
});
