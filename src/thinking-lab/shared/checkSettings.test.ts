import { describe, expect, it } from "vitest";
import { PASS_GATE_IDS } from "../big-thought/checklist";
import { TERRITORY_PASS_CHECK_IDS } from "../territory/passChecklist";
import { ANGLE_PASS_CHECK_IDS } from "../angle/passChecklist";
import { IDEA_CHECK_IDS } from "../idea/check/ids";
import { MASTER_CHECK_IDS } from "../master-thought/semantic";
import { CHECK_REGISTRY, checkEnabled, parseCheckSettings } from "./checkSettings";

const ids = (level: keyof typeof CHECK_REGISTRY) => CHECK_REGISTRY[level].map((entry) => entry.id);

describe("check settings", () => {
  it("lists every pass check of every level", () => {
    expect(ids("bigThought")).toEqual([...PASS_GATE_IDS]);
    expect(ids("territory")).toEqual([...TERRITORY_PASS_CHECK_IDS]);
    expect(ids("angle")).toEqual([...ANGLE_PASS_CHECK_IDS]);
    expect(ids("idea")).toEqual([...IDEA_CHECK_IDS]);
    expect(ids("master")).toEqual([...MASTER_CHECK_IDS]);
  });

  it("is OFF unless switched on", () => {
    expect(checkEnabled({}, "idea", "result")).toBe(false);
    expect(checkEnabled(null, "idea", "result")).toBe(false);
    expect(checkEnabled({ "idea.result": true }, "idea", "result")).toBe(true);
  });

  it("keeps only ON keys of checks that exist", () => {
    expect(parseCheckSettings({ "idea.result": true, "idea.distinct": false, "bad key": true, "x.y": true, "bigThought.role": true })).toEqual({
      "idea.result": true,
    });
    expect(parseCheckSettings(null)).toEqual({});
  });

  it("turns a new Idea check ON when any switch it replaced was ON", () => {
    expect(parseCheckSettings({ "idea.K4": true, "idea.vehicle": true, "idea.siblingsDistinct": true, "idea.K2": true })).toEqual({
      "idea.result": true,
      "idea.mechanism": true,
      "idea.distinct": true,
    });
    expect(parseCheckSettings({ "idea.stakeHolds": true, "idea.K7": true })).toEqual({
      "idea.stakeHolds": true,
      "idea.watchable": true,
    });
  });
});
