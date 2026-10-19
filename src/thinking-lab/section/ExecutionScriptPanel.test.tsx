import { render, screen } from "@testing-library/react";
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
  it("hides pending checks and keeps a passed checklist when a production line is open", () => {
    render(
      <ExecutionScriptPanel
        pillarName="Behind The Scene"
        statement="Mekanismenya kelihatan."
        script={script}
        admission="GENERATE_VALID"
        facts={facts({ meaningAudit: { cleared: true } })}
        checks={[
          { id: "pillarFits", state: "pass" },
          { id: "sellingFits", state: "fail", reason: "Flash Sale Hook needs a Master Thought that is actually selling." },
          { id: "mechanismVisible", state: "pending" },
        ]}
      />,
    );
    expect(screen.getByText("Passed")).toBeTruthy();
    expect(screen.getByText("The pillar does not force a message outside the Idea")).toBeTruthy();
    expect(screen.getByText("Flash Sale only when the Master Thought is selling")).toBeTruthy();
    expect(screen.queryByText("The Idea's mechanism is visible")).toBeNull();
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
});
