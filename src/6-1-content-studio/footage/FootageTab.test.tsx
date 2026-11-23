import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

const connectBank = vi.fn(async () => ({ state: "ready" as const, name: "bank-footage" }));
const openBankFile = vi.fn(async () => {
  throw new Error("not-found");
});

vi.mock("./localBank", () => ({
  loadBankState: () => Promise.resolve({ state: "ready", name: "bank-footage" }),
  connectBank: (...args: unknown[]) => connectBank(...(args as Parameters<typeof connectBank>)),
  openBankFile: (...args: unknown[]) => openBankFile(...(args as Parameters<typeof openBankFile>)),
}));

const setBan = vi.fn(async () => true);
vi.mock("./useFootageBan", () => ({
  useFootageBan: () => ({ setBan: (...args: unknown[]) => setBan(...(args as Parameters<typeof setBan>)) }),
}));

describe("FootageTab", () => {
  beforeEach(() => {
    connectBank.mockClear();
    openBankFile.mockClear();
    setBan.mockClear();
    openBankFile.mockRejectedValue(new Error("not-found"));
    connectBank.mockResolvedValue({ state: "ready", name: "bank-footage" });
    setBan.mockResolvedValue(true);
  });

  it("renders cards, filters with counts, and the player panel", async () => {
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
    await waitFor(() => expect(within(panel).getByText(/Pilih ulang folder/)).toBeTruthy());
  });

  it("retries opening the file after Pilih ulang folder even when the folder name is unchanged", async () => {
    render(
      <div className="ck">
        <FootageTab headLeft={<h1>Content Studio</h1>} />
      </div>,
    );

    fireEvent.click(screen.getByText("Sate dibakar"));
    const panel = document.querySelector(".m") as HTMLElement;
    await waitFor(() => expect(within(panel).getByText(/Pilih ulang folder/)).toBeTruthy());
    const opensBefore = openBankFile.mock.calls.length;

    await act(async () => {
      fireEvent.click(within(panel).getByRole("button", { name: "Pilih ulang folder" }));
    });

    expect(connectBank).toHaveBeenCalledWith("org-1", true);
    await waitFor(() => expect(openBankFile.mock.calls.length).toBeGreaterThan(opensBefore));
  });

  it("shows Tandai jangan dipakai / Batalkan tanda like katalog.html", async () => {
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("senyum AI");
    render(
      <div className="ck">
        <FootageTab headLeft={<h1>Content Studio</h1>} />
      </div>,
    );

    fireEvent.click(screen.getByText("Sate dibakar"));
    const panel = document.querySelector(".m") as HTMLElement;
    const mark = await within(panel).findByRole("button", { name: /Tandai jangan dipakai/ });
    await act(async () => {
      fireEvent.click(mark);
    });
    expect(promptSpy).toHaveBeenCalled();
    expect(setBan).toHaveBeenCalledWith("s1", "senyum AI");
    await within(panel).findByRole("button", { name: "Batalkan tanda" });

    await act(async () => {
      fireEvent.click(within(panel).getByRole("button", { name: "Batalkan tanda" }));
    });
    expect(setBan).toHaveBeenCalledWith("s1", null);
    promptSpy.mockRestore();
  });
});
