import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExecutionScriptPanel } from "@/thinking-lab/section/ExecutionScriptPanel";
import type { ExecutionSemanticFacts } from "@/thinking-lab/execution/types";
import type { VoiceOverScript } from "@/thinking-lab/execution/script";

vi.mock("@/shared/i18n/useAppTranslation", () => ({
  useAppTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

const facts = (overrides: Partial<ExecutionSemanticFacts> = {}): ExecutionSemanticFacts => ({
  pillar: "Behind The Scene",
  whatItSays: "",
  relationToParent: "VALID_EXECUTION",
  messageAdded: false,
  mechanismVisible: true,
  pillarOutside: false,
  masterSells: "unresolved",
  viewerClimb: "CLIMBS",
  subjectMatch: "MATCH",
  resolution: "RESOLVED",
  unresolvedReasons: [],
  ...overrides,
});

const script: VoiceOverScript = {
  title: "Judul",
  caption: "",
  assets: { locations: [], characters: [], properties: [] },
  scenes: [{ id: "s1", title: "Mekanisme", lines: [{ id: "s1-l1", narration: "Mekanismenya kelihatan.", shots: [] }] }],
  lineIssues: [],
  productionIssues: [{ lineId: "s1-l1", reason: "Sudut pandang masuk ke orang lain.", kind: "viewpoint" }],
  audio: { sound: false, music: false },
};

describe("ExecutionScriptPanel checklist", () => {
  it("shows every pass requirement, including the ones still waiting", () => {
    render(
      <ExecutionScriptPanel
        pillarName="Behind The Scene"
        statement="Mekanismenya kelihatan."
        script={script}
        admission="GENERATE_VALID"
        facts={facts({ meaningAudit: { cleared: true } })}
        checks={[
          { id: "pillarFits", state: "pass" },
          { id: "hookHolds", state: "fail", reason: "Pembukanya umum." },
          { id: "mechanismVisible", state: "pending" },
        ]}
      />,
    );
    expect(screen.getByText("Passed")).toBeTruthy();
    expect(screen.getByText("The pillar does not force a message outside the Idea")).toBeTruthy();
    expect(screen.getByText("The first sentence uses this pillar's format and the situation is clear")).toBeTruthy();
    expect(screen.getByText("The Idea's mechanism is visible")).toBeTruthy();
    expect(screen.getByText("Sudut pandang masuk ke orang lain.")).toBeTruthy();
  });

  it("keeps an older row failed while a line issue remains", () => {
    render(
      <ExecutionScriptPanel
        pillarName="Behind The Scene"
        statement="Mekanismenya kelihatan."
        script={{ ...script, productionIssues: undefined, lineIssues: [{ lineId: "s1-l1", reason: "Baris lama." }] }}
        admission="GENERATE_VALID"
        facts={facts()}
      />,
    );
    expect(screen.getByText("Not passed")).toBeTruthy();
    expect(screen.getAllByText("Baris lama.").length).toBeGreaterThan(0);
  });

  it("spins only the narration line whose fix is running", () => {
    const twoLines: VoiceOverScript = {
      ...script,
      scenes: [
        {
          id: "s1",
          title: "Scene",
          lines: [
            { id: "s1-l1", narration: "Satu.", shots: [] },
            { id: "s1-l2", narration: "Dua.", shots: [] },
          ],
        },
      ],
      productionIssues: [
        { lineId: "s1-l1", reason: "Masuk ke orang lain.", kind: "viewpoint" },
        { lineId: "s1-l2", reason: "Kesadaran internal.", kind: "viewpoint" },
      ],
    };
    render(
      <ExecutionScriptPanel
        pillarName="Behind The Scene"
        statement="Satu. Dua."
        script={twoLines}
        admission="GENERATE_VALID"
        facts={facts({ meaningAudit: { cleared: true } })}
        pending
        fixingLineId="s1-l2"
        onFixLine={() => undefined}
      />,
    );
    const buttons = screen.getAllByRole("button", { name: "Fix this line" });
    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.getAttribute("aria-busy")).toBe("false");
    expect(buttons[1]?.getAttribute("aria-busy")).toBe("true");
    expect(buttons[0]?.querySelector(".animate-spin")).toBeNull();
    expect(buttons[1]?.querySelector(".animate-spin")).toBeTruthy();
  });

  it("offers a regenerate button on every narration line", () => {
    const onRegenerateLine = vi.fn();
    const quiet: VoiceOverScript = {
      ...script,
      productionIssues: undefined,
      lineIssues: [],
      scenes: [
        {
          id: "s1",
          title: "Scene",
          lines: [
            { id: "s1-l1", narration: "Satu.", shots: [{ id: "h1", role: "Shot 1", angle: "", visualFunction: "", prompt: "" }, { id: "h2", role: "Shot 2", angle: "", visualFunction: "", prompt: "" }] },
            { id: "s1-l2", narration: "Dua.", shots: [] },
          ],
        },
      ],
    };
    render(
      <ExecutionScriptPanel
        pillarName="Behind The Scene"
        statement="Satu. Dua."
        script={quiet}
        admission="GENERATE_VALID"
        facts={facts({ meaningAudit: { cleared: true } })}
        onRegenerateLine={onRegenerateLine}
      />,
    );
    const buttons = screen.getAllByRole("button", { name: "Regenerate this line" });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]);
    expect(onRegenerateLine).toHaveBeenCalledWith("s1-l1");
  });

  it("switches one requirement off without clearing the ones that passed", () => {
    const onTogglePass = vi.fn();
    render(
      <ExecutionScriptPanel
        pillarName="Behind The Scene"
        statement="Mekanismenya kelihatan."
        script={script}
        admission="GENERATE_VALID"
        facts={facts({ meaningAudit: { cleared: true } })}
        checks={[
          { id: "hookHolds", state: "pass" },
          { id: "messageStays", state: "pass" },
          { id: "emotionalTone", state: "fail", reason: "Narasi hanya menjelaskan sistem.", enabled: true },
        ]}
        onTogglePass={onTogglePass}
      />,
    );
    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(3);
    fireEvent.click(switches[2]);
    expect(onTogglePass).toHaveBeenCalledWith("emotionalTone", false);
    expect(screen.getByText("The first sentence uses this pillar's format and the situation is clear")).toBeTruthy();
  });

  it("repairs one image slide and keeps a whole-carousel failure on rewrite", () => {
    const imageScript: VoiceOverScript = {
      ...script,
      medium: "image",
      image: { format: "carousel", slideCountMode: "manual", slideCount: 2, withImage: true },
      productionIssues: undefined,
      lineIssues: [],
    };
    const failed = facts({
      relationToParent: "FORMAT_MISSED",
      whatItSays: "Slide s1-l1 mengulang inti Idea.",
      meaningAudit: { id: "formatHolds", reason: "Slide s1-l1 mengulang inti Idea.", lineIds: ["s1-l1"] },
    });
    const { rerender } = render(
      <ExecutionScriptPanel
        pillarName="Education - The 'Stop Doing This'"
        statement="Satu."
        script={imageScript}
        admission="GENERATE_VALID"
        facts={failed}
        onRepair={() => undefined}
        onRewrite={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "Repair the failing lines" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Rewrite this execution" })).toBeNull();
    expect(screen.queryByText("The spoken lines use this pillar's format")).toBeNull();
    rerender(
      <ExecutionScriptPanel
        pillarName="Education - The 'Stop Doing This'"
        statement="Satu."
        script={imageScript}
        admission="GENERATE_VALID"
        facts={facts({
          relationToParent: "MESSAGE_ADDED",
          whatItSays: "Slide menambah solusi.",
          meaningAudit: { id: "messageStays", reason: "Slide menambah solusi.", lineIds: [] },
        })}
        onRepair={() => undefined}
        onRewrite={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "Rewrite this execution" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Repair the failing lines" })).toBeNull();
  });

  it("shows a use button on each of the three pillar choices", () => {
    const usePillar = vi.fn();
    render(
      <ExecutionScriptPanel
        pillarName="Red Flags"
        statement="Satu."
        script={script}
        admission="GENERATE_VALID"
        facts={facts({ relationToParent: "MECHANISM_HIDDEN" })}
        progress={{ phase: "recommend", pillarName: "Red Flags" }}
        pending
        onUseRecommendation={usePillar}
        pillarChoices={[
          { pillarName: "Audit Akun Publik", reason: "Format ini membedah masalah." },
          { pillarName: "B-Roll Storytelling", reason: "Format ini menggambarkan ketegangan." },
          { pillarName: "Build in Public", reason: "Format ini menunjukkan proses." },
          { pillarName: "Fourth", reason: "Tidak ditampilkan." },
        ]}
      />,
    );
    expect(screen.queryByText("Fourth")).toBeNull();
    const buttons = screen.getAllByRole("button", { name: "Use {{pillar}}" });
    expect(buttons).toHaveLength(3);
    fireEvent.click(buttons[0]);
    expect(usePillar).toHaveBeenCalledWith("Audit Akun Publik");
  });

  it("shows the spoken lines and the checklist while a draft is being checked", () => {
    const draft: VoiceOverScript = {
      title: "Judul posting",
      caption: "Caption posting",
      assets: { locations: [], characters: [], properties: [] },
      scenes: [
        {
          id: "s1",
          title: "Adegan Satu",
          lines: [{ id: "s1-l1", narration: "Andai saja aku tahu.", shots: [{ id: "h", role: "A", angle: "", visualFunction: "", prompt: "A letter." }] }],
        },
        {
          id: "s2",
          title: "Ajakan",
          purpose: "cta",
          lines: [{ id: "s2-l1", narration: "Ikuti akun ini sekarang.", shots: [] }],
        },
      ],
      lineIssues: [],
      audio: { sound: false, music: false },
    };
    const checks = [{ id: "messageStays", state: "running" as const }];
    const { rerender } = render(
      <ExecutionScriptPanel
        pillarName="Letter to Younger Self"
        statement="Satu."
        script={script}
        reading={draft}
        admission="GENERATE_VALID"
        facts={facts()}
        progress={{ phase: "audit", pillarName: "Letter to Younger Self" }}
        checks={checks}
      />,
    );
    expect(screen.getByText("Andai saja aku tahu.")).toBeTruthy();
    expect(screen.getByText("Ikuti akun ini sekarang.")).toBeTruthy();
    expect(screen.getByText("The script does not add a claim")).toBeTruthy();
    expect(screen.queryByText("Adegan Satu")).toBeNull();
    expect(screen.queryByText("Best title")).toBeNull();
    expect(screen.queryByText("Best caption")).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Shot" })).toBeNull();
    rerender(
      <ExecutionScriptPanel
        pillarName="Letter to Younger Self"
        statement="Satu."
        script={draft}
        admission="GENERATE_VALID"
        facts={facts()}
        checks={checks}
      />,
    );
    expect(screen.getByText("Adegan Satu")).toBeTruthy();
    expect(screen.getByText("Best title")).toBeTruthy();
    expect(screen.getByText("Best caption")).toBeTruthy();
    expect(screen.getAllByRole("columnheader", { name: "Shot" }).length).toBeGreaterThan(0);
  });

  it("accepts or keeps the previous line from a switch rewrite", () => {
    const onAcceptPassProposal = vi.fn();
    const onDeclinePassProposal = vi.fn();
    const { container } = render(
      <ExecutionScriptPanel
        pillarName="Behind The Scene"
        statement="Mekanismenya kelihatan."
        script={script}
        admission="GENERATE_VALID"
        facts={facts({ meaningAudit: { cleared: true } })}
        checks={[{ id: "usesSlang", state: "pending", enabled: true }]}
        passProposal={[
          {
            lineId: "s1-l1",
            before: "Hal ini sangat penting.",
            after: "Hal ini penting banget.",
            beforeWords: [
              { text: "Hal", changed: false },
              { text: "ini", changed: false },
              { text: "sangat", changed: true },
              { text: "penting.", changed: false },
            ],
            afterWords: [
              { text: "Hal", changed: false },
              { text: "ini", changed: false },
              { text: "penting", changed: false },
              { text: "banget.", changed: true },
            ],
          },
        ]}
        onAcceptPassProposal={onAcceptPassProposal}
        onDeclinePassProposal={onDeclinePassProposal}
      />,
    );
    expect(screen.getAllByText("Before").length).toBeGreaterThan(0);
    expect(screen.getAllByText("After").length).toBeGreaterThan(0);
    expect(container.querySelector(".line-through[data-word-change]")?.textContent).toBe("sangat");
    expect(container.querySelector(".bg-emerald-100[data-word-change]")?.textContent).toBe("banget.");
    expect(screen.getByText("Mekanismenya kelihatan.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Accept these changes" }));
    expect(onAcceptPassProposal).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Keep the previous lines" }));
    expect(onDeclinePassProposal).toHaveBeenCalledTimes(1);
  });
});
