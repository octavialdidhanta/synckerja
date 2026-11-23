import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildFootageRows } from "./footageRows";
import { FootageTab } from "./FootageTab";

const data = buildFootageRows({
  assets: [
    { id: "a1", file_key: "PIK1/clip1.mp4", media_type: "video", location_label: "PIK1", product_label: "sate babi", summary: "Klip satu", storage_status: "bank", duration_seconds: 5 },
    { id: "a2", file_key: "PIK2/clip2.mp4", media_type: "video", location_label: "PIK2", product_label: "sate babi", summary: "Klip dua", storage_status: "bank", duration_seconds: 5 },
  ],
  scenes: [
    { id: "s1", asset_id: "a1", start_seconds: 0, end_seconds: 2, scene_kind: "produk", summary: "Sate dibakar", note: null, thumb_storage_path: "t/s1.jpg" },
    { id: "s2", asset_id: "a2", start_seconds: 0, end_seconds: 2, scene_kind: "orang", summary: "Gigit sate", note: null, thumb_storage_path: null },
  ],
  tagDefs: [],
  tagValues: [],
  usages: [],
  bans: [{ scene_id: "s2", reason: "senyum" }],
  menus: [{ name: "Sate Babi", aliases: ["sate babi"] }],
});

vi.mock("./useFootageData", () => ({
  useFootageData: () => ({ data: { ...data, thumbs: { "t/s1.jpg": "https://x/s1.jpg" } }, isPending: false, error: null }),
}));

vi.mock("@/shared/auth/hooks/useOrgBootstrapPending", () => ({ useOrgBootstrapPending: () => ({ organizationId: "org-1" }) }));

vi.mock("./localBank", () => ({
  loadBankState: () => Promise.resolve({ state: "none", name: null }),
  connectBank: () => Promise.resolve({ state: "none", name: null }),
  openBankFile: () => Promise.reject(new Error("no-folder")),
}));

describe("FootageTab", () => {
  it("renders cards, filters with counts, and the player panel", () => {
    render(
      <div className="ck">
        <FootageTab headLeft={<h1>Content Studio</h1>} />
      </div>,
    );
    expect(screen.getByText("2 scene · 2 klip")).toBeTruthy();
    expect(screen.getByText("JANGAN DIPAKAI")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Jangan dipakai\s*1/ }));
    expect(screen.getByText("1 scene · 1 klip")).toBeTruthy();
    expect(screen.queryByText("Sate dibakar")).toBeNull();

    fireEvent.click(screen.getByText("Gigit sate"));
    const panel = document.querySelector(".m") as HTMLElement;
    expect(within(panel).getByText("PIK2/clip2.mp4")).toBeTruthy();
    expect(within(panel).getByText(/Hubungkan folder/)).toBeTruthy();
  });
});
