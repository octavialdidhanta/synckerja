import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, History, Loader2, MessageSquare, Pencil, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { useCatalogIngredients } from "../../library/hooks/useCatalogIngredients";
import { stockForOutlet } from "../../library/types";
import { AddRecipeIngredientDialog } from "../../product-recipes/components/AddRecipeIngredientDialog";
import { useRecipeDraftActions, useRecipeDraftReview } from "../hooks/useRecipeDrafts";
import {
  computeRecipeDraftEdit,
  editLinesFromReview,
  newEditLine,
  type RecipeDraftEditLine,
} from "../lib/recipeDraftEdit";
import { deltaDirection, percent, rupiah } from "../lib/recipeDraftFormat";
import { draftErrorMessage } from "../lib/recipeDraftMessages";
import type { RecipeDraftNotice, RecipeDraftReview } from "../types";
import { RecipeDraftLines, type RecipeDraftViewRow } from "./RecipeDraftLines";
import { RecipeDraftNoticeList } from "./RecipeDraftParts";

export type RecipeDraftReviewDialogProps = {
  draftId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function SummaryCard({
  label,
  before,
  after,
  note,
  noteTone,
}: {
  label: string;
  before: string | null;
  after: string;
  note: ReactNode;
  noteTone?: "up" | "down" | "flat";
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3 sm:p-4">
      <p className="text-xs font-medium text-gray-600">{label}</p>
      <p className="text-xs text-gray-600">{before ? <span className="line-through">{before}</span> : " "}</p>
      <p className="text-lg font-bold text-gray-900 sm:text-[22px]">{after}</p>
      <p
        className={cn(
          "inline-flex items-center gap-1 text-xs",
          noteTone === "up" && "font-semibold text-orange-700",
          noteTone === "down" && "font-semibold text-blue-700",
          (!noteTone || noteTone === "flat") && "text-gray-600",
        )}
      >
        {note}
      </p>
    </div>
  );
}

function reviewRows(review: RecipeDraftReview): RecipeDraftViewRow[] {
  return review.rows.map((row) => ({
    id: row.ingredient_id,
    name: row.name,
    unitCode: row.unit_code ?? "",
    beforeQty: row.before_qty,
    afterQty: row.after_qty,
    beforeCost: Number(row.before_cost) || 0,
    afterCost: Number(row.after_cost) || 0,
    deltaCost: Number(row.delta_cost) || 0,
    change: row.change,
    hasCost: row.has_cost,
    deleted: row.deleted,
    unusual: row.unusual,
  }));
}

export function RecipeDraftReviewDialog({ draftId, open, onOpenChange }: RecipeDraftReviewDialogProps) {
  const { t, dateLocale } = useAppTranslation();
  const { toast } = useToast();
  const { data: review, isLoading, error } = useRecipeDraftReview(open ? draftId : null);
  const actions = useRecipeDraftActions(draftId);
  const { rows: catalogIngredients } = useCatalogIngredients();

  const [mode, setMode] = useState<"read" | "edit">("read");
  const [editLines, setEditLines] = useState<RecipeDraftEditLine[]>([]);
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setMode("read");
    setOnlyChanged(false);
    setConfirmed(false);
    setRejectNote("");
  }, [open, draftId]);

  const computed = useMemo(
    () =>
      review && mode === "edit"
        ? computeRecipeDraftEdit({
            lines: editLines,
            sellingPrice: Number(review.selling_price) || 0,
            hasLiveRecipe: review.has_live_recipe,
          })
        : null,
    [review, mode, editLines],
  );

  const pending = review?.draft.status === "pending";
  const canManage = !!review?.can_manage && pending;

  // In edit mode the client recomputes line-level notices; server-only checks (stale, closed) still apply.
  const serverOnlyBlocking: RecipeDraftNotice[] = (review?.blocking ?? []).filter(
    (n) => n.code === "stale" || n.code === "not_pending",
  );
  const blocking = computed ? [...serverOnlyBlocking, ...computed.blocking] : review?.blocking ?? [];
  const warnings = computed ? computed.warnings : review?.warnings ?? [];
  const errorCount = computed?.errorCount ?? 0;
  const needsConfirm = warnings.length > 0 && blocking.length === 0;

  const dirty = useMemo(() => {
    if (!computed || !review) return false;
    const saved = review.rows
      .filter((r) => r.after_qty != null)
      .map((r) => `${r.ingredient_id}:${Number(r.after_qty)}`)
      .join("|");
    const next = computed.payload.map((p) => `${p.ingredient_id}:${p.quantity}`).join("|");
    return saved !== next || computed.errorCount > 0;
  }, [computed, review]);

  const rows: RecipeDraftViewRow[] = computed
    ? computed.lines.map((line) => ({
        id: line.ingredientId,
        name: line.name,
        unitCode: line.unitCode,
        beforeQty: line.beforeQty,
        afterQty: line.removed ? null : line.qty,
        beforeCost: line.beforeCost,
        afterCost: line.afterCost,
        deltaCost: line.deltaCost,
        change: line.change,
        hasCost: line.hasCost,
        deleted: line.deleted,
        unusual: line.unusual,
        input: line.input,
        inputUnit: line.inputUnit,
        unitOptions: line.unitOptions,
        error: line.error,
      }))
    : review
      ? reviewRows(review)
      : [];

  const totals = computed
    ? { before: computed.totals.hppBefore, after: computed.totals.hppAfter, delta: computed.totals.delta }
    : review
      ? { before: review.totals.hpp_before, after: Number(review.totals.hpp_after) || 0, delta: review.totals.delta }
      : { before: null, after: 0, delta: null };

  const price = Number(review?.selling_price) || 0;
  const marginAfter = price - totals.after;
  const marginPctAfter = price > 0 ? (marginAfter / price) * 100 : null;
  const marginBefore = totals.before != null ? price - totals.before : null;
  const marginPctBefore = totals.before != null && price > 0 ? ((price - totals.before) / price) * 100 : null;
  const hppPctChange = totals.before && totals.delta != null ? (totals.delta / totals.before) * 100 : null;
  const hppDirection = deltaDirection(totals.delta);
  const marginPointDelta =
    marginPctBefore != null && marginPctAfter != null ? marginPctAfter - marginPctBefore : null;

  const updateLine = (id: string, patch: Partial<RecipeDraftEditLine>) => {
    setConfirmed(false);
    setEditLines((lines) => lines.map((line) => (line.ingredientId === id ? { ...line, ...patch } : line)));
  };

  const toggleRemove = (id: string) => {
    setConfirmed(false);
    setEditLines((lines) =>
      lines.flatMap((line) => {
        if (line.ingredientId !== id) return [line];
        // A line added during this edit simply disappears; an existing one is marked removed.
        if (line.beforeQty == null && !line.removed && !review?.rows.some((r) => r.ingredient_id === id)) return [];
        return [{ ...line, removed: !line.removed }];
      }),
    );
  };

  const startEdit = () => {
    if (!review) return;
    setEditLines(editLinesFromReview(review));
    setConfirmed(false);
    setMode("edit");
  };

  const fail = (err: unknown) =>
    toast({ title: draftErrorMessage(t, err), variant: "destructive" });

  const handleSave = async () => {
    if (!computed) return;
    try {
      await actions.save(computed.payload);
      setMode("read");
      setConfirmed(false);
      toast({ title: t("recipeDrafts.saved", "Draft saved. It is still not active in POS.") });
    } catch (err) {
      fail(err);
    }
  };

  const handlePublish = async () => {
    try {
      await actions.publish(needsConfirm && confirmed);
      toast({
        title: t("recipeDrafts.published", "Recipe published. It applies to the next sales at {{outlet}}.", {
          outlet: review?.draft.outlet_name ?? "",
        }),
      });
      onOpenChange(false);
    } catch (err) {
      fail(err);
    }
  };

  const handleReject = async () => {
    try {
      await actions.reject(rejectNote.trim() ? rejectNote.trim() : null);
      setRejectOpen(false);
      toast({ title: t("recipeDrafts.rejected", "Draft rejected. The active recipe did not change.") });
      onOpenChange(false);
    } catch (err) {
      fail(err);
    }
  };

  // Publishing only happens from read mode, after edits are saved or cancelled, so what is
  // published is exactly what the reviewer last saw in the comparison.
  const publishDisabled =
    mode === "edit" ||
    actions.isBusy ||
    !review?.can_manage ||
    !pending ||
    blocking.length > 0 ||
    errorCount > 0 ||
    (needsConfirm && !confirmed);
  const saveDisabled = actions.isBusy || errorCount > 0 || !computed || computed.payload.length === 0 || !dirty;

  const formattedDate = (iso: string | null | undefined) =>
    iso
      ? new Date(iso).toLocaleString(dateLocale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : "";

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !actions.isBusy && onOpenChange(next)}>
        <DialogContent
          hideCloseButton
          className={cn(
            "flex max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden p-0",
            "h-[100dvh] rounded-none sm:h-auto sm:max-h-[92vh] sm:w-[calc(100vw-3rem)] sm:max-w-[1100px] sm:rounded-xl",
          )}
        >
          {isLoading || !review ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-sm text-gray-600">
              {error ? (
                <>
                  <DialogTitle className="text-base">{t("recipeDrafts.loadFailed", "Could not load the draft.")}</DialogTitle>
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    {t("common.close", "Close")}
                  </Button>
                </>
              ) : (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  <DialogTitle className="sr-only">{t("recipeDrafts.loading", "Loading draft")}</DialogTitle>
                  {t("recipeDrafts.loading", "Loading draft")}
                </>
              )}
            </div>
          ) : (
            <>
              <header className="flex shrink-0 flex-col gap-3 border-b px-4 py-4 sm:px-7 sm:py-5">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#1d6fa5]">
                      {mode === "edit"
                        ? t("recipeDrafts.editTitle", "Edit recipe draft")
                        : t("recipeDrafts.reviewTitle", "Review recipe draft")}
                    </p>
                    <DialogTitle className="mt-1 text-lg font-bold text-gray-900 sm:text-[22px]">
                      {review.draft.product_name}
                    </DialogTitle>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {review.draft.category ? (
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                          {review.draft.category}
                        </span>
                      ) : null}
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                        {t("recipeDrafts.outletChip", "Outlet: {{name}}", { name: review.draft.outlet_name ?? "—" })}
                      </span>
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                        {review.draft.draft_type === "new"
                          ? t("recipeDrafts.type.new", "New recipe")
                          : t("recipeDrafts.type.update", "Recipe change")}
                      </span>
                      {mode === "edit" ? (
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                            dirty ? "bg-amber-50 text-amber-800" : "bg-green-50 text-green-800",
                          )}
                        >
                          {dirty
                            ? t("recipeDrafts.unsaved", "Unsaved changes")
                            : t("recipeDrafts.noChanges", "No changes yet")}
                        </span>
                      ) : review.draft.edited ? (
                        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
                          {t("recipeDrafts.editedBy", "Edited by {{name}} · {{time}}", {
                            name: review.draft.edited_by_name ?? "—",
                            time: formattedDate(review.draft.edited_at),
                          })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => onOpenChange(false)}
                    disabled={actions.isBusy}
                    aria-label={t("common.close", "Close")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {review.draft.request_note ? (
                  <div className="flex gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3.5 py-3">
                    <MessageSquare className="mt-0.5 h-[18px] w-[18px] shrink-0 text-gray-600" aria-hidden />
                    <div className="min-w-0">
                      <DialogDescription className="text-sm text-gray-900">“{review.draft.request_note}”</DialogDescription>
                      <p className="mt-0.5 text-xs text-gray-600">
                        {t("recipeDrafts.requestedBy", "Prepared by Claude from {{name}}'s request · {{time}}", {
                          name: review.draft.requested_by_name ?? "—",
                          time: formattedDate(review.draft.created_at),
                        })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <DialogDescription className="sr-only">
                    {t("recipeDrafts.reviewTitle", "Review recipe draft")}
                  </DialogDescription>
                )}
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="flex flex-col gap-4 px-4 py-4 sm:px-7 sm:py-5">
                  <section
                    aria-label={t("recipeDrafts.summary", "Summary")}
                    className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3"
                  >
                    <SummaryCard
                      label={t("recipeDrafts.hppPerPortion", "HPP per portion")}
                      before={totals.before != null ? rupiah(totals.before) : null}
                      after={rupiah(totals.after)}
                      noteTone={hppDirection}
                      note={
                        totals.delta == null ? (
                          t("recipeDrafts.firstRecipe", "First recipe for this menu")
                        ) : hppDirection === "flat" ? (
                          t("recipeDrafts.unchanged", "Unchanged")
                        ) : (
                          <>
                            {hppDirection === "up" ? <ArrowUp className="h-3.5 w-3.5" aria-hidden /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden />}
                            {hppDirection === "up" ? t("recipeDrafts.up", "Up") : t("recipeDrafts.down", "Down")}{" "}
                            {rupiah(totals.delta)}
                            {hppPctChange != null ? ` (${hppDirection === "up" ? "+" : "−"}${percent(Math.abs(hppPctChange))})` : ""}
                          </>
                        )
                      }
                    />
                    <SummaryCard
                      label={t("recipeDrafts.margin", "Margin")}
                      before={marginBefore != null ? `${rupiah(marginBefore)} · ${percent(marginPctBefore)}` : null}
                      after={`${rupiah(marginAfter)} · ${percent(marginPctAfter)}`}
                      noteTone={marginPointDelta == null ? "flat" : marginPointDelta > 0.05 ? "down" : marginPointDelta < -0.05 ? "up" : "flat"}
                      note={
                        marginPointDelta == null || Math.abs(marginPointDelta) < 0.05
                          ? t("recipeDrafts.hppShare", "HPP {{pct}} of the price", {
                              pct: percent(price > 0 ? (totals.after / price) * 100 : null),
                            })
                          : t("recipeDrafts.marginPoints", "{{dir}} {{points}} points", {
                              dir: marginPointDelta > 0 ? t("recipeDrafts.up", "Up") : t("recipeDrafts.down", "Down"),
                              points: Math.abs(marginPointDelta).toLocaleString("id-ID", { maximumFractionDigits: 1 }),
                            })
                      }
                    />
                    <div className="col-span-2 sm:col-span-1">
                      <SummaryCard
                        label={t("recipeDrafts.sellingPrice", "Selling price")}
                        before={null}
                        after={rupiah(price)}
                        note={t("recipeDrafts.priceNotEditable", "Changed on the Product page")}
                      />
                    </div>
                  </section>

                  {review.finished_goods_cost ? (
                    <p className="rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-3 text-sm text-blue-900">
                      {t(
                        "recipeDrafts.finishedGoodsNote",
                        "This menu uses its own buy cost in POS, so HPP in reports does not come from this recipe. The recipe still reduces ingredient stock.",
                      )}
                    </p>
                  ) : null}

                  <RecipeDraftNoticeList blocking={blocking} warnings={warnings} />

                  <section aria-labelledby="draft-lines-title" className="flex flex-col gap-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 id="draft-lines-title" className="text-[15px] font-semibold text-gray-900">
                        {t("recipeDrafts.linesTitle", "Ingredients per portion")}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                          <Checkbox checked={onlyChanged} onCheckedChange={(v) => setOnlyChanged(v === true)} />
                          {t("recipeDrafts.onlyChanged", "Show only changes")}
                        </label>
                        {mode === "read" && canManage ? (
                          <Button type="button" variant="outline" size="sm" onClick={startEdit}>
                            <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                            {t("recipeDrafts.edit", "Edit draft")}
                          </Button>
                        ) : null}
                        {mode === "edit" ? (
                          <Button type="button" variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                            <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                            {t("recipeDrafts.addIngredient", "Add ingredient")}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    {mode === "edit" ? (
                      <p className="text-sm text-gray-600">
                        {t(
                          "recipeDrafts.editHint",
                          "Change quantities in the After column. Choose g/kg or ml/l; it is converted to the unit in Library. Claude's original version is kept.",
                        )}
                      </p>
                    ) : null}
                    <RecipeDraftLines
                      mode={mode}
                      rows={rows}
                      onlyChanged={onlyChanged}
                      totals={totals}
                      onInput={(id, value) => updateLine(id, { input: value })}
                      onUnit={(id, unit) => updateLine(id, { inputUnit: unit })}
                      onToggleRemove={toggleRemove}
                    />
                    <p className="text-xs text-gray-600">
                      {t(
                        "recipeDrafts.unitNote",
                        "Quantities are stored in each ingredient's unit in Library (kg, l, pcs). Grams and ml are shown for easier reading.",
                      )}
                    </p>
                  </section>
                </div>
              </div>

              <footer className="shrink-0 border-t bg-white shadow-[0_-6px_16px_rgba(15,23,42,0.05)] sm:shadow-none">
                {canManage && needsConfirm ? (
                  <label className="flex cursor-pointer items-start gap-2.5 border-b border-orange-200 bg-orange-50 px-4 py-3 sm:px-7">
                    <Checkbox
                      checked={confirmed}
                      onCheckedChange={(v) => setConfirmed(v === true)}
                      className="mt-0.5 h-[18px] w-[18px] border-orange-700 data-[state=checked]:bg-orange-700"
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-orange-900">
                        {warnings.length === 1
                          ? t("recipeDrafts.confirmLabelOne", "I have checked the item under “To check”")
                          : t("recipeDrafts.confirmLabel", "I have checked the {{count}} items under “To check”", {
                              count: warnings.length,
                            })}
                      </span>
                      <span className="text-xs text-orange-800">
                        {t("recipeDrafts.confirmHint", "Required because this draft has warnings.")}
                      </span>
                    </span>
                  </label>
                ) : null}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-7 sm:py-4">
                  <p className="hidden min-w-[260px] flex-1 items-center gap-2 text-sm text-gray-600 sm:flex">
                    <History className="h-4 w-4 shrink-0" aria-hidden />
                    {!pending
                      ? t("recipeDrafts.closedNote", "This draft is closed. The active recipe is not affected.")
                      : mode === "edit"
                        ? t("recipeDrafts.editFooterNote", "Save or cancel your changes first. Publish is available after that.")
                        : t("recipeDrafts.historyNote", "The old recipe is kept in history. Applies to the next sales at {{outlet}}.", {
                            outlet: review.draft.outlet_name ?? "",
                          })}
                  </p>
                  {canManage ? (
                    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                      {mode === "edit" ? (
                        <>
                          <Button type="button" variant="ghost" className="h-11" onClick={() => setMode("read")} disabled={actions.isBusy}>
                            {t("recipeDrafts.cancelEdit", "Cancel edit")}
                          </Button>
                          <Button type="button" variant="outline" className="h-11" onClick={handleSave} disabled={saveDisabled}>
                            {t("recipeDrafts.saveDraft", "Save draft changes")}
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 text-red-700 hover:text-red-800"
                          onClick={() => setRejectOpen(true)}
                          disabled={actions.isBusy}
                        >
                          {t("recipeDrafts.reject", "Reject draft")}
                        </Button>
                      )}
                      <Button
                        type="button"
                        className={cn("h-11", mode === "edit" && "col-span-2")}
                        onClick={handlePublish}
                        disabled={publishDisabled}
                      >
                        {actions.isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                        {t("recipeDrafts.publish", "Publish recipe")}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">
                      {pending
                        ? t("recipeDrafts.viewOnly", "Only the owner or an admin can edit and publish drafts.")
                        : null}
                    </p>
                  )}
                </div>
              </footer>
            </>
          )}
        </DialogContent>
      </Dialog>

      {review ? (
        <AddRecipeIngredientDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          ingredients={catalogIngredients.filter((row) => row.outlet_ids.includes(review.draft.outlet_id))}
          excludeIds={editLines.map((line) => line.ingredientId)}
          onAdd={(ingredientId) => {
            const ingredient = catalogIngredients.find((row) => row.id === ingredientId);
            if (!ingredient) return;
            const stock = stockForOutlet(ingredient, review.draft.outlet_id);
            const unitCost = stock.track_cogs ? stock.avg_cost : 0;
            setConfirmed(false);
            setEditLines((lines) => [
              ...lines,
              newEditLine({
                ingredientId: ingredient.id,
                name: ingredient.name,
                unitCode: ingredient.unit_code,
                unitCost,
                hasCost: stock.track_cogs && stock.avg_cost > 0,
              }),
            ]);
          }}
        />
      ) : null}

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("recipeDrafts.rejectTitle", "Reject this draft?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("recipeDrafts.rejectBody", "The active recipe stays the same. You can ask Claude for a new draft any time.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-gray-800">{t("recipeDrafts.rejectNote", "Reason (optional)")}</span>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value.slice(0, 500))}
              rows={3}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actions.isBusy}>{t("common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleReject();
              }}
              disabled={actions.isBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("recipeDrafts.reject", "Reject draft")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
