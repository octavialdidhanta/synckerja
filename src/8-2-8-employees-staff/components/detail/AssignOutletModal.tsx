import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { usePosOutlets } from "@/8-2-2-outlets/hooks/usePosOutlets";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedOutletIds: string[];
  onAssign: (outletIds: string[]) => void | Promise<void>;
  saving?: boolean;
};

export function AssignOutletModal({
  open,
  onOpenChange,
  selectedOutletIds,
  onAssign,
  saving,
}: Props) {
  const { t } = useAppTranslation();
  const { rows: outlets, isLoading } = usePosOutlets();
  const [search, setSearch] = useState("");
  const [draftIds, setDraftIds] = useState<string[]>(selectedOutletIds);

  useEffect(() => {
    if (!open) return;
    setDraftIds(selectedOutletIds);
    setSearch("");
  }, [open, selectedOutletIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return outlets;
    return outlets.filter((o) => o.name.toLowerCase().includes(q));
  }, [outlets, search]);

  const toggle = (id: string) => {
    setDraftIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle>{t("employeesStaff.assignOutlet.title", "Assign Outlet")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 px-4 py-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("employeesStaff.assignOutlet.search", "Search outlet")}
          />
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
            {isLoading ? (
              <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                {t("common.loading", "Loading…")}
              </p>
            ) : filtered.length === 0 ? (
              <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                {t("employeesStaff.assignOutlet.empty", "No outlets found.")}
              </p>
            ) : (
              filtered.map((outlet) => {
                const checked = draftIds.includes(outlet.id);
                return (
                  <label
                    key={outlet.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/60"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(outlet.id)}
                    />
                    <span className="text-sm">{outlet.name}</span>
                  </label>
                );
              })
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-0 text-primary"
            onClick={() => setDraftIds([])}
          >
            {t("employeesStaff.assignOutlet.deselectAll", "Deselect All")}
          </Button>
        </div>
        <DialogFooter className="border-t px-4 py-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={() => void onAssign(draftIds)}
          >
            {t("employeesStaff.assignOutlet.assign", "Assign")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
