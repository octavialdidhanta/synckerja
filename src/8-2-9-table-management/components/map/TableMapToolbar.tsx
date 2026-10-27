import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { OutletFilterSelect } from "@/8-2-2-outlets/components/OutletFilterSelect";
import { Copy, ClipboardPaste, ChevronDown, Plus } from "lucide-react";
import type { PosTableGroup } from "../../lib/posTableGroupTypes";

type Props = {
  outletId: string;
  onOutletChange: (id: string) => void;
  groups: PosTableGroup[];
  groupId: string;
  onGroupChange: (id: string) => void;
  groupsLoading?: boolean;
  onAddTable: () => void;
  onAddFloorItem: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  canCopy?: boolean;
  canPaste?: boolean;
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
  onAddFloorItem,
  onCopy,
  onPaste,
  canCopy = false,
  canPaste = false,
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
    <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <h2 className="flex h-10 shrink-0 items-center whitespace-nowrap text-lg font-semibold leading-none text-gray-900">
        {t("tableManagement.map.title", "Table Map")}
      </h2>
      <OutletFilterSelect
        value={outletId}
        onChange={onOutletChange}
        className="h-10 w-[180px] shrink-0"
      />
      <Select
        value={groupId || undefined}
        onValueChange={onGroupChange}
        disabled={groupsLoading || groups.length === 0}
      >
        <SelectTrigger
          className="h-10 w-[180px] shrink-0"
          aria-label={t("tableManagement.map.group", "Table Group")}
        >
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className="h-10 shrink-0" disabled={!groupId}>
            <Plus className="mr-1 h-4 w-4" />
            {t("tableManagement.map.add", "Add")}
            <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={onAddTable}>
            {t("tableManagement.map.addTable", "Add Table")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onAddFloorItem}>
            {t("tableManagement.fixture.addFloorItem", "Add Floor Item")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        type="button"
        variant="outline"
        className="h-10 shrink-0"
        disabled={!groupId || !canCopy}
        onClick={onCopy}
      >
        <Copy className="mr-1 h-4 w-4" />
        {t("tableManagement.map.copy", "Copy")}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-10 shrink-0"
        disabled={!groupId || !canPaste}
        onClick={onPaste}
      >
        <ClipboardPaste className="mr-1 h-4 w-4" />
        {t("tableManagement.map.paste", "Paste")}
      </Button>
      <div className="min-w-0 flex-1" aria-hidden />
      <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
        {t("tableManagement.map.statusLabel", "Status:")}{" "}
        <span className={groupActive ? "font-medium text-emerald-600" : ""}>{statusLabel}</span>
      </span>
      <Button
        type="button"
        className="h-10 shrink-0"
        onClick={onSave}
        disabled={saveDisabled || saving}
      >
        {saving
          ? t("common.saving", "Saving…")
          : t("tableManagement.map.saveChanges", "Save Changes")}
      </Button>
    </div>
  );
}
