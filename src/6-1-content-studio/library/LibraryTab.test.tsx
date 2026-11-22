import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildLocations, buildMenus } from "./libraryData";
import { LibraryTab } from "./LibraryTab";

const menus = buildMenus(
  [
    { id: "m1", external_id: "sate-babi", name: "Sate Babi", aliases: [], created_at: "a" },
    { id: "m2", external_id: "iga-bakar", name: "Iga bakar", aliases: [], created_at: "b" },
  ],
  [{ menu_id: "m1", field_key: "main", body: "Sate babi bakar arang", position: 0 }],
  [{ id: "p1", menu_id: "m2", file_path: "foto/iga.png", label: "Iga Bakar", storage_path: "o/photos/p1.png", position: 0 }],
);
const locations = buildLocations(
  [{ id: "l1", external_id: "pik1", name: "PIK1 Foodcourt", created_at: "a" }],
  [{ id: "f1", location_id: "l1", file_path: "foto/t.jpg", label: "Teras", storage_path: null, description: "Meja biru", areas: ["Teras"], position: 0 }],
  [{ location_id: "l1", title: "Scene", body: "Food court terbuka", areas: [], position: 0 }],
);

vi.mock("./useLibraryData", () => ({
  useLibraryData: () => ({
    data: { menus, locations, photos: { "o/photos/p1.png": "https://x/p1.png" } },
    isPending: false,
    error: null,
  }),
}));

describe("LibraryTab", () => {
  it("lists products with status and shows the selected one", () => {
    render(
      <div className="ck">
        <LibraryTab kind="menu" headLeft={<h1>Content Studio</h1>} />
      </div>,
    );
    expect(screen.getByText("siap")).toBeTruthy();
    expect(screen.getByText("menunggu deskripsi")).toBeTruthy();
    expect(screen.getByText("Sate babi bakar arang")).toBeTruthy();

    fireEvent.click(screen.getByText("Iga bakar"));
    expect(screen.getByText("Foto referensi (1)")).toBeTruthy();
    expect(screen.getByText(/isi deskripsi menu Iga bakar/)).toBeTruthy();
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
  });
});
