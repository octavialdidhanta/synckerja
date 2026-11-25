import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildFootageRows } from "./footageRows";
import { FootageTab } from "./FootageTab";

const data = buildFootageRows({
  assets: [
    { id: "a1", file_key: "PIK1/clip1.mp4", media_type: "video", location_label: "PIK1", product_label: "sate babi", summary: "Klip satu", storage_status: "bank", duration_seconds: 5, tag_status: "perlu_dicek" },
    { id: "a2", file_key: "PIK2/clip2.mp4", media_type: "video", location_label: "PIK2", product_label: "sate babi", summary: "Klip dua", storage_status: "bank", duration_seconds: 5 },
    {
      id: "a3",
      file_key: "INBOX/goat.mp4",
      media_type: "video",
      location_label: null,
      product_label: null,
      summary: "Inbox goat",
      storage_status: "inbox",
      duration_seconds: 5,
      tag_status: "belum",
      preview_storage_path: "org/previews/a3.mp4",
    },
  ],
  scenes: [
    { id: "s1", asset_id: "a1", start_seconds: 0, end_seconds: 2, scene_kind: "produk", summary: "Sate dibakar", note: null, thumb_storage_path: "t/s1.jpg" },
    { id: "s2", asset_id: "a2", start_seconds: 0, end_seconds: 2, scene_kind: "orang", summary: "Gigit sate", note: null, thumb_storage_path: null },
    { id: "s3", asset_id: "a3", start_seconds: 0, end_seconds: 2, scene_kind: "produk", summary: "Sop sumsum inbox", note: null, thumb_storage_path: null },
  ],
  tagDefs: [],
  tagValues: [],
  usages: [],
  bans: [{ scene_id: "s2", reason: "senyum" }],
  menus: [{ name: "Sate Babi", aliases: ["sate babi"] }],
});

vi.mock("./useFootageData", () => ({
  useFootageData: () => ({
    data: {
      ...data,
      thumbs: { "t/s1.jpg": "https://x/s1.jpg" },
    },
    isPending: false,
    error: null,
  }),
}));

vi.mock("@/shared/auth/hooks/useOrgBootstrapPending", () => ({ useOrgBootstrapPending: () => ({ organizationId: "org-1" }) }));

const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.endsWith("/health")) return new Response(JSON.stringify({ ok: true }), { status: 200 });
  if (url.includes("key=PIK2")) return new Response("x", { status: 206 });
  if (url.includes("nope")) return new Response("", { status: 404 });
  return new Response("x", { status: 206 });
});

const setBan = vi.fn(async () => true);
const checkTags = vi.fn(async () => true);
const hideClip = vi.fn(async () => ({ saved: true as const }));
vi.mock("./useFootageBan", () => ({
  useFootageBan: () => ({ setBan: (...args: unknown[]) => setBan(...(args as Parameters<typeof setBan>)) }),
  useFootageTagCheck: () => (...args: unknown[]) => checkTags(...(args as Parameters<typeof checkTags>)),
}));
vi.mock("./useFootageHide", () => ({
  useFootageHide: () => ({
    hide: (...args: unknown[]) => hideClip(...(args as Parameters<typeof hideClip>)),
    restore: vi.fn(async () => true),
    listHidden: vi.fn(async () => []),
  }),
}));

describe("FootageTab", () => {
  beforeEach(() => {
    fetchMock.mockClear();
    setBan.mockClear();
    setBan.mockResolvedValue(true);
    vi.stubGlobal("fetch", fetchMock);
  });

  it("renders cards, filters with counts, and the player panel", async () => {
    render(
      <div className="ck">
        <FootageTab headLeft={<h1>Content Studio</h1>} />
      </div>,
    );
    expect(screen.getByText("3 scene · 3 klip")).toBeTruthy();
    expect(screen.getByText("JANGAN DIPAKAI")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Jangan dipakai\s*1/ }));
    expect(screen.getByText("1 scene · 1 klip")).toBeTruthy();
    expect(screen.queryByText("Sate dibakar")).toBeNull();

    await waitFor(() => expect(screen.getByText(/Laptop/)).toBeTruthy());
    expect(screen.queryByRole("button", { name: /Allow footage|Allow inbox|Link laptop/ })).toBeNull();

    fireEvent.click(screen.getByText("Gigit sate"));
    const panel = document.querySelector(".m") as HTMLElement;
    expect(within(panel).getByText("PIK2/clip2.mp4")).toBeTruthy();
    await waitFor(() => {
      const video = panel.querySelector("video");
      expect(video?.getAttribute("src")).toContain("127.0.0.1:47331/footage");
      expect(video?.getAttribute("src")).toContain("org=org-1");
      expect(video?.getAttribute("src")).toContain("PIK2%2Fclip2.mp4");
    });
  });

  it("says the file is missing instead of playing a cloud preview", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/health")) return new Response(JSON.stringify({ ok: true }), { status: 200 });
      return new Response("", { status: 404 });
    });
    render(
      <div className="ck">
        <FootageTab headLeft={<h1>Content Studio</h1>} />
      </div>,
    );
    fireEvent.click(screen.getByText("Sop sumsum inbox"));
    const panel = document.querySelector(".m") as HTMLElement;
    await waitFor(() => expect(within(panel).getByText("File tidak ada di folder laptop")).toBeTruthy());
    expect(panel.querySelector("video")).toBeNull();
    expect(within(panel).queryByText(/Preview cloud/)).toBeNull();
  });

  it("says the agent has not joined this organization when the player is still waiting", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/health")) return new Response(JSON.stringify({ ok: true }), { status: 200 });
      return new Response("", { status: 503 });
    });
    render(
      <div className="ck">
        <FootageTab headLeft={<h1>Content Studio</h1>} />
      </div>,
    );
    fireEvent.click(screen.getByText("Sop sumsum inbox"));
    const panel = document.querySelector(".m") as HTMLElement;
    await waitFor(() => expect(within(panel).getByText("Agent belum tersambung ke organisasi ini")).toBeTruthy());
    expect(panel.querySelector("video")).toBeNull();
  });

  it("says the agent is off when this laptop is not serving files", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    render(
      <div className="ck">
        <FootageTab headLeft={<h1>Content Studio</h1>} />
      </div>,
    );
    await waitFor(() => expect(screen.getByText("Agent off")).toBeTruthy());
    fireEvent.click(screen.getByText("Sate dibakar"));
    const panel = document.querySelector(".m") as HTMLElement;
    expect(within(panel).getByText("Agent belum jalan")).toBeTruthy();
    expect(panel.querySelector("video")).toBeNull();
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

  it("hides the whole clip after confirm", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <div className="ck">
        <FootageTab headLeft={<h1>Content Studio</h1>} />
      </div>,
    );
    fireEvent.click(screen.getByText("Sate dibakar"));
    const panel = document.querySelector(".m") as HTMLElement;
    await act(async () => {
      fireEvent.click(within(panel).getByRole("button", { name: "Hapus klip" }));
    });
    expect(confirmSpy).toHaveBeenCalled();
    expect(hideClip).toHaveBeenCalledWith("a1", false);
    confirmSpy.mockRestore();
  });

  it("marks AI-tagged clips and lets a person confirm the tags", async () => {
    render(
      <div className="ck">
        <FootageTab headLeft={<h1>Content Studio</h1>} />
      </div>,
    );
    expect(screen.getByText("AI · CEK")).toBeTruthy();
    fireEvent.click(screen.getByText("Sate dibakar"));
    const panel = document.querySelector(".m") as HTMLElement;
    const ok = await within(panel).findByRole("button", { name: /Tag sudah benar/ });
    await act(async () => {
      fireEvent.click(ok);
    });
    expect(checkTags).toHaveBeenCalledWith("a1");
  });
});
