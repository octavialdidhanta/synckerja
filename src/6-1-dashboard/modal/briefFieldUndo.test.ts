import { describe, expect, it } from "vitest";
import { createUndoHistory, moveUndo, pushUndo } from "./briefFieldUndo";

describe("brief field undo", () => {
  it("undoes a typing burst back to the text before it", () => {
    let history = createUndoHistory("Medium shot");
    history = pushUndo(history, "Medium shot of", 15, 1_000, true);
    history = pushUndo(history, "Medium shot of @", 17, 1_200, true);
    const undone = moveUndo(history, -1);
    expect(undone?.entries[undone.index]?.value).toBe("Medium shot");
  });

  it("keeps a later burst as its own undo step", () => {
    let history = createUndoHistory("Audio");
    history = pushUndo(history, "Audio : no", 10, 1_000, true);
    history = pushUndo(history, "Audio : no sound", 16, 3_000, true);
    const once = moveUndo(history, -1);
    expect(once?.entries[once.index]?.value).toBe("Audio : no");
    const twice = once ? moveUndo(once, -1) : null;
    expect(twice?.entries[twice.index]?.value).toBe("Audio");
  });

  it("restores the undone text with Ctrl+Shift+Z", () => {
    let history = createUndoHistory("Shot");
    history = pushUndo(history, "Shot 1", 6, 1_000, true);
    const undone = moveUndo(history, -1);
    const redone = undone ? moveUndo(undone, 1) : null;
    expect(redone?.entries[redone.index]?.value).toBe("Shot 1");
  });

  it("treats inserting a mention as its own step", () => {
    let history = createUndoHistory("sitting at ");
    history = pushUndo(history, "sitting at @location_reviewer_home_kitchen", 42, 1_000, false);
    history = pushUndo(history, "sitting at @location_reviewer_home_kitchen.", 43, 1_100, true);
    const undone = moveUndo(history, -1);
    expect(undone?.entries[undone.index]?.value).toBe("sitting at @location_reviewer_home_kitchen");
  });
});
