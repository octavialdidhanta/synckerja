import { useEffect, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PosTableRotation, PosTableShape } from "../../lib/posTableTypes";
import { POS_TABLE_SHAPES } from "../../lib/posTableTypes";
import { normalizeRotation } from "../../lib/tableRotation";
import {
  defaultPaxForShape,
  normalizePaxForShape,
} from "../../lib/tableShapeLayout";

export type TableDialogValues = {
  name: string;
  shape: PosTableShape;
  pax: number;
  rotation: PosTableRotation;
};

const ROTATION_OPTIONS: PosTableRotation[] = [0, 90, 180, 270];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  initial?: TableDialogValues | null;
  onSubmit: (values: TableDialogValues) => void;
  onDelete?: () => void;
};

function shapeLabel(
  shape: PosTableShape,
  t: (key: string, fallback: string) => string,
): string {
  if (shape === "circle") return t("tableManagement.map.shape.circle", "Circle");
  if (shape === "square") return t("tableManagement.map.shape.square", "Square");
  if (shape === "rectangle") {
    return t("tableManagement.map.shape.rectangle", "Persegi Panjang");
  }
  return t("tableManagement.map.shape.oneSided", "Satu Sisi");
}

export function AddEditTableDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onSubmit,
  onDelete,
}: Props) {
  const { t } = useAppTranslation();
  const [name, setName] = useState("");
  const [shape, setShape] = useState<PosTableShape>("circle");
  const [pax, setPax] = useState(4);
  const [rotation, setRotation] = useState<PosTableRotation>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setShape(initial.shape);
      setPax(normalizePaxForShape(initial.shape, initial.pax));
      setRotation(normalizeRotation(initial.rotation ?? 0));
    } else {
      setName("");
      setShape("circle");
      setPax(defaultPaxForShape("circle"));
      setRotation(0);
    }
    setError(null);
  }, [open, initial]);

  const handleShape = (next: PosTableShape) => {
    setShape(next);
    setPax(normalizePaxForShape(next, next === "square" ? 2 : pax));
  };

  const paxLocked = shape === "square";
  const minPax = shape === "rectangle" ? 2 : 1;
  const maxPax = shape === "circle" ? 12 : shape === "square" ? 2 : 20;

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("tableManagement.map.nameRequired", "Table name is required."));
      return;
    }
    onSubmit({
      name: trimmed,
      shape,
      pax: normalizePaxForShape(shape, pax),
      rotation: normalizeRotation(rotation),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="bg-primary px-4 py-3 text-primary-foreground">
          <DialogTitle className="text-center text-base font-semibold text-primary-foreground">
            {mode === "add"
              ? t("tableManagement.map.addTable", "Add Table")
              : t("tableManagement.map.editTable", "Edit Table")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="pos-table-name" className="sr-only">
              {t("tableManagement.map.tableName", "Table Name")}
            </Label>
            <Input
              id="pos-table-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("tableManagement.map.tableName", "Table Name")}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label>{t("tableManagement.map.pax", "Pax")}</Label>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8"
                disabled={paxLocked || pax <= minPax}
                onClick={() => setPax((v) => normalizePaxForShape(shape, v - 1))}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <Input
                className="h-8 w-14 text-center"
                inputMode="numeric"
                value={pax}
                disabled={paxLocked}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/\D/g, ""));
                  setPax(normalizePaxForShape(shape, Number.isFinite(n) ? n : minPax));
                }}
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8"
                disabled={paxLocked || pax >= maxPax}
                onClick={() => setPax((v) => normalizePaxForShape(shape, v + 1))}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("tableManagement.map.tableShape", "Table Shape")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {POS_TABLE_SHAPES.map((s) => (
                <label
                  key={s}
                  className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-2 text-sm"
                >
                  <input
                    type="radio"
                    name="pos-table-shape"
                    checked={shape === s}
                    onChange={() => handleShape(s)}
                    className="accent-primary"
                  />
                  {shapeLabel(s, t)}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("tableManagement.map.rotation", "Rotation")}</Label>
            <div className="grid grid-cols-4 gap-2">
              {ROTATION_OPTIONS.map((deg) => (
                <label
                  key={deg}
                  className="flex cursor-pointer items-center justify-center gap-1 rounded-md border px-2 py-2 text-sm"
                >
                  <input
                    type="radio"
                    name="pos-table-rotation"
                    checked={rotation === deg}
                    onChange={() => setRotation(deg)}
                    className="accent-primary"
                  />
                  {t("tableManagement.map.rotationDeg", "{{deg}}°", { deg })}
                </label>
              ))}
            </div>
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 border-t px-4 py-3 sm:justify-between">
          <div>
            {mode === "edit" && onDelete ? (
              <Button
                type="button"
                size="icon"
                variant="destructive"
                aria-label={t("common.delete", "Delete")}
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : (
              <span />
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button type="button" onClick={handleSubmit}>
              {mode === "add"
                ? t("tableManagement.map.add", "Add")
                : t("common.save", "Save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
