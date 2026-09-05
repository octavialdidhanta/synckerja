export type PosLibrarySetupAction =
  | "create_item"
  | "create_discount"
  | "manage_categories";

type Props = {
  onAction: (action: PosLibrarySetupAction) => void;
  createItemLabel: string;
  createDiscountLabel: string;
  manageCategoriesLabel: string;
};

/**
 * Inline Library setup section (pencil mode) — not a floating popup.
 * Renders as the first block in the Library list scroll.
 */
export function PosLibrarySetupMenu({
  onAction,
  createItemLabel,
  createDiscountLabel,
  manageCategoriesLabel,
}: Props) {
  const rows: Array<{ id: PosLibrarySetupAction; label: string }> = [
    { id: "create_item", label: createItemLabel },
    { id: "create_discount", label: createDiscountLabel },
    { id: "manage_categories", label: manageCategoriesLabel },
  ];

  return (
    <section
      aria-label="Library setup"
      className="border-b border-slate-200 bg-primary"
    >
      {rows.map((row, index) => (
        <button
          key={row.id}
          type="button"
          className={
            index < rows.length - 1
              ? "flex w-full items-center justify-center border-b border-white/20 px-4 py-3.5 text-center text-[13px] font-bold uppercase tracking-wide text-white transition-colors active:bg-white/10"
              : "flex w-full items-center justify-center px-4 py-3.5 text-center text-[13px] font-bold uppercase tracking-wide text-white transition-colors active:bg-white/10"
          }
          onClick={() => onAction(row.id)}
        >
          {row.label}
        </button>
      ))}
    </section>
  );
}
