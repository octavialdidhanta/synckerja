import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MasterThoughtSection } from "@/thinking-lab/section/MasterThoughtSection";
import type { MasterThoughtFacts } from "@/thinking-lab/master-thought/types";

vi.mock("@/shared/i18n/useAppTranslation", () => ({
  useAppTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

const readyFacts: MasterThoughtFacts = {
  outcome: "ORIGINAL_READY",
  subject: "bisnis yang tidak memakai sistem akan membuang lebih banyak sumber daya",
  proposedRootBelief: null,
  formulationNote: null,
  clarificationQuestion: null,
  clarificationOptions: null,
  resolution: "RESOLVED",
  unresolvedReasons: [],
};

describe("MasterThoughtSection result", () => {
  it("shows a short confirmation instead of raw status codes", () => {
    render(
      <MasterThoughtSection
        locked={false}
        busy={false}
        priorDraft="Ngga perlu pakai system, karena system mahal"
        originalDraft="Meskipun sistem dianggap mahal, bisnis yang tidak memakainya justru akan membuang lebih banyak sumber daya penting."
        audienceDraft="Bisnis Owner"
        proposalDraft=""
        facts={readyFacts}
        admission="USABLE"
        confirmedStatement={null}
        onPriorChange={vi.fn()}
        onOriginalChange={vi.fn()}
        onAudienceChange={vi.fn()}
        onProposalChange={vi.fn()}
        onUnderstand={vi.fn()}
        judgmentCurrent
        onKeepOriginal={vi.fn()}
        onUseSubject={vi.fn()}
        onUseBelief={vi.fn()}
        onPickBelief={vi.fn()}
        onOpenChoices={vi.fn(async () => ({ subjects: [], beliefs: [] }))}
        onConfirmOriginal={vi.fn()}
        onConfirmProposal={vi.fn()}
        onConfirmEdit={vi.fn()}
      />,
    );
    expect(screen.queryByText("ORIGINAL_READY")).toBeNull();
    expect(screen.queryByText("USABLE")).toBeNull();
    expect(screen.getByText("Bisnis yang tidak memakai sistem akan membuang lebih banyak sumber daya")).toBeTruthy();
    expect(screen.getByText("This belief is ready to confirm.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirm original" })).toBeTruthy();
  });

  it("keeps the original new belief selectable and leaves it unchanged when a subject is chosen", async () => {
    const onKeepOriginal = vi.fn();
    const onUseSubject = vi.fn();
    const onUseBelief = vi.fn();
    const onOriginalChange = vi.fn();
    const unresolved: MasterThoughtFacts = {
      outcome: "UNRESOLVED",
      subject: null,
      proposedRootBelief: null,
      formulationNote: null,
      clarificationQuestion: null,
      clarificationOptions: null,
      resolution: "UNRESOLVED",
      unresolvedReasons: ["SUBJECT_IS_FRAGMENT"],
    };
    render(
      <MasterThoughtSection
        locked={false}
        busy={false}
        priorDraft="Bawa bekel ke kantor jauh lebih hemat"
        originalDraft="Ternyata makan di luar lebih hemat dan menawarkan lauk yang lebih variatif"
        audienceDraft=""
        proposalDraft=""
        facts={unresolved}
        admission="UNRESOLVED"
        confirmedStatement={null}
        onPriorChange={vi.fn()}
        onOriginalChange={onOriginalChange}
        onAudienceChange={vi.fn()}
        onProposalChange={vi.fn()}
        onUnderstand={vi.fn()}
        judgmentCurrent
        onKeepOriginal={onKeepOriginal}
        onUseSubject={onUseSubject}
        onUseBelief={onUseBelief}
        onPickBelief={vi.fn()}
        onOpenChoices={vi.fn(async () => ({
          subjects: ["Makan di luar tetap lebih hemat dan variatif"],
          beliefs: ["Makan di luar lebih hemat dan menyajikan lauk yang lebih variatif"],
        }))}
        onConfirmOriginal={vi.fn()}
        onConfirmProposal={vi.fn()}
        onConfirmEdit={vi.fn()}
      />,
    );
    expect(
      await screen.findByRole("button", {
        name: "Ternyata makan di luar lebih hemat dan menawarkan lauk yang lebih variatif",
      }),
    ).toBeTruthy();
    expect(screen.getByText("Original version")).toBeTruthy();
    expect(screen.getByText("Recommended new belief")).toBeTruthy();
    expect(screen.getByText("Choosing a subject leaves the new belief as written.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Makan di luar tetap lebih hemat dan variatif" }));
    expect(onUseSubject).toHaveBeenCalledWith("Makan di luar tetap lebih hemat dan variatif", expect.any(String));
    expect(onOriginalChange).not.toHaveBeenCalled();
    expect(onUseBelief).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Makan di luar lebih hemat dan menyajikan lauk yang lebih variatif" }),
    );
    expect(onUseBelief).toHaveBeenCalledWith("Makan di luar lebih hemat dan menyajikan lauk yang lebih variatif");
    fireEvent.click(
      screen.getByRole("button", { name: "Ternyata makan di luar lebih hemat dan menawarkan lauk yang lebih variatif" }),
    );
    expect(onKeepOriginal).toHaveBeenCalledOnce();
    expect(onOriginalChange).not.toHaveBeenCalled();
  });

  it("shows only the beliefs that passed and leaves the subject until one is picked", () => {
    const onPickBelief = vi.fn();
    const choosing: MasterThoughtFacts = {
      outcome: "UNRESOLVED",
      subject: null,
      proposedRootBelief: null,
      formulationNote: null,
      clarificationQuestion: null,
      clarificationOptions: null,
      resolution: "UNRESOLVED",
      unresolvedReasons: ["CHOOSE_BELIEF"],
      beliefOptions: [
        {
          belief: "Ternyata makan di luar lebih hemat dari bawa bekel setiap hari",
          description: "Keyakinan ini tetap pada perbandingan hemat antara makan di luar dan bawa bekel.",
        },
      ],
    };
    render(
      <MasterThoughtSection
        locked={false}
        busy={false}
        priorDraft="Bawa bekel ke kantor jauh lebih hemat"
        originalDraft="Makan di luar lebih hemat"
        audienceDraft=""
        proposalDraft=""
        facts={choosing}
        admission="UNRESOLVED"
        confirmedStatement={null}
        onPriorChange={vi.fn()}
        onOriginalChange={vi.fn()}
        onAudienceChange={vi.fn()}
        onProposalChange={vi.fn()}
        onUnderstand={vi.fn()}
        judgmentCurrent
        onKeepOriginal={vi.fn()}
        onUseSubject={vi.fn()}
        onUseBelief={vi.fn()}
        onPickBelief={onPickBelief}
        onOpenChoices={vi.fn(async () => ({ subjects: [], beliefs: [] }))}
        onConfirmOriginal={vi.fn()}
        onConfirmProposal={vi.fn()}
        onConfirmEdit={vi.fn()}
      />,
    );
    expect(screen.getByText("Pick one belief")).toBeTruthy();
    expect(screen.getByText("Pick the original")).toBeTruthy();
    expect(screen.getByText("Keyakinan ini tetap pada perbandingan hemat antara makan di luar dan bawa bekel.")).toBeTruthy();
    expect(screen.queryByText("Makan di luar lebih hemat dan lauknya lebih variatif")).toBeNull();
    expect(screen.queryByText("Subject")).toBeNull();
    expect(screen.queryByText("Original version")).toBeNull();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Makan di luar lebih hemat" }));
    expect(onPickBelief).toHaveBeenCalledWith("Makan di luar lebih hemat");
    fireEvent.click(
      screen.getByRole("button", { name: /Ternyata makan di luar lebih hemat dari bawa bekel setiap hari/ }),
    );
    expect(onPickBelief).toHaveBeenCalledWith("Ternyata makan di luar lebih hemat dari bawa bekel setiap hari");
  });

  it("shows a loading line while belief options are being written", () => {
    render(
      <MasterThoughtSection
        locked={false}
        busy
        understanding
        priorDraft="Bawa bekel"
        originalDraft="Makan di luar lebih hemat"
        audienceDraft=""
        proposalDraft=""
        facts={null}
        admission={null}
        confirmedStatement={null}
        onPriorChange={vi.fn()}
        onOriginalChange={vi.fn()}
        onAudienceChange={vi.fn()}
        onProposalChange={vi.fn()}
        onUnderstand={vi.fn()}
        onKeepOriginal={vi.fn()}
        onUseSubject={vi.fn()}
        onUseBelief={vi.fn()}
        onPickBelief={vi.fn()}
        onOpenChoices={vi.fn(async () => ({ subjects: [], beliefs: [] }))}
        onConfirmOriginal={vi.fn()}
        onConfirmProposal={vi.fn()}
        onConfirmEdit={vi.fn()}
      />,
    );
    expect(screen.getByText("Writing belief options...")).toBeTruthy();
  });
});
