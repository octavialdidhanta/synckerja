import { describe, expect, it } from "vitest";
import { PASS_GATE_IDS } from "../big-thought/checklist";
import { TERRITORY_PASS_CHECK_IDS } from "../territory/passChecklist";
import { ANGLE_PASS_CHECK_IDS } from "../angle/passChecklist";
import { IDEA_PASS_CHECK_IDS } from "../idea/passChecklist";
import { IDEA_CRITERIA } from "../idea/validation";
import { CHECK_REGISTRY, checkEnabled, levelChecksOff, parseCheckSettings } from "./checkSettings";

const ids = (level: keyof typeof CHECK_REGISTRY) => CHECK_REGISTRY[level].map((entry) => entry.id);

describe("check settings", () => {
  it("lists every pass check of every level", () => {
    expect(ids("bigThought")).toEqual([...PASS_GATE_IDS]);
    expect(ids("territory")).toEqual([...TERRITORY_PASS_CHECK_IDS]);
    expect(ids("angle")).toEqual([...ANGLE_PASS_CHECK_IDS]);
    expect(ids("idea")).toEqual([...IDEA_PASS_CHECK_IDS, ...IDEA_CRITERIA]);
    expect(ids("master")).toEqual(["oneClaim", "oneSentence", "notPromo", "shift"]);
  });

  it("is OFF unless switched on", () => {
    expect(checkEnabled({}, "idea", "K3")).toBe(false);
    expect(checkEnabled(null, "idea", "K3")).toBe(false);
    expect(checkEnabled({ "idea.K3": true }, "idea", "K3")).toBe(true);
    expect(levelChecksOff({}, "angle")).toBe(true);
    expect(levelChecksOff({ "angle.livedExample": true }, "angle")).toBe(false);
  });

  it("keeps only valid ON keys", () => {
    expect(parseCheckSettings({ "idea.K3": true, "idea.K4": false, "bad key": true, "x.y": true })).toEqual({ "idea.K3": true });
    expect(parseCheckSettings(null)).toEqual({});
  });
});
