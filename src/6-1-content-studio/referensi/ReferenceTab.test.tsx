import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildLocations, buildMenus } from "../library/libraryData";
import { parseShotJob } from "../shots/shotData";
import { parseReference } from "./referenceData";
import { ReferenceTab } from "./ReferenceTab";

const menus = buildMenus(
  [{ id: "m1", external_id: "sate-kambing", name: "Sate Kambing", aliases: [], created_at: "a" }],
  [{ menu_id: "m1", field_key: "main", body: "Goat satay", position: 0 }],
  [{ id: "p1", menu_id: "m1", file_path: "foto/sate.png", label: "Sate", storage_path: null, position: 0 }],
);
const locations = buildLocations(
  [{ id: "l1", external_id: "pik1-foodcourt", name: "PIK1", created_at: "a" }],
  [
    { id: "f1", location_id: "l1", file_path: "foto/teras.jpg", label: "Teras", storage_path: null, description: "", areas: ["Ruang makan"], position: 0 },
    { id: "f2", location_id: "l1", file_path: "foto/grill.jpg", label: "Grill", storage_path: null, description: "", areas: ["Panggangan"], position: 1 },
  ],
  [],
);
const ref = parseReference("r4", {
  judul: "Rocky's BBQ — Masa kehabisan",
  durasi: 66,
  ada_vo: true,
  bahasa: "Indonesia",
  file: "ref_r4.mp4",
  struktur: [{ a: 0, b: 7, bagian: "Hook", isi: "Dua kali" }],
  vo: [{ a: 0, b: 2, t: "Dua kali datang" }],
  kenapa: ["Kelangkaan"],
  editing: ["Cut cepat"],
  beats: [
    {
      a: 0,
      b: 3,
      hook: true,
      peran: "Hook",
      jenis: "Proses",
      visual: "Asap tebal",
      kenapa: "Narik mata",
      sate: { ide: "Tukang sate kipas bara", action: "Close-up fan.", lokasi: "pik1-foodcourt", produk: "sate-kambing", area: "Panggangan" },
    },
  ],
  mg: [{ a: 0.5, b: 3, jenis: "Subtitle", nama: "Subtitle krem", animasi: "Tanpa animasi.", font: { asli: "Sans", mirip: ["Poppins Bold"], warna: ["#FAF8B2"] } }],
});

let jobsDoc: Record<string, unknown>;
let jobs: ReturnType<typeof parseShotJob>[] = [];
const styleSaves: Array<{ key: string; body: string }> = [];

vi.mock("../library/useLibraryData", () => ({
  useLibraryData: () => ({ data: { menus, locations, photos: {} }, isPending: false, error: null }),
}));
vi.mock("./useReferenceData", () => ({
  useReferenceData: () => ({ data: { refs: [ref], images: {} }, isPending: false, error: null }),
}));
vi.mock("../shots/useShotData", () => ({
  useShotData: () => ({ data: { fields: {}, jobs, stored: {} }, isPending: false, error: null }),
}));
vi.mock("../shots/useShotSave", () => ({
  useShotSave: () => ({
    status: "idle",
    saveJob: (_id: string, edit: (d: Record<string, unknown>) => { doc: Record<string, unknown>; result?: unknown }) => {
      const r = edit(jobsDoc);
      jobsDoc = r.doc;
      return Promise.resolve(r.result);
    },
  }),
}));
vi.mock("./useStyleData", () => ({
  STYLE_BOXES: [
    { key: "vo", label: "Gaya VO / naskah" },
    { key: "teks", label: "Gaya teks & motion graphic" },
  ],
  useStyleData: () => ({
    data: [
      { id: "s1", field_key: "vo", body: "VO santai", position: 0, updated_at: "t" },
      { id: "s2", field_key: "teks", body: "- Hook kuning", position: 1, updated_at: "t" },
    ],
    isPending: false,
  }),
  useStyleSave: () => ({
    saving: false,
    save: (key: string, body: string) => {
      styleSaves.push({ key, body });
      return Promise.resolve("saved");
    },
  }),
}));
vi.mock("./localReferensi", () => ({
  referensiFolder: {
    load: () => Promise.resolve({ state: "none", name: null }),
    connect: () => Promise.resolve({ state: "none", name: null }),
    open: () => Promise.reject(new Error("no-folder")),
    listFiles: () => Promise.resolve([]),
  },
}));

const renderTab = () =>
  render(
    <div className="ck">
      <ReferenceTab headLeft={<h1>Content Studio</h1>} />
    </div>,
  );

beforeEach(() => {
  jobsDoc = { judul: "Hari 6", shots: [{ id: "P01", judul: "Hook" }] };
  jobs = [parseShotJob("hari-6", jobsDoc)];
  styleSaves.length = 0;
});

describe("ReferenceTab", () => {
  it("shows a reference with its analysis and asks for the referensi folder to play it", async () => {
    renderTab();
    await act(async () => undefined);
    fireEvent.click(screen.getByText("Rocky's BBQ — Masa kehabisan"));
    expect(screen.getByText("Dua kali datang")).toBeTruthy();
    expect(screen.getByText("Kelangkaan")).toBeTruthy();
    expect(screen.getByText("Visual menarik (1)")).toBeTruthy();
    expect(screen.getByText("Pilih folder referensi")).toBeTruthy();
  });

  it("puts a visual into the active Shot List job like katalog.html beatPakai()", async () => {
    renderTab();
    fireEvent.click(screen.getByText("★ Bank Visual"));
    await act(async () => {
      fireEvent.click(screen.getByText("＋ Pakai di Shot List"));
    });
    const shots = jobsDoc.shots as Array<Record<string, unknown>>;
    expect(shots[1]).toMatchObject({
      id: "P02",
      judul: "Hook — Tukang sate kipas bara",
      action: "Close-up fan.",
      menu: "sate-kambing",
      lokasi: "pik1-foodcourt",
      area: "Panggangan",
      fotos: ["foto/sate.png", "foto/grill.jpg"],
      dari: "r4#0",
    });
    expect(screen.getByText("Masuk ke Hari 6 sebagai P02")).toBeTruthy();
  });

  it("says so when there is no active job", () => {
    jobs = [];
    renderTab();
    fireEvent.click(screen.getByText("★ Bank Visual"));
    fireEvent.click(screen.getByText("＋ Pakai di Shot List"));
    expect(screen.getAllByText(/Belum ada job aktif di Shot List/).length).toBeGreaterThan(0);
  });

  it("Jadiin standar opens Gaya teks with the new line, and Simpan saves it", async () => {
    renderTab();
    fireEvent.click(screen.getByText("★ Bank Motion Graphic"));
    expect(screen.getByText("Subtitle (1)")).toBeTruthy();
    fireEvent.click(screen.getByText("★ Jadiin standar"));
    const ta = screen.getByLabelText("Gaya teks & motion graphic") as HTMLTextAreaElement;
    expect(ta.value).toBe("- Hook kuning\n- Subtitle (dari Rocky's BBQ): Subtitle krem. Tanpa animasi. Font mirip Poppins Bold, warna #FAF8B2.");
    await act(async () => {
      fireEvent.click(screen.getByText("Simpan"));
    });
    expect(styleSaves).toEqual([{ key: "teks", body: ta.value }]);
  });
});
