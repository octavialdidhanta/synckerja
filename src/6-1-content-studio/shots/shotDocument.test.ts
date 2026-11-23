import { describe, expect, it } from "vitest";
import {
  addShot,
  applyShotFields,
  deleteShot,
  duplicateShot,
  editShotMeta,
  newShotId,
  resetShot,
  setJobArchived,
  setShotDone,
} from "./shotDocument";

const doc = () => ({
  job_id: "e2fb3654",
  judul: "Sumsum Disedot",
  lokasi: "pik1-teras-meja-biru",
  saved_at: 1,
  shots: [
    {
      id: "P01",
      judul: "Hook",
      vo: "Tulang sumsumnya banyak",
      timing: "0–4",
      dari: "r4#6",
      menu: "sup-sumsum-kambing",
      area: "Ruang makan",
      fotos: ["foto/a.png"],
      action: "Lift one bone.",
      bicara: false,
      angle: 1,
      done: false,
      menu_nama: { x: "X" },
    },
    {
      id: "P02",
      judul: "Suwir",
      menu: "sup-sumsum-kambing",
      area: "Ruang makan",
      lokasi: "pik1-foodcourt",
      fotos: ["foto/b.png"],
      action: "Fork pulls meat.",
      bicara: false,
      angle: 1,
      def: { action: "Original.", menu: "sup-sumsum-kambing", area: "Ruang makan", fotos: ["foto/a.png"], bicara: false, angle: 1 },
    },
  ],
});

const shot = (d: Record<string, unknown>, id: string) =>
  (d.shots as Array<Record<string, unknown>>).find((s) => s.id === id) as Record<string, unknown>;

describe("shotDocument (katalog.html shot edits)", () => {
  it("applies field edits, adds def from the old values, and keeps unknown keys", () => {
    const d = applyShotFields(doc(), "P01", {
      action: "Lift slowly.",
      menus: ["sup-sumsum-kambing", "sate-kambing"],
      lokasi: "pik2",
      pick: "Panggangan",
      fotos: ["foto/c.png"],
      bicara: true,
      angle: 3,
    });
    const s = shot(d, "P01");
    expect(s).toMatchObject({
      action: "Lift slowly.",
      menu: ["sup-sumsum-kambing", "sate-kambing"],
      lokasi: "pik2",
      pick: "Panggangan",
      fotos: ["foto/c.png"],
      bicara: true,
      angle: 3,
      dari: "r4#6",
      menu_nama: { x: "X" },
    });
    expect(s.def).toEqual({ action: "Lift one bone.", menu: "sup-sumsum-kambing", area: "Ruang makan", fotos: ["foto/a.png"], bicara: false, angle: 1 });
    expect(d.judul).toBe("Sumsum Disedot");
    expect(doc().shots[0].action).toBe("Lift one bone.");
  });

  it("stores one menu as a string and no menu as an empty string", () => {
    expect(shot(applyShotFields(doc(), "P01", { menus: ["iga"] }), "P01").menu).toBe("iga");
    expect(shot(applyShotFields(doc(), "P01", { menus: [] }), "P01").menu).toBe("");
  });

  it("sets done and edits title, timing, and VO (an empty title keeps the old one)", () => {
    expect(shot(setShotDone(doc(), "P01", true), "P01").done).toBe(true);
    const s = shot(editShotMeta(doc(), "P01", { judul: "  ", timing: " 1–2 ", vo: "" }), "P01");
    expect(s).toMatchObject({ judul: "Hook", timing: "1–2", vo: "" });
  });

  it("resets to def, drops pick, and removes a location def does not have", () => {
    const edited = applyShotFields(doc(), "P02", { pick: "Jalan", angle: 2 });
    const s = shot(resetShot(edited, "P02"), "P02");
    expect(s).toMatchObject({ action: "Original.", fotos: ["foto/a.png"], angle: 1 });
    expect("pick" in s).toBe(false);
    expect("lokasi" in s).toBe(false);
  });

  it("names new shots and copies like katalog.html newId()", () => {
    expect(newShotId(doc())).toBe("P03");
    expect(newShotId(doc(), "P01")).toBe("P01-2");
    const { doc: d, id } = duplicateShot(doc(), "P01");
    expect(id).toBe("P01-2");
    expect((d.shots as Array<{ id: string }>).map((s) => s.id)).toEqual(["P01", "P01-2", "P02"]);
    expect(shot(d, "P01-2")).toMatchObject({ judul: "Hook (copy)", done: false, def: { action: "Lift one bone." } });
    expect(newShotId(d, "P01")).toBe("P01-3");
  });

  it("adds an empty shot at the end, deletes a shot, and archives the job", () => {
    const { doc: d, id } = addShot(doc(), " Penutup ");
    expect(id).toBe("P03");
    expect(shot(d, "P03")).toMatchObject({ judul: "Penutup", action: "", menu: "", fotos: [], angle: 1, done: false });
    expect(() => addShot(doc(), " ")).toThrow("empty_title");
    expect((deleteShot(d, "P01").shots as unknown[]).length).toBe(2);
    expect(() => deleteShot(doc(), "P09")).toThrow("shot_not_found");
    expect(setJobArchived(doc(), true).arsip).toBe(true);
  });
});

describe("addShotFromReference (katalog.html beatPakai)", () => {
  it("appends a shot that remembers its reference and its own def", async () => {
    const { addShotFromReference } = await import("./shotDocument");
    const { doc: d, id } = addShotFromReference(doc(), {
      judul: "Hook — Kipas bara",
      action: "Close-up.",
      menu: "sate-kambing",
      area: "Panggangan",
      lokasi: "pik1-foodcourt",
      fotos: ["foto/sate.png", "foto/grill.jpg"],
      dari: "r4#0",
    });
    expect(id).toBe("P03");
    expect(shot(d, "P03")).toMatchObject({
      judul: "Hook — Kipas bara",
      dari: "r4#0",
      done: false,
      angle: 1,
      def: { action: "Close-up.", lokasi: "pik1-foodcourt", fotos: ["foto/sate.png", "foto/grill.jpg"] },
    });
  });
});
