import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExecutionConfirmDialog } from "@/thinking-lab/section/ExecutionConfirmDialog";
import type { ExecutionConfirmQuestion } from "@/thinking-lab/execution/confirm";

vi.mock("@/shared/i18n/useAppTranslation", () => ({
  useAppTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

const questions: ExecutionConfirmQuestion[] = [
  {
    id: "q1",
    category: "Viewpoint",
    prompt: "Siapa yang menceritakan kisah ini?",
    options: ["Anggota tim manajemen", "Spesialis riset pasar"],
    binds: "viewpoint",
  },
  {
    id: "q2",
    category: "Specific Decision",
    prompt: "Keputusan strategis spesifik apa yang tertunda?",
    options: ["Memilih negara baru", "Menentukan target demografi"],
    binds: "story",
  },
];

describe("ExecutionConfirmDialog", () => {
  it("sends a typed answer from the last option of each question", () => {
    const onConfirm = vi.fn();
    render(
      <ExecutionConfirmDialog
        open
        loading={false}
        failed={false}
        questions={questions}
        onOpenChange={vi.fn()}
        onRetry={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    const write = screen.getByRole("button", { name: "Write the script" });
    expect((write as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "Anggota tim manajemen" }));
    fireEvent.click(screen.getAllByRole("radio", { name: "Write your own" })[1]);
    expect((write as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: "Write your own Keputusan strategis spesifik apa yang tertunda?" }), {
      target: { value: "Menunda peluncuran di kota yang sama" },
    });
    expect((write as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(write);
    expect(onConfirm).toHaveBeenCalledWith([
      { question: "Siapa yang menceritakan kisah ini?", answer: "Anggota tim manajemen" },
      { question: "Keputusan strategis spesifik apa yang tertunda?", answer: "Menunda peluncuran di kota yang sama" },
    ]);
    expect(screen.queryByRole("button", { name: "Follow the pillar script" })).toBeNull();
  });

  it("asks the execution dialog to follow the pillar or sharpen before any question", () => {
    const onChooseMode = vi.fn();
    render(
      <ExecutionConfirmDialog
        open
        loading={false}
        failed={false}
        questions={null}
        choosingMode
        onChooseMode={onChooseMode}
        onOpenChange={vi.fn()}
        onRetry={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Write the script" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Follow the pillar script" }));
    fireEvent.click(screen.getByRole("button", { name: "Sharpen with discovery questions" }));
    expect(onChooseMode).toHaveBeenNthCalledWith(1, "follow");
    expect(onChooseMode).toHaveBeenNthCalledWith(2, "sharpen");
  });
});
