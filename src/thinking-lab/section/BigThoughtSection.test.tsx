import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BigThoughtSection, type BigThoughtRowView } from "@/thinking-lab/section/BigThoughtSection";

vi.mock("@/shared/i18n/useAppTranslation", () => ({
  useAppTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
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
        fixResponses={[]}
      />,
    );
    expect(screen.getByText("BT01 — Karakter Bahan")).toBeTruthy();
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
        fixResponses={[]}
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
        fixResponses={[]}
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
});
