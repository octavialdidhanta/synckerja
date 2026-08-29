import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { OutletFilterSelect } from "@/8-2-2-outlets/components/OutletFilterSelect";
import type { PosTableGroup } from "../../lib/posTableGroupTypes";

type Props = {
  outletId: string;
  onOutletChange: (id: string) => void;
  groups: PosTableGroup[];
  groupId: string;
  onGroupChange: (id: string) => void;
  groupsLoading?: boolean;
  onAddTable: () => void;
  onSave: () => void;
  saveDisabled?: boolean;
  saving?: boolean;
  groupActive?: boolean | null;
};

export function TableMapToolbar({
  outletId,
  onOutletChange,
  groups,
  groupId,
  onGroupChange,
  groupsLoading,
  onAddTable,
  onSave,
  saveDisabled,
  saving,
  groupActive,
}: Props) {
  const { t } = useAppTranslation();
  const statusLabel =
    groupActive == null
      ? "—"
      : groupActive
        ? t("tableManagement.group.statusActive", "Active")
        : t("tableManagement.group.statusInactive", "Inactive");

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-2">
        <h2 className="text-base font-semibold">{t("tableManagement.map.title", "Table Map")}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <OutletFilterSelect value={outletId} onChange={onOutletChange} />
          <Select
            value={groupId || undefined}
            onValueChange={onGroupChange}
            disabled={groupsLoading || groups.length === 0}
          >
            <SelectTrigger className="h-9 w-[200px]" aria-label={t("tableManagement.map.group", "Table Group")}>
              <SelectValue
                placeholder={
                  groups.length === 0
                    ? t("tableManagement.map.noGroups", "No table groups")
                    : t("tableManagement.map.pickGroup", "Table Group")
                }
              />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" onClick={onAddTable} disabled={!groupId}>
            {t("tableManagement.map.addTable", "Add Table")}
          </Button>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Button type="button" onClick={onSave} disabled={saveDisabled || saving}>
          {saving
            ? t("common.saving", "Saving…")
            : t("tableManagement.map.saveChanges", "Save Changes")}
        </Button>
        <p className="text-xs">
          <span className="text-muted-foreground">
            {t("tableManagement.map.statusLabel", "Status:")}{" "}
          </span>
          <span className={groupActive ? "font-medium text-emerald-600" : "text-muted-foreground"}>
            {statusLabel}
          </span>
        </p>
      </div>
    </div>
  );
}
