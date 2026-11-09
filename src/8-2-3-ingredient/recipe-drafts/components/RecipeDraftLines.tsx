import { AlertTriangle, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { rupiah } from "../lib/recipeDraftFormat";
import { formatQty, friendlyQty, storedQty } from "../lib/recipeDraftUnits";
import type { RecipeDraftLineError } from "../lib/recipeDraftEdit";
import type { RecipeDraftChange } from "../types";
import { ChangeBadge, DeltaText, rowTint } from "./RecipeDraftParts";

export type RecipeDraftViewRow = {
  id: string;
  name: string;
  unitCode: string;
  beforeQty: number | null;
  afterQty: number | null;
  beforeCost: number;
  afterCost: number;
  deltaCost: number;
  change: RecipeDraftChange;
  hasCost: boolean;
  deleted: boolean;
  unusual: boolean;
  /** Edit mode only. */
  input?: string;
  inputUnit?: string;
  unitOptions?: string[];
  error?: RecipeDraftLineError | null;
};

export type RecipeDraftLinesProps = {
  mode: "read" | "edit";
  rows: RecipeDraftViewRow[];
  onlyChanged: boolean;
  totals: { before: number | null; after: number; delta: number | null };
  onInput?: (id: string, value: string) => void;
  onUnit?: (id: string, unit: string) => void;
  onToggleRemove?: (id: string) => void;
};

function useErrorText() {
  const { t } = useAppTranslation();
  return (error: RecipeDraftLineError) =>
    ({
      required: t("recipeDrafts.lineError.required", "Enter a quantity above 0"),
      unit: t("recipeDrafts.lineError.unit", "This unit cannot be converted"),
      too_small: t("recipeDrafts.lineError.tooSmall", "Too small for this unit"),
      too_large: t("recipeDrafts.lineError.tooLarge", "Too large"),
    })[error];
}

function QtyCell({ qty, unit, strong }: { qty: number | null; unit: string; strong?: boolean }) {
  if (qty == null) return <span className="text-gray-500">—</span>;
  const stored = storedQty(qty, unit);
  return (
    <>
      <span className={cn("block", strong && "font-semibold")}>{friendlyQty(qty, unit)}</span>
      {stored ? <span className="block text-xs text-gray-500">{stored}</span> : null}
    </>
  );
}

function AfterCost({ row }: { row: RecipeDraftViewRow }) {
  const { t } = useAppTranslation();
  if (row.afterQty == null) return <span className="text-gray-500">—</span>;
  if (!row.hasCost) {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-orange-800">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        Rp0
        <span className="sr-only">{t("recipeDrafts.noCost", "no buy cost yet")}</span>
      </span>
    );
  }
  return <span className={cn(row.change !== "same" && "font-semibold")}>{rupiah(row.afterCost)}</span>;
}

function QtyEditor({
  row,
  onInput,
  onUnit,
}: {
  row: RecipeDraftViewRow;
  onInput?: (id: string, value: string) => void;
  onUnit?: (id: string, unit: string) => void;
}) {
  const { t } = useAppTranslation();
  const errorText = useErrorText();
  const options = row.unitOptions ?? [row.unitCode];
  const describedBy = `qty-hint-${row.id}`;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Input
          value={row.input ?? ""}
          onChange={(e) => onInput?.(row.id, e.target.value)}
          inputMode="decimal"
          aria-label={t("recipeDrafts.qtyLabel", "Quantity of {{name}}", { name: row.name })}
          aria-invalid={row.error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-9 w-24 text-right",
            row.error && "border-red-600 focus-visible:ring-red-600",
            !row.error && row.unusual && "border-orange-600",
          )}
        />
        {options.length > 1 ? (
          <select
            value={row.inputUnit}
            onChange={(e) => onUnit?.(row.id, e.target.value)}
            aria-label={t("recipeDrafts.unitLabel", "Unit of {{name}}", { name: row.name })}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {options.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-gray-600">{row.unitCode}</span>
        )}
      </div>
      <span id={describedBy} className="text-xs">
        {row.error ? (
          <span className="font-semibold text-red-700">{errorText(row.error)}</span>
        ) : row.afterQty != null && options.length > 1 ? (
          <span className="text-gray-500">
            = {formatQty(row.afterQty)} {row.unitCode}
          </span>
        ) : null}
        {!row.error && row.unusual ? (
          <span className="block font-semibold text-orange-700">
            {t("recipeDrafts.lineUnusual", "Unusual for one portion — sure?")}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export function RecipeDraftLines({
  mode,
  rows,
  onlyChanged,
  totals,
  onInput,
  onUnit,
  onToggleRemove,
}: RecipeDraftLinesProps) {
  const { t } = useAppTranslation();
  const shown = onlyChanged ? rows.filter((row) => row.change !== "same") : rows;
  const editing = mode === "edit";

  const removeButton = (row: RecipeDraftViewRow) =>
    editing ? (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn("h-9 w-9", row.change === "removed" ? "text-blue-700" : "text-red-700")}
        onClick={() => onToggleRemove?.(row.id)}
        aria-label={
          row.change === "removed"
            ? t("recipeDrafts.restore", "Restore {{name}}", { name: row.name })
            : t("recipeDrafts.remove", "Remove {{name}} from the draft", { name: row.name })
        }
      >
        {row.change === "removed" ? <RotateCcw className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
      </Button>
    ) : null;

  return (
    <>
      {/* Desktop and tablet: comparison table */}
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-medium text-gray-600">
              <th scope="col" className="px-3.5 py-2.5 font-medium">{t("recipeDrafts.col.ingredient", "Ingredient")}</th>
              <th scope="col" className="px-3.5 py-2.5 font-medium">{t("recipeDrafts.col.before", "Before")}</th>
              <th scope="col" className="px-3.5 py-2.5 font-medium">{t("recipeDrafts.col.after", "After")}</th>
              <th scope="col" className="px-3.5 py-2.5 font-medium">{t("recipeDrafts.col.change", "Change")}</th>
              <th scope="col" className="px-3.5 py-2.5 text-right font-medium">{t("recipeDrafts.col.costBefore", "Cost before")}</th>
              <th scope="col" className="px-3.5 py-2.5 text-right font-medium">{t("recipeDrafts.col.costAfter", "Cost after")}</th>
              <th scope="col" className="px-3.5 py-2.5 text-right font-medium">{t("recipeDrafts.col.delta", "Difference")}</th>
              {editing ? (
                <th scope="col" className="w-12 px-2 py-2.5">
                  <span className="sr-only">{t("recipeDrafts.col.action", "Action")}</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.id} className={cn("border-t align-top", rowTint(row.change, !!row.error))}>
                <td className="px-3.5 py-3">
                  <span className={cn("font-medium", row.change === "removed" && "text-gray-500 line-through")}>
                    {row.name}
                  </span>
                  {row.deleted ? (
                    <span className="mt-1 block text-xs font-semibold text-red-700">
                      {t("recipeDrafts.deleted", "Deleted from Library")}
                    </span>
                  ) : null}
                </td>
                <td className="px-3.5 py-3 text-gray-600">
                  <QtyCell qty={row.beforeQty} unit={row.unitCode} />
                </td>
                <td className={cn("px-3.5", editing && row.change !== "removed" ? "py-2" : "py-3")}>
                  {editing && row.change !== "removed" ? (
                    <QtyEditor row={row} onInput={onInput} onUnit={onUnit} />
                  ) : (
                    <QtyCell qty={row.afterQty} unit={row.unitCode} strong={row.change !== "same"} />
                  )}
                </td>
                <td className="px-3.5 py-3">
                  <ChangeBadge change={row.change} />
                </td>
                <td className="px-3.5 py-3 text-right text-gray-600">
                  {row.beforeQty == null ? "—" : rupiah(row.beforeCost)}
                </td>
                <td className="px-3.5 py-3 text-right">
                  <AfterCost row={row} />
                </td>
                <td className="px-3.5 py-3 text-right">
                  <DeltaText value={row.deltaCost} />
                </td>
                {editing ? <td className="px-2 py-2">{removeButton(row)}</td> : null}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 bg-gray-50">
              <th scope="row" colSpan={4} className="px-3.5 py-3 text-left font-semibold">
                {t("recipeDrafts.totalHpp", "Total HPP per portion")}
              </th>
              <td className="px-3.5 py-3 text-right font-semibold text-gray-600">{rupiah(totals.before)}</td>
              <td className="px-3.5 py-3 text-right font-bold">{rupiah(totals.after)}</td>
              <td className="px-3.5 py-3 text-right">
                <DeltaText value={totals.delta} strong />
              </td>
              {editing ? <td /> : null}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Phone: one card per ingredient, no sideways scrolling */}
      <ul className="flex flex-col gap-2 md:hidden">
        {shown.map((row) => (
          <li key={row.id} className={cn("flex flex-col gap-2 rounded-lg border p-3", rowTint(row.change, !!row.error))}>
            <div className="flex items-center justify-between gap-2">
              <p className={cn("text-sm font-semibold", row.change === "removed" && "text-gray-500 line-through")}>
                {row.name}
              </p>
              <div className="flex items-center gap-2">
                <ChangeBadge change={row.change} />
                {removeButton(row)}
              </div>
            </div>
            {row.deleted ? (
              <p className="text-xs font-semibold text-red-700">{t("recipeDrafts.deleted", "Deleted from Library")}</p>
            ) : null}
            {editing && row.change !== "removed" ? (
              <QtyEditor row={row} onInput={onInput} onUnit={onUnit} />
            ) : null}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="block text-gray-500">{t("recipeDrafts.col.before", "Before")}</span>
                <span className="text-sm">{friendlyQty(row.beforeQty, row.unitCode)}</span>
              </div>
              <div>
                <span className="block text-gray-500">{t("recipeDrafts.col.after", "After")}</span>
                <span className="text-sm font-semibold">{friendlyQty(row.afterQty, row.unitCode)}</span>
              </div>
              <div className="text-right">
                <span className="block text-gray-500">{t("recipeDrafts.col.delta", "Difference")}</span>
                {row.afterQty != null && !row.hasCost ? (
                  <span className="text-sm font-semibold text-orange-800">
                    {t("recipeDrafts.noCostShort", "Rp0 · no cost")}
                  </span>
                ) : (
                  <span className="text-sm">
                    <DeltaText value={row.deltaCost} />
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
        <li className="flex items-center justify-between rounded-lg bg-gray-50 p-3 text-sm">
          <span className="font-semibold">{t("recipeDrafts.totalHppShort", "Total HPP")}</span>
          <span>
            {totals.before != null ? <span className="mr-1.5 text-gray-500 line-through">{rupiah(totals.before)}</span> : null}
            <strong>{rupiah(totals.after)}</strong>
          </span>
        </li>
      </ul>

      {onlyChanged && shown.length < rows.length ? (
        <p className="text-xs font-medium text-gray-700">
          {t(
            "recipeDrafts.hiddenSame",
            "{{count}} unchanged ingredients hidden. The total still counts every ingredient.",
            { count: rows.length - shown.length },
          )}
        </p>
      ) : null}
    </>
  );
}
