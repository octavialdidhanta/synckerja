import { useState } from "react";
import { MoreVertical } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { LabMasterThought } from "@/thinking-lab/master-thought/types";
import {
  catalogContext,
  sameCatalogLink,
  type LabCatalog,
  type MasterCatalogLink,
} from "@/thinking-lab/master-thought/catalog";
import { MasterCatalogPicker } from "@/thinking-lab/section/MasterCatalogPicker";

type Props = {
  masters: LabMasterThought[];
  catalogs: LabCatalog[];
  catalogPending: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onSaveCatalog: (id: string, catalog: MasterCatalogLink) => void;
};

function savedTitle(row: LabMasterThought): string {
  return (row.statement || row.originalInput || row.priorBelief || "").trim();
}

function savedDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

const HEAD = "sticky top-0 z-10 bg-card px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground";
const CELL = "px-3 py-3 align-top";

function CatalogDialog({
  row,
  catalogs,
  pending,
  onClose,
  onSave,
}: {
  row: LabMasterThought;
  catalogs: LabCatalog[];
  pending: boolean;
  onClose: () => void;
  onSave: (catalog: MasterCatalogLink) => void;
}) {
  const { t } = useAppTranslation();
  const [draft, setDraft] = useState(row.catalog);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("thinkingLab.catalog.editTitle", "Edit kategori")}</DialogTitle>
        </DialogHeader>
        <p className="line-clamp-2 text-sm text-muted-foreground">{savedTitle(row)}</p>
        <MasterCatalogPicker value={draft} catalogs={catalogs} disabled={pending} onChange={setDraft} />
        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" disabled={pending} onClick={onClose}>
            {t("thinkingLab.catalog.cancel", "Batal")}
          </Button>
          <Button
            type="button"
            disabled={pending || !draft.serviceId || sameCatalogLink(draft, row.catalog)}
            onClick={() => onSave(draft)}
          >
            {t("thinkingLab.catalog.save", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SavedMasterThoughtList({ masters, catalogs, catalogPending, onOpen, onDelete, onSaveCatalog }: Props) {
  const { t, dateLocale } = useAppTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = masters.find((row) => row.id === editingId) ?? null;

  const catalogSummary = (row: LabMasterThought) => {
    const context = catalogContext(row.catalog, catalogs);
    if (context) return { category: context.category, extra: [...context.subCategories, ...context.features].join(" · ") };
    return {
      category: row.catalog.serviceId
        ? t("thinkingLab.catalog.saved", "Katalog tersimpan")
        : t("thinkingLab.catalog.none", "Belum ada katalog"),
      extra: "",
    };
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <h2 className="shrink-0 text-sm font-semibold text-foreground">
        {t("thinkingLab.saved.title", "Saved Master Thoughts")}
      </h2>
      <div className="scrollbar-hide nested-scroll-touch-chain min-h-0 flex-1 overflow-auto rounded-md border border-border [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className={`${HEAD} w-[22%]`}>{t("thinkingLab.catalog.label", "Kategori")}</th>
              <th className={HEAD}>{t("thinkingLab.saved.newBelief", "New belief")}</th>
              <th className={HEAD}>{t("thinkingLab.master.shiftFrom", "Old belief to shift")}</th>
              <th className={`${HEAD} w-28`}>{t("thinkingLab.saved.updatedColumn", "Updated")}</th>
              <th className={`${HEAD} w-14 text-center`}>{t("thinkingLab.saved.action", "Action")}</th>
            </tr>
          </thead>
          <tbody>
            {masters.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  {t("thinkingLab.saved.empty", "Belum ada Master Thought. Buat yang pertama di form sebelah kanan.")}
                </td>
              </tr>
            ) : null}
            {masters.map((row) => {
              const summary = catalogSummary(row);
              return (
                <tr key={row.id} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                  <td className={CELL}>
                    <span className="block break-words leading-snug text-foreground">{summary.category}</span>
                    {summary.extra ? (
                      <span className="mt-0.5 block break-words text-xs text-muted-foreground">{summary.extra}</span>
                    ) : null}
                  </td>
                  <td className={CELL}>
                    <button
                      type="button"
                      className="break-words text-left font-medium leading-snug text-foreground hover:underline"
                      onClick={() => onOpen(row.id)}
                    >
                      {savedTitle(row)}
                    </button>
                  </td>
                  <td className={`${CELL} break-words leading-snug text-foreground`}>{row.priorBelief || "—"}</td>
                  <td className={`${CELL} whitespace-nowrap text-xs text-muted-foreground`}>
                    {savedDate(row.updatedAt, dateLocale)}
                  </td>
                  <td className={`${CELL} text-center`}>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          aria-label={t("thinkingLab.action.more", "More actions")}
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[9rem]">
                        <DropdownMenuItem className="cursor-pointer" onSelect={() => onOpen(row.id)}>
                          {t("thinkingLab.saved.open", "Open")}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer" onSelect={() => setEditingId(row.id)}>
                          {t("thinkingLab.catalog.editTitle", "Edit kategori")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer text-destructive focus:text-destructive"
                          onSelect={() => onDelete(row.id)}
                        >
                          {t("thinkingLab.action.delete", "Delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editing ? (
        <CatalogDialog
          row={editing}
          catalogs={catalogs}
          pending={catalogPending}
          onClose={() => setEditingId(null)}
          onSave={(catalog) => {
            onSaveCatalog(editing.id, catalog);
            setEditingId(null);
          }}
        />
      ) : null}
    </div>
  );
}
