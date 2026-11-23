import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildLocations, buildMenus } from "../library/libraryData";
import { parseShotJob } from "./shotData";
import { ShotListTab } from "./ShotListTab";

const menus = buildMenus(
  [{ id: "m1", external_id: "sup-sumsum", name: "Sup Sumsum", aliases: [], created_at: "a" }],
  [{ menu_id: "m1", field_key: "main", body: "Marrow soup", position: 0 }],
  [{ id: "p1", menu_id: "m1", file_path: "foto/sup_foto1.png", label: "Sup", storage_path: null, position: 0 }],
);
const locations = buildLocations(
  [{ id: "l1", external_id: "teras", name: "Teras", created_at: "a" }],
  [{ id: "f1", location_id: "l1", file_path: "foto/meja.jpg", label: "Meja", storage_path: null, description: "Blue tables.", areas: ["Ruang makan"], position: 0 }],
  [{ location_id: "l1", title: "Scene", body: "A terrace.", areas: null, position: 0 }],
);
const archivedDoc = {
  judul: "Sumsum Disedot",
  lokasi: "teras",
  arsip: true,
  shots: [{ id: "P01", judul: "Hook sumsum", menu: "sup-sumsum", action: "Lift one bone.", area: "Ruang makan", vo: "Tulang sumsumnya banyak", done: true }],
};
const activeDoc = {
  judul: "Hari 5",
  lokasi: "teras",
  shots: [{ id: "P01", judul: "Sate diangkat", menu: "sup-sumsum", action: "Lift.", area: "Ruang makan", done: false }],
};
const job = parseShotJob("e2fb3654", archivedDoc);
const activeJob = parseShotJob("hari-5", activeDoc);

// Fake save: applies each edit to an in-memory copy, as the real hook does on the stored document.
let docs: Record<string, Record<string, unknown>> = {};
const saved: Array<{ jobId: string; doc: Record<string, unknown> }> = [];
vi.mock("./useShotSave", () => ({
  useShotSave: () => ({
    status: "idle",
    saveJob: (jobId: string, edit: (d: Record<string, unknown>) => { doc: Record<string, unknown>; result?: unknown }) => {
      const r = edit(docs[jobId]);
      docs[jobId] = r.doc;
      saved.push({ jobId, doc: r.doc });
      return Promise.resolve(r.result);
    },
  }),
}));

vi.mock("../library/useLibraryData", () => ({
  useLibraryData: () => ({ data: { menus, locations, photos: {} }, isPending: false, error: null }),
}));
vi.mock("./useShotData", () => ({
  useShotData: () => ({ data: { fields: { judul: "MASTER", format: "9:16" }, jobs: [activeJob, job] }, isPending: false, error: null }),
}));

const renderTab = () =>
  render(
    <div className="ck">
      <ShotListTab headLeft={<h1>Content Studio</h1>} />
    </div>,
  );
const lastDoc = (jobId: string) => [...saved].reverse().find((s) => s.jobId === jobId)?.doc;
const shotOf = (doc: Record<string, unknown> | undefined, id: string) =>
  ((doc?.shots ?? []) as Array<Record<string, unknown>>).find((s) => s.id === id);

beforeEach(() => {
  docs = { "e2fb3654": structuredClone(archivedDoc), "hari-5": structuredClone(activeDoc) };
  saved.length = 0;
});
afterEach(() => vi.useRealTimers());

describe("ShotListTab", () => {
  it("builds a quick prompt and loads an archived shot into the builder", () => {
    renderTab();
    expect(screen.getByText("Rakit prompt Google Flow")).toBeTruthy();
    expect(screen.getByText("Arsip (1)")).toBeTruthy();
    // the done mark must not reuse the root .ck class, or it gets the full-height studio styles
    expect(document.querySelectorAll(".it.si .okm")).toHaveLength(1);
    expect(document.querySelectorAll(".it.si .ck")).toHaveLength(0);

    fireEvent.click(screen.getByText("P01 — Hook sumsum"));
    expect(screen.getByText(/VO: Tulang sumsumnya banyak/)).toBeTruthy();
    const out = document.querySelector("pre.out")!.textContent!;
    expect(out).toContain("## 3. Main Subject — Sup Sumsum");
    expect(out).toContain("Lift one bone.");
    expect(screen.getByText(/2 dari 2 dipakai/)).toBeTruthy();

    // unticking the location photo updates the prompt and the summary
    fireEvent.click(screen.getAllByTitle("Lepas")[1]);
    expect(screen.getByText(/1 dari 2 dipakai/)).toBeTruthy();
    expect(screen.getByText("Belum ada foto lokasi dicentang")).toBeTruthy();
  });

  it("saves field edits half a second after the last change, with def kept from before", () => {
    vi.useFakeTimers();
    renderTab();
    fireEvent.click(screen.getByText("P01 — Sate diangkat"));
    fireEvent.change(document.querySelector("textarea.act")!, { target: { value: "Lift slowly." } });
    fireEvent.change(screen.getByDisplayValue("1 angle — satu shot nonstop (default)"), { target: { value: "3" } });
    expect(saved).toHaveLength(0);
    act(() => vi.advanceTimersByTime(500));
    expect(saved).toHaveLength(1);
    const s = shotOf(lastDoc("hari-5"), "P01")!;
    expect(s.action).toBe("Lift slowly.");
    expect(s.angle).toBe(3);
    expect((s.def as Record<string, unknown>).action).toBe("Lift.");
    expect(typeof lastDoc("hari-5")!.judul).toBe("string");
  });

  it("ticks Sudah generate, edits the title, duplicates, resets, and deletes a shot", async () => {
    renderTab();
    fireEvent.click(screen.getByText("P01 — Sate diangkat"));

    fireEvent.click(screen.getByLabelText(/Sudah generate/));
    expect(shotOf(lastDoc("hari-5"), "P01")!.done).toBe(true);

    fireEvent.click(screen.getByText("Ubah judul/VO"));
    fireEvent.change(screen.getByLabelText("Judul shot"), { target: { value: "Sate diangkat dari bara" } });
    fireEvent.change(screen.getByLabelText(/^Detik/), { target: { value: "7–8.5" } });
    fireEvent.click(screen.getByText("Simpan"));
    expect(shotOf(lastDoc("hari-5"), "P01")).toMatchObject({ judul: "Sate diangkat dari bara", timing: "7–8.5", vo: "" });

    await act(async () => {
      fireEvent.click(screen.getByText("Duplikat"));
    });
    expect(shotOf(lastDoc("hari-5"), "P01-2")).toMatchObject({ judul: "Sate diangkat dari bara (copy)", done: false });

    fireEvent.click(screen.getByText("P01 — Sate diangkat"));
    fireEvent.click(screen.getByText("Reset ke default"));
    fireEvent.click(screen.getByText("Ya, reset"));
    expect(shotOf(lastDoc("hari-5"), "P01")!.action).toBe("Lift.");

    fireEvent.click(screen.getByText("Hapus"));
    fireEvent.click(screen.getByText("Ya, hapus"));
    expect(shotOf(lastDoc("hari-5"), "P01")).toBeUndefined();
    expect(shotOf(lastDoc("hari-5"), "P01-2")).toBeTruthy();
  });

  it("adds a shot to an active job and archives or restores jobs", async () => {
    renderTab();
    fireEvent.click(screen.getByTitle("Tambah shot"));
    fireEvent.change(screen.getByPlaceholderText("Judul shot baru"), { target: { value: "Penutup toko" } });
    await act(async () => {
      fireEvent.click(screen.getByText("Tambah"));
    });
    expect(shotOf(lastDoc("hari-5"), "P02")).toMatchObject({ judul: "Penutup toko", done: false, angle: 1 });

    fireEvent.click(screen.getByTitle("Arsipkan"));
    expect(lastDoc("hari-5")!.arsip).toBe(true);
    fireEvent.click(screen.getByTitle("Keluarin dari arsip"));
    expect(lastDoc("e2fb3654")!.arsip).toBe(false);
  });
});
