import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MasterThoughtSection } from "@/thinking-lab/section/MasterThoughtSection";

vi.mock("@/shared/i18n/useAppTranslation", () => ({
  useAppTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

const prior = "Ngga perlu pakai sistem, karena sistem mahal";
const planted = "Bisnis yang tidak memakai sistem membuang lebih banyak sumber daya.";

function renderSection(overrides: Partial<Parameters<typeof MasterThoughtSection>[0]> = {}) {
  const props: Parameters<typeof MasterThoughtSection>[0] = {
    locked: false,
    busy: false,
    suggesting: false,
    saving: false,
    priorDraft: prior,
    originalDraft: planted,
    audienceDraft: "Pemilik bisnis",
    options: [],
    confirmedStatement: null,
    onPriorChange: vi.fn(),
    onOriginalChange: vi.fn(),
    onAudienceChange: vi.fn(),
    onSuggest: vi.fn(),
    onSave: vi.fn(),
    ...overrides,
  };
  render(<MasterThoughtSection {...props} />);
  return props;
}

describe("MasterThoughtSection", () => {
  it("offers one save and one helper, nothing else", () => {
    const props = renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Simpan Master Thought" }));
    fireEvent.click(screen.getByRole("button", { name: "Bantu rumuskan" }));
    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onSuggest).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /Confirm/ })).toBeNull();
  });

  it("puts a picked option into the new belief field instead of saving it", () => {
    const props = renderSection({
      options: [{ belief: "Tanpa sistem, bisnis membuang lebih banyak waktu.", description: "Lolos syarat." }],
    });
    fireEvent.click(screen.getByRole("button", { name: /Tanpa sistem, bisnis membuang/ }));
    expect(props.onOriginalChange).toHaveBeenCalledWith("Tanpa sistem, bisnis membuang lebih banyak waktu.");
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("blocks saving without an old belief or when both beliefs say the same thing", () => {
    renderSection({ priorDraft: "" });
    expect(screen.getByRole("button", { name: "Simpan Master Thought" }).hasAttribute("disabled")).toBe(true);
  });

  it("explains a repeated old belief", () => {
    renderSection({ originalDraft: prior });
    expect(screen.getByText(/say the same thing/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Simpan Master Thought" }).hasAttribute("disabled")).toBe(true);
  });

  it("marks a belief that is already saved as written", () => {
    renderSection({ confirmedStatement: planted });
    expect(screen.getByText("Confirmed")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Simpan Master Thought" }).hasAttribute("disabled")).toBe(true);
  });
});
