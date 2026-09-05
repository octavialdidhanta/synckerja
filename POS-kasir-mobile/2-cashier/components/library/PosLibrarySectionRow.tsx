import type { PointerEvent } from "react";
import { ChevronRight, GripVertical, Percent, Package, List } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { libraryCategoryInitial } from "../../lib/buildPosLibrarySections";
import type { PosLibrarySection, PosLibrarySystemSectionId } from "../../lib/posLibrarySections";

type Props = {
  section: PosLibrarySection;
  editing?: boolean;
  dragging?: boolean;
  dragOver?: boolean;
  onOpen: () => void;
  onPointerDown?: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove?: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp?: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel?: () => void;
};

function SystemIcon({ id }: { id: PosLibrarySystemSectionId }) {
  if (id === "discount") return <Percent className="h-5 w-5 text-white" strokeWidth={2} />;
  if (id === "all_bundles") return <Package className="h-5 w-5 text-white" strokeWidth={2} />;
  return <List className="h-5 w-5 text-white" strokeWidth={2} />;
}

export function PosLibrarySectionRow({
  section,
  editing,
  dragging,
  dragOver,
  onOpen,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: Props) {
  const { t } = useAppTranslation();
  const label =
    section.kind === "system"
      ? t(section.labelKey, section.fallbackLabel)
      : section.name;
  const isCategory = section.kind === "category";
  const canDrag = Boolean(editing && isCategory);
  const bindPointers = Boolean(onPointerDown || onPointerMove || onPointerUp || onPointerCancel);

  return (
    <button
      type="button"
      data-lib-section-id={section.id}
      onClick={() => {
        if (editing && isCategory) return;
        onOpen();
      }}
      onPointerDown={bindPointers ? onPointerDown : undefined}
      onPointerMove={bindPointers ? onPointerMove : undefined}
      onPointerUp={bindPointers ? onPointerUp : undefined}
      onPointerCancel={bindPointers ? onPointerCancel : undefined}
      className={cn(
        "flex w-full items-center gap-3 border-b border-slate-100 bg-white px-4 py-3 text-left transition-colors",
        !editing && "hover:bg-slate-50 active:bg-slate-100",
        dragging && "opacity-60",
        dragOver && "bg-sky-50",
      )}
    >
      {canDrag ? (
        <GripVertical className="h-4 w-4 flex-shrink-0 text-slate-300" aria-hidden />
      ) : null}
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-sky-300">
        {section.kind === "system" ? (
          <SystemIcon id={section.id} />
        ) : (
          <span className="text-base font-bold text-white">
            {libraryCategoryInitial(section.name)}
          </span>
        )}
      </div>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{label}</span>
      {!editing || !isCategory ? (
        <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-300" aria-hidden />
      ) : null}
    </button>
  );
}
