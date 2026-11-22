import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
const job = parseShotJob("e2fb3654", {
  judul: "Sumsum Disedot",
  lokasi: "teras",
  arsip: true,
  shots: [{ id: "P01", judul: "Hook sumsum", menu: "sup-sumsum", action: "Lift one bone.", area: "Ruang makan", vo: "Tulang sumsumnya banyak" }],
});

vi.mock("../library/useLibraryData", () => ({
  useLibraryData: () => ({ data: { menus, locations, photos: {} }, isPending: false, error: null }),
}));
vi.mock("./useShotData", () => ({
  useShotData: () => ({ data: { fields: { judul: "MASTER", format: "9:16" }, jobs: [job] }, isPending: false, error: null }),
}));

describe("ShotListTab", () => {
  it("builds a quick prompt and loads an archived shot into the builder", () => {
    render(
      <div className="ck">
        <ShotListTab headLeft={<h1>Content Studio</h1>} />
      </div>,
    );
    expect(screen.getByText("Rakit prompt Google Flow")).toBeTruthy();
    expect(screen.getByText("Arsip (1)")).toBeTruthy();

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
});
