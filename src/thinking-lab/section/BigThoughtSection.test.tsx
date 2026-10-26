import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BigThoughtSection, type BigThoughtRowView } from "@/thinking-lab/section/BigThoughtSection";

vi.mock("@/shared/i18n/useAppTranslation", () => ({
  useAppTranslation: () => ({
    t: (key: string, fallback?: string, variables?: Record<string, string | number>) => {
      const text = fallback ?? key;
      if (!variables) return text;
      return Object.entries(variables).reduce(
        (acc, [name, value]) => acc.replaceAll(`{{${name}}}`, String(value)),
        text,
      );
    },
  }),
}));

function row(overrides: Partial<BigThoughtRowView> & Pick<BigThoughtRowView, "id" | "code">): BigThoughtRowView {
  return {
    statement: "A big thought",
    admission: "GENERATE_VALID",
    audit: null,
    facts: null,
    siblingDistinct: null,
    siblingPairs: null,
    reasonContribution: null,
    siblingUnresolvedReasons: null,
    canGenerateTerritory: false,
    territories: [],
    ...overrides,
  };
}

describe("BigThoughtSection territory entry", () => {
  it("shows the short label as a heading and keeps the Key Belief", () => {
    render(
      <BigThoughtSection
        rows={[
          row({
            id: "bt-1",
            code: "BT01",
            label: "Karakter Bahan",
            statement: "Bahan yang berbeda punya karakter alami yang berbeda.",
          }),
        ]}
        missingWhy={null}
        notice={null}
        auditProgress={null}
      />,
    );
    expect(screen.getByText("BT01 — Karakter Bahan")).toBeTruthy();
    expect(screen.queryByText("GENERATE_VALID")).toBeNull();
    expect(screen.getByText(/Key Belief:/)).toBeTruthy();
    expect(screen.getByText(/Bahan yang berbeda punya karakter alami yang berbeda/)).toBeTruthy();
  });

  it("offers Generate Territory only on a locked current row and nests admitted territories there", () => {
    render(
      <BigThoughtSection
        rows={[
          row({
            id: "bt-1",
            code: "BT01",
            canGenerateTerritory: true,
            territories: [{ id: "t1", code: "TR01", statement: "First space" }],
          }),
          row({
            id: "bt-2",
            code: "BT02",
            canGenerateTerritory: false,
            territories: [{ id: "t2", code: "TR09", statement: "Second space" }],
          }),
        ]}
        missingWhy={null}
        notice={null}
        auditProgress={null}
        onGenerateTerritory={vi.fn()}
      />,
    );
    const buttons = screen.getAllByRole("button", { name: "Generate Territory" });
    expect(buttons).toHaveLength(1);
    const first = screen.getByText("BT01").closest("li");
    const second = screen.getByText("BT02").closest("li");
    expect(first?.textContent).toContain("TR01");
    expect(first?.textContent).not.toContain("TR09");
    expect(second?.textContent).toContain("TR09");
    expect(second?.textContent).not.toContain("Generate Territory");
    expect(screen.queryByText("Generate Angle")).toBeNull();
    expect(screen.queryByText("Territory Lock")).toBeNull();
    expect(screen.queryByRole("button", { name: "Generate Idea" })).toBeNull();
  });

  it("renders admitted angles under the correct Territory without a Generate Angle button", () => {
    render(
      <BigThoughtSection
        rows={[
          row({
            id: "bt-1",
            code: "BT01",
            canGenerateTerritory: true,
            territories: [
              {
                id: "t1",
                code: "TR01",
                statement: "First space",
                canGenerateAngle: true,
                angles: [{ id: "a1", code: "AN01", statement: "One point of view", relation: "VALID_ANGLE" }],
              },
              {
                id: "t2",
                code: "TR02",
                statement: "Second space",
                canGenerateAngle: false,
                angles: [{ id: "a2", code: "AN09", statement: "Another point of view", relation: "VALID_ANGLE" }],
              },
            ],
          }),
        ]}
        missingWhy={null}
        notice={null}
        auditProgress={null}
        onGenerateTerritory={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Generate Angle" })).toBeNull();
    const first = screen.getByText("TR01").closest("li");
    const second = screen.getByText("TR02").closest("li");
    expect(first?.textContent).toContain("AN01");
    expect(first?.textContent).toContain("VALID_ANGLE");
    expect(first?.textContent).not.toContain("AN09");
    expect(second?.textContent).toContain("AN09");
    expect(second?.textContent).not.toContain("AN01");
    expect(screen.queryByRole("button", { name: "Generate Idea" })).toBeNull();
  });

  it("shows a spinner below while Big Thoughts are generating", () => {
    render(
      <BigThoughtSection
        rows={[]}
        missingWhy={null}
        notice={null}
        auditProgress={null}
        generating
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("Generating Big Thoughts");
    expect(screen.queryByText("No Big Thoughts yet.")).toBeNull();
  });

  it("keeps an audit failure in the list and offers Fix for that card", () => {
    const onFixBigThought = vi.fn();
    render(
      <BigThoughtSection
        rows={[
          row({ id: "a", code: "BT03", label: "Bunga Majemuk", statement: "Failed compound", audit: "AUDIT_FAIL" }),
          row({ id: "c", code: "BT05", label: "Beban Finansial", statement: "A passing burden", audit: "AUDIT_PASS" }),
        ]}
        missingWhy={null}
        notice={null}
        auditProgress={null}
        onFixBigThought={onFixBigThought}
        onDeleteBigThought={vi.fn()}
      />,
    );
    expect(screen.getByText(/Failed compound/)).toBeTruthy();
    expect(screen.getByText(/A passing burden/)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Fix" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Fix" }));
    expect(onFixBigThought).toHaveBeenCalledWith("BT03");
    fireEvent.keyDown(screen.getAllByRole("button", { name: /More actions/ })[0], { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Fix" }));
    expect(onFixBigThought).toHaveBeenCalledWith("BT03");
  });

  it("shows the pass checklist while generating and keeps the candidate sentence hidden", () => {
    render(
      <BigThoughtSection
        rows={[]}
        missingWhy={null}
        notice={null}
        auditProgress={null}
        generating
        generateChecklist={{
          items: [
            { id: "resolved", state: "pass", reason: "" },
            { id: "relation", state: "fail", reason: "ELABORATION" },
            { id: "role", state: "unchecked", reason: "" },
            { id: "explains", state: "unchecked", reason: "" },
            { id: "premise", state: "unchecked", reason: "" },
            { id: "duplicate", state: "unchecked", reason: "" },
            { id: "sibling", state: "unchecked", reason: "" },
          ],
          passed: false,
          lesson: { gate: "relation", reason: "ELABORATION", statement: "Hidden failed clause" },
          failure: { gate: "relation", reason: "ELABORATION", earlier: "pass" },
          report: { gate: "relation", phase: "checked", outcome: "fail" },
        }}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("Generating Big Thoughts");
    expect(screen.getByText("Not a restatement, elaboration, outcome, or method.")).toBeTruthy();
    expect(
      screen.getByText("Checked: Not a restatement, elaboration, outcome, or method. It did not pass."),
    ).toBeTruthy();
    expect(screen.queryByText("Hidden failed clause")).toBeNull();
    expect(screen.queryByText("Role is premise, reason, or evidence.")).toBeNull();
    const checks = screen.getAllByRole("listitem").map((item) => item.textContent ?? "");
    expect(checks[0]).toContain("Not a duplicate of a Big Thought that already passed.");
    expect(checks[1]).toContain("The judgment is finished.");
    expect(checks[2]).toContain("Not a restatement, elaboration, outcome, or method.");
  });

  it("reports on a saved Big Thought that every pass requirement was checked", () => {
    render(
      <BigThoughtSection
        rows={[
          row({
            id: "bt-1",
            code: "BT01",
            statement: "A kept reason",
            facts: {
              code: "BT01",
              whatItSays: "A kept reason",
              relationToParent: "DISTINCT_MATERIAL_SUPPORT",
              supportRole: "REASON",
              explainsWhyParentIsTrue: true,
              introducesUnsupportedPremise: false,
              duplicateOfCode: null,
              resolution: "RESOLVED",
              unresolvedReasons: [],
              passConfirmed: true,
            },
          }),
        ]}
        missingWhy={null}
        notice={null}
        auditProgress={null}
      />,
    );
    expect(screen.getByText("Every pass requirement was checked.")).toBeTruthy();
    expect(screen.getByText("The judgment is finished.")).toBeTruthy();
    expect(screen.getByText("Distinct from the other Big Thoughts.")).toBeTruthy();
  });

  it("keeps a rejected Big Thought out of the list", () => {
    render(
      <BigThoughtSection
        rows={[
          row({
            id: "bt-1",
            code: "BT01",
            statement: "A kept reason",
          }),
          row({
            id: "bt-2",
            code: "BT02",
            statement: "Visible failed clause",
            admission: "GENERATE_REJECT",
            gateFailure: { gate: "relation", reason: "ELABORATION", earlier: "pass" },
          }),
        ]}
        missingWhy={null}
        notice={null}
        auditProgress={null}
      />,
    );
    expect(screen.getByText(/A kept reason/)).toBeTruthy();
    expect(screen.queryByText(/Visible failed clause/)).toBeNull();
    expect(screen.queryByText("GENERATE_REJECT")).toBeNull();
  });

  it("reports each audit requirement as it is checked", () => {
    render(
      <BigThoughtSection
        rows={[]}
        missingWhy={null}
        notice={null}
        auditProgress={{
          done: 1,
          total: 6,
          current: { code: "BT14", statement: "Desain Ruang Privasi" },
          checklist: {
            items: [
              { id: "resolved", state: "pass", reason: "" },
              { id: "relation", state: "checking", reason: "" },
              { id: "role", state: "pending", reason: "" },
              { id: "explains", state: "pending", reason: "" },
              { id: "premise", state: "pending", reason: "" },
              { id: "duplicate", state: "pending", reason: "" },
              { id: "sibling", state: "pending", reason: "" },
            ],
            passed: false,
            lesson: null,
            failure: null,
            report: { gate: "relation", phase: "checking", outcome: "pass" },
          },
        }}
      />,
    );
    expect(screen.getByText("1/6")).toBeTruthy();
    expect(screen.getByText(/BT14/)).toBeTruthy();
    expect(
      screen.getByText("Checking this requirement: Not a restatement, elaboration, outcome, or method."),
    ).toBeTruthy();
  });

  it("keeps an audited failure in the list so Fix can repair that card", () => {
    render(
      <BigThoughtSection
        rows={[
          row({
            id: "bt-1",
            code: "BT01",
            statement: "A kept reason",
            audit: "AUDIT_PASS",
            auditGatesChecked: true,
          }),
          row({
            id: "bt-2",
            code: "BT02",
            statement: "A private room that repeats another job",
            audit: "AUDIT_FAIL",
            auditGateFailure: { gate: "sibling", reason: "Same reasoning job.", earlier: "pass" },
          }),
        ]}
        missingWhy={null}
        notice={null}
        auditProgress={null}
      />,
    );
    expect(screen.getByText(/A kept reason/)).toBeTruthy();
    expect(screen.getByText(/A private room that repeats another job/)).toBeTruthy();
    expect(screen.getAllByText("AUDIT_FAIL").length).toBeGreaterThan(0);
  });
});
