import { describe, expect, it } from "vitest";
import {
  appendAuditVersion,
  applyAuditedColumnEdits,
  briefAuditField,
  commitAuditVersion,
  parseBriefFieldVersions,
  upsertBriefFieldVersionsInMarkdown,
  pairedVeoIndex,
  pairedVeoSlides,
  pairedSceneSlides,
  pairedSceneValue,
} from "./briefFieldVersions";

const original = "Medium shot of @character_reviewer looking thoughtful, sitting at a clean table in @location_reviewer_home_kitchen.";

describe("audited brief fields", () => {
  it("recognizes the Veo, Angle, and Visual function columns", () => {
    expect(briefAuditField("Veo 3 prompt")).toBe("veo");
    expect(briefAuditField("Shot")).toBe("shot");
    expect(briefAuditField("Angle")).toBe("angle");
    expect(briefAuditField("Visual function")).toBe("visual");
    expect(briefAuditField("Master prompt")).toBeNull();
  });

  it("keeps Original and appends the edited prompt as the next version", () => {
    const first = commitAuditVersion([], original, `${original} test`);
    expect(first.created).toBe(true);
    expect(first.versions).toEqual([original, `${original} test`]);
    const second = commitAuditVersion(first.versions, `${original} test`, `${original} test1`);
    expect(second.versions).toEqual([original, `${original} test`, `${original} test1`]);
    expect(second.versions[0]).toBe(original);
  });

  it("does not add a version when the text already exists", () => {
    const versions = [original, `${original} test`, `${original} test1`];
    const repeated = appendAuditVersion(versions, `${original} test`);
    expect(repeated.created).toBe(false);
    expect(repeated.index).toBe(1);
    expect(repeated.versions).toBe(versions);
  });

  it("forks an Angle edit from any version and refuses a duplicate", () => {
    const headers = ["Angle", "Visual function", "Veo 3 prompt"];
    const previous = [["Medium shot", "Introduce the reviewer.", original]];
    const next = [["Close up", "Introduce the reviewer.", `${original} test1`]];
    const first = applyAuditedColumnEdits({
      history: [],
      headers,
      previousBody: previous,
      nextBody: next,
      drafts: {},
    });
    expect(first.body[0]).toEqual(["Close up", "Introduce the reviewer.", `${original} test1`]);
    expect(first.history).toEqual([
      { row: 0, field: "angle", versions: ["Medium shot", "Close up"] },
    ]);
    const fromOriginal = applyAuditedColumnEdits({
      history: first.history,
      headers,
      previousBody: first.body,
      nextBody: first.body,
      drafts: { "0:angle": { index: 0, text: "Wide shot" } },
    });
    expect(fromOriginal.history[0]?.versions).toEqual(["Medium shot", "Close up", "Wide shot"]);
    expect(fromOriginal.history[0]?.versions[0]).toBe("Medium shot");
    const duplicate = applyAuditedColumnEdits({
      history: fromOriginal.history,
      headers,
      previousBody: fromOriginal.body,
      nextBody: fromOriginal.body,
      drafts: { "0:angle": { index: 2, text: "Medium shot" } },
    });
    expect(duplicate.history).toEqual(fromOriginal.history);
    expect(duplicate.body[0]?.[0]).toBe("Wide shot");
    expect(duplicate.focus).toEqual([{ key: "0:angle", index: 0 }]);
  });

  it("pairs Shot, Angle, and Visual function with the open image", () => {
    const images = [
      { id: "a", shot_text: "Shot 1 — Main Shot", angle_text: null, visual_function_text: null },
      { id: "b", shot_text: "Shot 1 — Detail", angle_text: "Close up", visual_function_text: "Show the bowl." },
    ];
    expect(pairedSceneSlides("Shot 1 — Main Shot", images, "shot")).toEqual([
      "Shot 1 — Main Shot",
      "Shot 1 — Detail",
    ]);
    expect(pairedSceneValue("Medium shot", images, "angle", "b")).toBe("Close up");
    expect(pairedSceneValue("Introduce the reviewer.", images, "visual", "a")).toBe("Introduce the reviewer.");
  });

  it("keeps one Veo line for each image and follows the open image", () => {
    const cell = `${original} test1`;
    const images = [
      { id: "a", prompt_override: null },
      { id: "b", prompt_override: "Wide shot of the street outside the complex." },
      { id: "c", prompt_override: "Wide shot of the street outside the complex." },
    ];
    expect(pairedVeoSlides(cell, images)).toEqual([
      cell,
      "Wide shot of the street outside the complex.",
      "Wide shot of the street outside the complex.",
    ]);
    expect(pairedVeoIndex(images, "b")).toBe(1);
    expect(pairedVeoIndex(images, null)).toBe(0);
  });

  it("round-trips field versions that contain prompt tags", () => {
    const markdown = upsertBriefFieldVersionsInMarkdown("# Brief", [
      { row: 0, field: "angle", versions: ["Medium shot", "Close up"] },
    ]);
    expect(parseBriefFieldVersions(markdown)).toEqual([
      { row: 0, field: "angle", versions: ["Medium shot", "Close up"] },
    ]);
  });
});
