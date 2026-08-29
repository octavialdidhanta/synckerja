import { useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { Search } from "lucide-react";
import { POS_CASHIER_I18N } from "../../lib/posCashierCopy";
import {
  filterPosLibrarySections,
} from "../../lib/buildPosLibrarySections";
import type { PosLibrarySection } from "../../lib/posLibrarySections";
import { PosLibrarySectionRow } from "./PosLibrarySectionRow";

type Props = {
  sections: PosLibrarySection[];
  query: string;
  onQueryChange: (q: string) => void;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onOpenSection: (section: PosLibrarySection) => void;
  onReorderCategories: (orderedCategoryIds: string[]) => void;
};

export function PosLibraryHome({
  sections,
  query,
  onQueryChange,
  editing,
  onEditingChange,
  onOpenSection,
  onReorderCategories,
}: Props) {
  const { t } = useAppTranslation();
  const visible = filterPosLibrarySections(sections, query, t);

  const dragFromId = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const categoryIds = sections
    .filter((s): s is PosLibrarySection & { kind: "category" } => s.kind === "category")
    .map((s) => s.id);

  const moveCategory = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const from = categoryIds.indexOf(fromId);
    const to = categoryIds.indexOf(toId);
    if (from < 0 || to < 0) return;
    const next = [...categoryIds];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    onReorderCategories(next);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="relative flex-shrink-0 border-b border-slate-100 px-3 py-2">
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t(POS_CASHIER_I18N.librarySearch, "Search")}
          className="h-10 pr-9"
          disabled={editing}
        />
        <Search className="pointer-events-none absolute right-5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>

      <div className="relative flex flex-shrink-0 items-center justify-center border-b border-slate-100 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-900">
          {t(POS_CASHIER_I18N.libraryTitle, "Library")}
        </h2>
        {editing ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2 font-semibold text-primary"
            onClick={() => onEditingChange(false)}
          >
            {t(POS_CASHIER_I18N.libraryDone, "Done")}
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2 text-slate-500"
            aria-label={t(POS_CASHIER_I18N.libraryEdit, "Edit")}
            onClick={() => onEditingChange(true)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            {t(POS_CASHIER_I18N.libraryEmptySections, "No matching sections.")}
          </p>
        ) : (
          visible.map((section) => (
            <PosLibrarySectionRow
              key={section.id}
              section={section}
              editing={editing}
              dragging={draggingId === section.id}
              dragOver={dragOverId === section.id}
              onOpen={() => onOpenSection(section)}
              onPointerDown={(e) => {
                if (!editing || section.kind !== "category") return;
                dragFromId.current = section.id;
                setDraggingId(section.id);
                (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!editing || !dragFromId.current) return;
                const el = document.elementFromPoint(e.clientX, e.clientY);
                const row = el?.closest("[data-lib-section-id]") as HTMLElement | null;
                const overId = row?.dataset.libSectionId ?? null;
                if (overId && categoryIds.includes(overId)) setDragOverId(overId);
              }}
              onPointerUp={(e) => {
                if (!editing || !dragFromId.current) return;
                const el = document.elementFromPoint(e.clientX, e.clientY);
                const row = el?.closest("[data-lib-section-id]") as HTMLElement | null;
                const toId = row?.dataset.libSectionId;
                if (toId && categoryIds.includes(toId)) {
                  moveCategory(dragFromId.current, toId);
                }
                dragFromId.current = null;
                setDraggingId(null);
                setDragOverId(null);
              }}
              onPointerCancel={() => {
                dragFromId.current = null;
                setDraggingId(null);
                setDragOverId(null);
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
