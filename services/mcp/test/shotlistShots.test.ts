import { describe, expect, it } from "vitest";
import { checkShotlistShots, normalizeShotlistDocument } from "../src/tools/catalog/shotlistShots";
import { previewCatalogShotlistUpsertResult } from "../src/tools/catalog/libraryWrite";

const TALENT = "THE TALENT (same person in every shot): an Indonesian man in his mid-30s.\nClose-up: he lifts the bone.";

describe("shot list shots", () => {
  it("refuses shots without fotos or action and names them", () => {
    const r = checkShotlistShots({
      shots: [
        { id: "S01", action: "Top-down on the table.", fotos: ["foto/a.jpg"] },
        { id: "S02", action: "Close-up of the bowl." },
        { id: "S03", action: "", fotos: [] },
      ],
    });
    expect(r.errors.map((e) => [e.code, e.shots])).toEqual([
      ["shot_fotos_missing", ["S02"]],
      ["shot_action_missing", ["S03"]],
    ]);
  });

  it("warns (never blocks) when a person shot has no THE TALENT block", () => {
    const r = checkShotlistShots({
      shots: [
        { id: "S01", action: "Side close-up: he sucks the marrow out.", fotos: [] },
        { id: "S02", action: TALENT, fotos: [] },
        { id: "S03", action: "A waitress sets the bowl down; she does not look at the lens.", fotos: [] },
      ],
    });
    expect(r.errors).toEqual([]);
    expect(r.warnings.map((w) => [w.code, w.shots])).toEqual([["shot_talent_block_missing", ["S01"]]]);
  });

  it("fills angle, bicara, done and def like Content Studio and keeps an existing def", () => {
    const doc = normalizeShotlistDocument({
      judul: "Job",
      shots: [
        { id: "S01", action: "A", menu: "sup", area: "Ruang makan", lokasi: "pik1", fotos: ["foto/a.jpg"], footage: { file_key: "x" } },
        { id: "S02", action: "B", fotos: [], angle: 2, bicara: true, def: { action: "old" } },
      ],
    });
    expect(doc.shots[0]).toMatchObject({
      angle: 1,
      bicara: false,
      done: false,
      footage: { file_key: "x" },
      def: { action: "A", menu: "sup", area: "Ruang makan", lokasi: "pik1", fotos: ["foto/a.jpg"], bicara: false, angle: 1 },
    });
    expect(doc.shots[1]).toMatchObject({ angle: 2, bicara: true, def: { action: "old" } });
  });

  it("catalog.shotlist.upsert.preview returns shotlist_check_failed without touching the database", async () => {
    let called = false;
    const result = await previewCatalogShotlistUpsertResult(
      { organizationId: "o" } as never,
      { external_id: "7f2c78aa", document: { shots: [{ id: "S01", action: "Bowl." }] } },
      async () => {
        called = true;
        return {} as never;
      },
      (async () => ({})) as never,
    );
    expect(called).toBe(false);
    expect(result.error).toBe("shotlist_check_failed");
  });

  it("saves the normalized document", async () => {
    let saved: Record<string, unknown> | null = null;
    await previewCatalogShotlistUpsertResult(
      { organizationId: "o" } as never,
      { external_id: "7f2c78aa", document: { shots: [{ id: "S01", action: "Bowl.", fotos: ["foto/a.jpg"] }] } },
      async (_ctx, input) => {
        saved = input.document as Record<string, unknown>;
        return { preview_id: "p", expires_at: "2026-11-28T00:00:00Z" } as never;
      },
      (async () => ({ confirm_token: "t" })) as never,
    );
    expect((saved as unknown as { shots: Record<string, unknown>[] }).shots[0]).toMatchObject({ angle: 1, bicara: false, done: false });
  });
});
