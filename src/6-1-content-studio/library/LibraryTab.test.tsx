import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildLocations, buildMenus } from "./libraryData";
import { LibraryTab } from "./LibraryTab";

const edit = vi.hoisted(() => ({
  saveMenu: vi.fn(),
  saveLocation: vi.fn(),
  addPhoto: vi.fn(),
  remove: vi.fn().mockResolvedValue(undefined),
  saving: false,
  removing: false,
  error: null,
  removeError: null,
  reset: vi.fn(),
}));

const describeLocation = vi.hoisted(() => vi.fn());

const baseMenus = buildMenus(
  [
    { id: "m1", external_id: "sate-babi", name: "Sate Babi", aliases: [], created_at: "a" },
    { id: "m2", external_id: "iga-bakar", name: "Iga bakar", aliases: [], created_at: "b" },
  ],
  [{ menu_id: "m1", field_key: "main", body: "Sate babi bakar arang", position: 0 }],
  [{ id: "p1", menu_id: "m2", file_path: "foto/iga.png", label: "Iga Bakar", storage_path: "o/photos/p1.png", position: 0 }],
);
const baseLocations = buildLocations(
  [{ id: "l1", external_id: "pik1", name: "PIK1 Foodcourt", created_at: "a" }],
  [{ id: "f1", location_id: "l1", file_path: "foto/t.jpg", label: "Teras", storage_path: null, description: "Meja biru", areas: ["Teras"], position: 0 }],
  [{ location_id: "l1", title: "Scene", body: "Food court terbuka", areas: [], position: 0 }],
);

let menus = baseMenus;
let locations = baseLocations;
const photoUrls: Record<string, string> = { "o/photos/p1.png": "https://x/p1.png" };

vi.mock("../claims/useClaims", () => ({
  useClaims: () => ({ data: [] }),
}));

vi.mock("./useLibraryData", () => ({
  useLibraryData: () => ({
    data: { menus, locations, photos: photoUrls },
    isPending: false,
    error: null,
  }),
}));

vi.mock("./useCatalogEdit", () => ({
  useCatalogEdit: () => edit,
}));

vi.mock("./describeLocation", () => ({
  describeCatalogLocation: describeLocation,
}));

describe("LibraryTab", () => {
  afterEach(() => {
    menus = baseMenus;
    locations = baseLocations;
    delete photoUrls["o/photos/f1.jpg"];
    describeLocation.mockReset();
    edit.saveLocation.mockReset();
  });

  it("lists products with status and shows the selected one", () => {
    render(
      <div className="ck">
        <LibraryTab kind="menu" headLeft={<h1>Content Studio</h1>} />
      </div>,
    );
    expect(screen.getByText("siap")).toBeTruthy();
    expect(screen.getByText("menunggu deskripsi")).toBeTruthy();
    expect(screen.getByText("Sate babi bakar arang")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Isi dari foto" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByText("Iga bakar"));
    expect(screen.getByText("Foto referensi (1)")).toBeTruthy();
    expect(screen.getByText("Kolom visual masih kosong. Isi lewat tombol Ubah.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Isi dari foto" }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Tambah produk" }));
    expect(screen.getByLabelText("Nama")).toBeTruthy();
    expect(screen.getByLabelText("Hidangan utama")).toBeTruthy();
  });

  it("shows the source photo and hides the reference gallery", () => {
    menus = baseMenus.map((menu) => (
      menu.id === "m2" ? { ...menu, sourcePhotoUrl: "https://x/item.jpg", sourceKind: "item" as const } : menu
    ));
    render(
      <div className="ck">
        <LibraryTab kind="menu" headLeft={<h1>Content Studio</h1>} />
      </div>,
    );
    fireEvent.click(screen.getByText("Iga bakar"));
    expect(screen.getByText("Foto dari Item Library")).toBeTruthy();
    expect(screen.queryByText("Foto referensi (1)")).toBeNull();
  });

  it("shows location photo descriptions and always-on sections", () => {
    render(
      <div className="ck">
        <LibraryTab kind="lokasi" headLeft={<h1>Content Studio</h1>} />
      </div>,
    );
    expect(screen.getByText("Meja biru")).toBeTruthy();
    expect(screen.getByText("Food court terbuka")).toBeTruthy();
    expect(screen.getByText("Area: Teras")).toBeTruthy();
    expect(screen.getByText("foto belum di-upload")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Isi dari foto" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Tambah foto" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Tambah lokasi" }));
    expect(screen.getByLabelText("Label")).toBeTruthy();
    expect(screen.queryByLabelText("Scene")).toBeNull();
  });

  it("drafts the uploaded location photo and saves it with the always-on sections", async () => {
    locations = buildLocations(
      [{ id: "l1", external_id: "pik1", name: "PIK1 Foodcourt", created_at: "a" }],
      [{ id: "f1", location_id: "l1", file_path: "foto/t.jpg", label: "Teras", storage_path: "o/photos/f1.jpg", description: "", areas: ["Teras"], position: 0 }],
      [],
    );
    photoUrls["o/photos/f1.jpg"] = "https://x/f1.jpg";
    describeLocation.mockResolvedValue({
      desc: "Teras kiri",
      scene: "Pagi di food court",
      atmosphere: "Terang",
      must_not: "Tanpa orang lewat",
    });
    edit.saveLocation.mockResolvedValue("l1");
    render(
      <div className="ck">
        <LibraryTab kind="lokasi" headLeft={<h1>Content Studio</h1>} />
      </div>,
    );
    const describe = screen.getByRole("button", { name: "Isi dari foto" }) as HTMLButtonElement;
    expect(describe.disabled).toBe(false);
    fireEvent.click(describe);
    expect(await screen.findByDisplayValue("Teras kiri")).toBeTruthy();
    await act(async () => {
      await Promise.resolve();
    });
    expect((screen.getByLabelText("Scene") as HTMLTextAreaElement).value).toBe("Pagi di food court");
    expect((screen.getByLabelText("Atmosphere") as HTMLTextAreaElement).value).toBe("Terang");
    expect((screen.getByLabelText("Must NOT") as HTMLTextAreaElement).value).toBe("Tanpa orang lewat");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    });
    expect(edit.saveLocation).toHaveBeenCalledWith(expect.objectContaining({
      id: "l1",
      photos: [{ id: "f1", description: "Teras kiri" }],
      sections: [
        { title: "Scene", body: "Pagi di food court" },
        { title: "Atmosphere", body: "Terang" },
        { title: "Must NOT", body: "Tanpa orang lewat" },
      ],
    }));
    expect(describeLocation).toHaveBeenCalledWith("f1");
  });
});
