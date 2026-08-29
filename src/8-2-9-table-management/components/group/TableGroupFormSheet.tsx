import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PosTableGroup } from "../../lib/posTableGroupTypes";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create mode */
  group: PosTableGroup | null;
  busy?: boolean;
  onSave: (payload: { name: string; is_active: boolean }) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
};

export function TableGroupFormSheet({
  open,
  onOpenChange,
  group,
  busy,
  onSave,
  onDelete,
}: Props) {
  const { t } = useAppTranslation();
  const isEdit = Boolean(group);
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(group?.name ?? "");
    setIsActive(group?.is_active ?? true);
    setLocalError(null);
  }, [open, group]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setLocalError(
        t("tableManagement.group.nameRequired", "Table group name is required."),
      );
      return;
    }
    setLocalError(null);
    await onSave({ name: trimmed, is_active: isActive });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {isEdit
              ? t("tableManagement.group.editTitle", "Edit Table Group")
              : t("tableManagement.group.createTitle", "Create Table Group")}
          </SheetTitle>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 py-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="pos-table-group-name">
                {t("tableManagement.group.nameLabel", "Table Group Name")}
              </Label>
              <Input
                id="pos-table-group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t(
                  "tableManagement.group.namePlaceholder",
                  "e.g. Lantai 2 Indoor",
                )}
                disabled={busy}
              />
            </div>
            <div className="flex flex-col gap-1.5 pb-1">
              <Label htmlFor="pos-table-group-status">
                {t("tableManagement.group.statusLabel", "Status")}
              </Label>
              <div className="flex h-9 items-center gap-2">
                <Switch
                  id="pos-table-group-status"
                  checked={isActive}
                  disabled={busy}
                  onCheckedChange={setIsActive}
                />
                <span className="text-sm text-muted-foreground">
                  {isActive
                    ? t("tableManagement.group.statusActive", "Active")
                    : t("tableManagement.group.statusInactive", "Inactive")}
                </span>
              </div>
            </div>
          </div>
          {localError ? <p className="text-xs text-destructive">{localError}</p> : null}
        </div>

        <SheetFooter className="mt-auto flex-row items-center justify-between gap-2 sm:justify-between">
          <div>
            {isEdit && onDelete ? (
              <Button
                type="button"
                size="icon"
                variant="destructive"
                disabled={busy}
                aria-label={t("common.delete", "Delete")}
                onClick={() => void onDelete()}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : (
              <span />
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button type="button" disabled={busy} onClick={() => void handleSave()}>
              {t("common.save", "Save")}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
