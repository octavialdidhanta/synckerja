import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LockedPillarSection } from "@/thinking-lab/section/LockedPillarSection";
import type { VoiceOverScript } from "@/thinking-lab/execution/script";

vi.mock("@/shared/i18n/useAppTranslation", () => ({
  useAppTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

describe("LockedPillarSection", () => {
  it("shows the locked pillar on its own and opens execution settings from a format", () => {
    const onSelectFormat = vi.fn();
    render(
      <LockedPillarSection
        name="Letter to Younger Self"
        development="Surat untuk diri yang dulu."
        reason="Surat itu membawa mekanisme yang sama."
        format="video"
        pathUp={[{ label: "Idea", title: "Integrasi Keinginan Momen Ini" }]}
        onSelectFormat={onSelectFormat}
      />,
    );
    expect(screen.getByRole("heading", { name: "Letter to Younger Self" })).toBeTruthy();
    expect(screen.getByText("Surat untuk diri yang dulu.")).toBeTruthy();
    expect(screen.getByText("Integrasi Keinginan Momen Ini")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Carousel" }));
    expect(onSelectFormat).toHaveBeenCalledWith("carousel");
    fireEvent.click(screen.getByRole("button", { name: "Static Post" }));
    expect(onSelectFormat).toHaveBeenCalledWith("post");
  });

  it("shows the spoken lines and the checklist while the draft is being checked", () => {
    const reading: VoiceOverScript = {
      title: "Judul posting",
      caption: "Caption posting",
      assets: { locations: [], characters: [], properties: [] },
      scenes: [
        {
          id: "s1",
          title: "Adegan Satu",
          lines: [{ id: "s1-l1", narration: "Andai saja aku tahu.", shots: [] }],
        },
      ],
      lineIssues: [],
      audio: { sound: false, music: false },
    };
    render(
      <LockedPillarSection
        name="Letter to Younger Self"
        development="Surat untuk diri yang dulu."
        reason="Surat itu membawa mekanisme yang sama."
        format="video"
        progress={{ phase: "audit", pillarName: "Letter to Younger Self" }}
        checks={[{ id: "messageStays", state: "running" }]}
        reading={reading}
        onSelectFormat={vi.fn()}
      />,
    );
    expect(screen.getByText("Andai saja aku tahu.")).toBeTruthy();
    expect(screen.getByText("The script does not add a claim")).toBeTruthy();
    expect(screen.queryByText("Adegan Satu")).toBeNull();
    expect(screen.queryByText("Best caption")).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Shot" })).toBeNull();
  });
});
