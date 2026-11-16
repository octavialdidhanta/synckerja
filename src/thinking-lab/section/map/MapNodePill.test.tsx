import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Pill } from "./MapNodePill";

vi.mock("@/shared/i18n/useAppTranslation", () => ({
  useAppTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

describe("Pill trailingAccessory", () => {
  it("renders trailing control without firing the pill onClick", () => {
    const onPill = vi.fn();
    const onTrail = vi.fn();
    render(
      <Pill
        nodeId="an:1"
        tone="angle"
        code="AN14"
        title="Narasi di balik angka"
        selected={false}
        childCount={2}
        onClick={onPill}
        trailingAccessory={(
          <button type="button" aria-label="Fokus angle" onClick={onTrail}>
            AI
          </button>
        )}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Fokus angle" }));
    expect(onTrail).toHaveBeenCalledTimes(1);
    expect(onPill).not.toHaveBeenCalled();
    expect(screen.getByText("+2")).toBeTruthy();
  });
});
