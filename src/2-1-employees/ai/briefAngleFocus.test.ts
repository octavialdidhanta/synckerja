import { describe, expect, it } from "vitest";
import {
  briefPayloadFromDraft,
  isAngleEligibleForBrief,
  MAX_BRIEF_ANGLES,
  toggleBriefAngleId,
} from "./briefAngleFocus";
import type { AngleOption, BriefDraft } from "./types";

function draft(partial: Partial<BriefDraft> = {}): BriefDraft {
  return {
    serviceIds: [],
    audience: "",
    personaIds: [],
    voice: "",
    requiredNotes: "",
    forbiddenNotes: "",
    pillarIds: [],
    productIds: [],
    angleIds: [],
    repeatVoices: [],
    splitRule: "",
    subServiceId: null,
    subServiceIds: [],
    contentPlanAutoApprove: false,
    useSystemHooks: true,
    ...partial,
  };
}

function angle(partial: Partial<AngleOption> & { id: string }): AngleOption {
  return {
    id: partial.id,
    label: partial.label ?? partial.id,
    master: partial.master ?? "",
    code: partial.code ?? "AN1",
    name: partial.name ?? "Name",
    statement: partial.statement ?? "Statement",
    serviceId: partial.serviceId ?? "svc-1",
    ideas: partial.ideas ?? [{ id: "idea-1", code: "ID1", name: "Idea", statement: "Idea" }],
    pillarIds: partial.pillarIds ?? [],
    otherIdeaCount: partial.otherIdeaCount ?? 0,
  };
}

describe("briefPayloadFromDraft", () => {
  it("clears pillar_ids when no Fokus angle is set", () => {
    const payload = briefPayloadFromDraft(draft({
      angleIds: [],
      pillarIds: ["p1", "p2"],
      subServiceIds: ["s1"],
      splitRule: "ignored",
    }));
    expect(payload.pillar_ids).toEqual([]);
    expect(payload.sub_service_id).toBe("s1");
    expect(payload.sub_service_ids).toEqual(["s1"]);
    expect(payload.split_rule).toBe("");
  });

  it("keeps pillar_ids while angles remain", () => {
    const payload = briefPayloadFromDraft(draft({
      angleIds: ["a1"],
      pillarIds: ["p1"],
    }));
    expect(payload.pillar_ids).toEqual(["p1"]);
    expect(payload.angle_ids).toEqual(["a1"]);
  });
});

describe("toggleBriefAngleId", () => {
  it("adds an angle under the max", () => {
    expect(toggleBriefAngleId(["a"], "b")).toEqual({
      next: ["a", "b"],
      action: "added",
    });
  });

  it("removes an angle that is already selected", () => {
    expect(toggleBriefAngleId(["a", "b"], "a")).toEqual({
      next: ["b"],
      action: "removed",
    });
  });

  it("blocks adding beyond max", () => {
    const full = Array.from({ length: MAX_BRIEF_ANGLES }, (_, i) => `a${i}`);
    expect(toggleBriefAngleId(full, "extra")).toEqual({
      next: full,
      action: "blocked_max",
    });
  });
});

describe("isAngleEligibleForBrief", () => {
  it("requires locked ideas and matching catalog", () => {
    const options = [
      angle({ id: "ok", serviceId: "svc-1", ideas: [{ id: "i1", code: "ID1", name: "Idea", statement: "Idea" }] }),
      angle({ id: "no-ideas", serviceId: "svc-1", ideas: [] }),
      angle({ id: "other-catalog", serviceId: "svc-2" }),
    ];
    expect(isAngleEligibleForBrief(options, ["svc-1"], "ok")).toBe(true);
    expect(isAngleEligibleForBrief(options, ["svc-1"], "no-ideas")).toBe(false);
    expect(isAngleEligibleForBrief(options, ["svc-1"], "other-catalog")).toBe(false);
  });

  it("allows any service when catalog list is empty", () => {
    const options = [angle({ id: "any", serviceId: "svc-9" })];
    expect(isAngleEligibleForBrief(options, [], "any")).toBe(true);
  });
});
