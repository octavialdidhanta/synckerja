import { describe, expect, it } from "vitest";
import { changedBriefFields, type BriefFieldContent } from "./briefVersionLog";

const stored: BriefFieldContent = {
  brief: "story",
  concept: '{"voiceOver":"Halo"}',
  caption: "caption",
  link: "https://example.com",
};

describe("changedBriefFields", () => {
  it("lists nothing when the text is the same", () => {
    expect(changedBriefFields(stored, { ...stored })).toEqual([]);
  });

  it("lists one changed column", () => {
    expect(changedBriefFields(stored, { ...stored, caption: "caption baru" })).toEqual(["caption"]);
  });

  it("lists every changed column", () => {
    expect(changedBriefFields(stored, {
      brief: "story baru",
      concept: '{"voiceOver":"Hai"}',
      caption: "caption baru",
      link: "https://example.com/baru",
    })).toEqual(["storyboard", "concept", "caption", "link"]);
  });

  it("ignores spaces at the edges", () => {
    expect(changedBriefFields(stored, {
      brief: "  story  ",
      concept: '  {"voiceOver":"Halo"}  ',
      caption: " caption ",
      link: " https://example.com ",
    })).toEqual([]);
  });
});
