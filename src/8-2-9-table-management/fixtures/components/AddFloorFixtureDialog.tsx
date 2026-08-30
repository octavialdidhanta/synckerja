import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
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
import {
  FIXTURE_DEFAULT_FOOTPRINT,
  FIXTURE_SIZE_EDITABLE_ON_ADD,
  POS_FLOOR_FIXTURE_TYPES,
  type PosFloorFixtureType,
} from "../lib/posFloorFixtureTypes";
import {
  fixtureTypeFallback,
  fixtureTypeLabelKey,
} from "../lib/fixtureVisuals";

export type FloorFixtureDialogValues = {
  fixture_type: PosFloorFixtureType;
  name: string;
  grid_w: number;
  grid_h: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  initial?: FloorFixtureDialogValues | null;
  /** Suggested name when type changes (add mode). */
  suggestName?: (type: PosFloorFixtureType) => string;
  onSubmit: (values: FloorFixtureDialogValues) => void;
  onDelete?: () => void;
};

function showSizeFields(mode: "add" | "edit", type: PosFloorFixtureType) {
  if (mode === "edit") return true;
  return FIXTURE_SIZE_EDITABLE_ON_ADD.includes(type);
}

export function AddFloorFixtureDialog({
  open,
  onOpenChange,
  mode,
  initial,
  suggestName,
  onSubmit,
  onDelete,
}: Props) {
  const { t } = useAppTranslation();
  const [fixtureType, setFixtureType] =
    useState<PosFloorFixtureType>("cashier");
  const [name, setName] = useState("");
  const [gridW, setGridW] = useState(2);
  const [gridH, setGridH] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setFixtureType(initial.fixture_type);
      setName(initial.name);
      setGridW(initial.grid_w);
      setGridH(initial.grid_h);
    } else {
      const fp = FIXTURE_DEFAULT_FOOTPRINT.cashier;
      setFixtureType("cashier");
      setName(suggestName?.("cashier") ?? "");
      setGridW(fp.grid_w);
      setGridH(fp.grid_h);
    }
    setError(null);
  }, [open, initial, suggestName]);

  const handleTypePick = (type: PosFloorFixtureType) => {
    setFixtureType(type);
    const fp = FIXTURE_DEFAULT_FOOTPRINT[type];
    setGridW(fp.grid_w);
    setGridH(fp.grid_h);
    if (mode === "add" && suggestName) {
      setName(suggestName(type));
    }
  };

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(
        t("tableManagement.fixture.nameRequired", "Enter a name for this item."),
      );
      return;
    }
    const defaults = FIXTURE_DEFAULT_FOOTPRINT[fixtureType];
    onSubmit({
      fixture_type: fixtureType,
      name: trimmed,
      grid_w: Math.max(1, Math.floor(gridW) || defaults.grid_w),
      grid_h: Math.max(1, Math.floor(gridH) || defaults.grid_h),
    });
  };

  const sizeVisible = showSizeFields(mode, fixtureType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "add"
              ? t("tableManagement.fixture.addTitle", "Add Floor Item")
              : t("tableManagement.fixture.editTitle", "Edit Floor Item")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>
              {t("tableManagement.fixture.typeLabel", "Type")}
            </Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {POS_FLOOR_FIXTURE_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  disabled={mode === "edit"}
                  onClick={() => handleTypePick(type)}
                  className={`rounded-md border px-2 py-2 text-left text-xs font-medium transition-colors ${
                    fixtureType === type
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:bg-muted/50"
                  } disabled:opacity-70`}
                >
                  {t(fixtureTypeLabelKey(type), fixtureTypeFallback(type))}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fixture-name">
              {t("tableManagement.fixture.name", "Name")}
            </Label>
            <Input
              id="fixture-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(
                "tableManagement.fixture.namePlaceholder",
                "e.g. Cashier",
              )}
            />
          </div>
          {sizeVisible ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fixture-w">
                  {t("tableManagement.fixture.width", "Width (cells)")}
                </Label>
                <Input
                  id="fixture-w"
                  type="number"
                  min={1}
                  max={20}
                  value={gridW}
                  onChange={(e) => setGridW(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fixture-h">
                  {t("tableManagement.fixture.height", "Height (cells)")}
                </Label>
                <Input
                  id="fixture-h"
                  type="number"
                  min={1}
                  max={20}
                  value={gridH}
                  onChange={(e) => setGridH(Number(e.target.value))}
                />
              </div>
              {fixtureType === "parking" ? (
                <p className="col-span-2 text-xs text-muted-foreground">
                  {t(
                    "tableManagement.fixture.parkingSizeHint",
                    "Adjust width and height to match the parking bay length.",
                  )}
                </p>
              ) : null}
            </div>
          ) : null}
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
        </div>
        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          {mode === "edit" && onDelete ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              {t("common.delete", "Delete")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button type="button" onClick={handleSubmit}>
              {mode === "add"
                ? t("common.add", "Add")
                : t("common.save", "Save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
