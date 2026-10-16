import { describe, expect, it } from "vitest";
import type { BriefConceptDocument } from "@/6-1-dashboard/modal/briefConceptAssets";
import {
  atomicDelete,
  conceptMentions,
  expandToMentions,
  filterMentions,
  insertMention,
  mentionMenuBox,
  mentionQueryAt,
  mentionRanges,
} from "@/6-1-dashboard/modal/briefMentions";

const concept: BriefConceptDocument = {
  characters: [{ handle: "@character_budi", description: "Budi at 30" }],
  locations: [{ handle: "@location_home", description: "A small home office" }],
  properties: [{ handle: "@property_laptop", description: "A laptop" }],
};

const handles = conceptMentions(concept).map((item) => item.handle);

describe("brief mentions", () => {
  it("lists concept assets and locks only a whole matching handle", () => {
    expect(conceptMentions(concept).map((item) => item.kind)).toEqual(["character", "location", "property"]);
    const text = "Sits with @character_Budi at @location_home.";
    expect(mentionRanges(text, handles)).toEqual([
      { start: 10, end: 25, handle: "@character_budi" },
      { start: 29, end: 43, handle: "@location_home" },
    ]);
    expect(mentionRanges("@char", handles)).toEqual([]);
  });

  it("reads the @ query at the caret and hides it inside a locked token", () => {
    const text = "Look @character_budi @loc";
    const ranges = mentionRanges(text, handles);
    expect(mentionQueryAt(text, text.length, ranges)).toEqual({ start: 21, end: text.length, query: "loc" });
    expect(mentionQueryAt(text, 16, ranges)).toBeNull();
    expect(mentionQueryAt(text, 20, ranges)).toBeNull();
    expect(mentionQueryAt("Hello @", 7, [])).toEqual({ start: 6, end: 7, query: "" });
  });

  it("filters and inserts the full handle", () => {
    const mentions = conceptMentions(concept);
    expect(filterMentions(mentions, "lap").map((item) => item.handle)).toEqual(["@property_laptop"]);
    expect(filterMentions(mentions, "").length).toBe(3);
    const text = "at @ho desk";
    const query = mentionQueryAt(text, 6, mentionRanges(text, handles));
    expect(insertMention(text, query!, "@location_home")).toEqual({
      text: "at @location_home desk",
      caret: 17,
    });
  });

  it("places the mention menu beside the caret and flips it above the viewport edge", () => {
    expect(
      mentionMenuBox({
        caretTop: 180,
        caretLeft: 420,
        line: 20,
        fieldWidth: 360,
        viewportWidth: 1280,
        viewportHeight: 800,
      }),
    ).toEqual({ top: 204, left: 420, width: 360 });
    expect(
      mentionMenuBox({
        caretTop: 760,
        caretLeft: 20,
        line: 20,
        fieldWidth: 500,
        viewportWidth: 1000,
        viewportHeight: 800,
      }).top,
    ).toBe(516);
  });

  it("deletes a mention as one unit and expands a partial selection", () => {
    const text = "See @character_budi now";
    const ranges = mentionRanges(text, handles);
    expect(atomicDelete(text, 19, 19, ranges, "Backspace")).toEqual({ text: "See  now", caret: 4 });
    expect(atomicDelete(text, 4, 4, ranges, "Delete")).toEqual({ text: "See  now", caret: 4 });
    expect(atomicDelete(text, 8, 8, ranges, "Backspace")).toEqual({ text: "See  now", caret: 4 });
    expect(expandToMentions(8, 12, ranges)).toEqual({ start: 4, end: 19 });
    expect(atomicDelete(text, 8, 12, ranges, "Backspace")?.text).toBe("See  now");
    expect(atomicDelete(text, 0, 3, ranges, "Backspace")).toBeNull();
  });
});
