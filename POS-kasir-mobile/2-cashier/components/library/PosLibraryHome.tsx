import { useRef, useState } from "react";
import { Pencil, Search } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_CASHIER_I18N } from "../../lib/posCashierCopy";
import { filterPosLibrarySections } from "../../lib/buildPosLibrarySections";
import type { PosLibrarySection } from "../../lib/posLibrarySections";
import { PosLibrarySectionRow } from "./PosLibrarySectionRow";
import {
  PosLibrarySetupMenu,
  type PosLibrarySetupAction,
} from "./setup/PosLibrarySetupMenu";

const LONG_PRESS_MS = 500;

type Props = {
  sections: PosLibrarySection[];
  query: string;
  onQueryChange: (q: string) => void;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  setupMenuOpen: boolean;
  onSetupMenuOpenChange: (open: boolean) => void;
  canSetup?: boolean;
  onSetupAction: (action: PosLibrarySetupAction) => void;
  onOpenSection: (section: PosLibrarySection) => void;
  onReorderCategories: (orderedCategoryIds: string[]) => void;
};

/**
 * Library home: pencil toggles inline setup section; long-press a category to reorder.
 */
export function PosLibraryHome({
  sections,
  query,
  onQueryChange,
  editing,
  onEditingChange,
  setupMenuOpen,
  onSetupMenuOpenChange,
  canSetup = true,
  onSetupAction,
  onOpenSection,
  onReorderCategories,
}: Props) {
  const { t } = useAppTranslation();
  const visible = filterPosLibrarySections(sections, query, t);

  const dragFromId = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  const categoryIds = sections
    .filter((s): s is PosLibrarySection & { kind: "category" } => s.kind === "category")
    .map((s) => s.id);

  const clearLongPress = () => {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

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
    <div className="relative flex h-full min-h-0 flex-col bg-white">
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
        ) : canSetup ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={
              setupMenuOpen
                ? "absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2 text-primary"
                : "absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2 text-slate-500"
            }
            aria-label={t(POS_CASHIER_I18N.libraryEdit, "Edit")}
            aria-expanded={setupMenuOpen}
            onClick={() => onSetupMenuOpenChange(!setupMenuOpen)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {setupMenuOpen && canSetup && !editing ? (
          <PosLibrarySetupMenu
            onAction={(action) => {
              onSetupAction(action);
              onSetupMenuOpenChange(false);
            }}
            createItemLabel={t(POS_CASHIER_I18N.setupCreateItem, "Create Item")}
            createDiscountLabel={t(POS_CASHIER_I18N.setupCreateDiscount, "Create Discount")}
            manageCategoriesLabel={t(
              POS_CASHIER_I18N.setupManageCategories,
              "Manage Categories",
            )}
          />
        ) : null}

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
              onOpen={() => {
                if (longPressFired.current) {
                  longPressFired.current = false;
                  return;
                }
                onOpenSection(section);
              }}
              onPointerDown={(e) => {
                if (editing && section.kind === "category") {
                  dragFromId.current = section.id;
                  setDraggingId(section.id);
                  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                  return;
                }
                if (!editing && section.kind === "category") {
                  longPressFired.current = false;
                  clearLongPress();
                  longPressTimer.current = window.setTimeout(() => {
                    longPressFired.current = true;
                    onSetupMenuOpenChange(false);
                    onEditingChange(true);
                  }, LONG_PRESS_MS);
                }
              }}
              onPointerMove={(e) => {
                if (!editing || !dragFromId.current) return;
                const el = document.elementFromPoint(e.clientX, e.clientY);
                const row = el?.closest("[data-lib-section-id]") as HTMLElement | null;
                const overId = row?.dataset.libSectionId ?? null;
                if (overId && categoryIds.includes(overId)) setDragOverId(overId);
              }}
              onPointerUp={(e) => {
                clearLongPress();
                if (editing && dragFromId.current) {
                  const el = document.elementFromPoint(e.clientX, e.clientY);
                  const row = el?.closest("[data-lib-section-id]") as HTMLElement | null;
                  const toId = row?.dataset.libSectionId;
                  if (toId && categoryIds.includes(toId)) {
                    moveCategory(dragFromId.current, toId);
                  }
                  dragFromId.current = null;
                  setDraggingId(null);
                  setDragOverId(null);
                }
              }}
              onPointerCancel={() => {
                clearLongPress();
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
