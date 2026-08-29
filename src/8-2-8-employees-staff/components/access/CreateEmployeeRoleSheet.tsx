import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PosEmployeeRoleRow } from "../../hooks/usePosEmployeeRoles";
import { usePosEmployeeRoles } from "../../hooks/usePosEmployeeRoles";
import { usePosEmployeeStaff } from "../../hooks/usePosEmployeeStaff";
import {
  POS_BACKOFFICE_PERMISSION_TREE,
} from "../../lib/posAccessPermissionCatalog";
import { applyPermissionToggle } from "./PermissionCheckboxTree";
import { AppPermissionSection } from "./AppPermissionSection";
import { BackofficePermissionSection } from "./BackofficePermissionSection";
import { RoleEmployeesAssign } from "./RoleEmployeesAssign";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: PosEmployeeRoleRow | null;
};

function findParentAndSiblings(
  key: string,
): { parentKey?: string; siblingKeys?: string[] } {
  for (const parent of POS_BACKOFFICE_PERMISSION_TREE) {
    if (!parent.children?.length) continue;
    if (parent.children.some((c) => c.key === key)) {
      return {
        parentKey: parent.key,
        siblingKeys: parent.children.map((c) => c.key),
      };
    }
  }
  return {};
}

export function CreateEmployeeRoleSheet({ open, onOpenChange, role }: Props) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { save, remove } = usePosEmployeeRoles();
  const { staff } = usePosEmployeeStaff();

  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [staffIds, setStaffIds] = useState<string[]>([]);
  const [appOpen, setAppOpen] = useState(true);
  const [boOpen, setBoOpen] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (role) {
      setName(role.name);
      setSelected(new Set(role.permission_keys));
      setStaffIds([...role.staff_ids]);
    } else {
      setName("");
      setSelected(new Set(["app.pos.charge", "app.pos.manage_open_bills"]));
      setStaffIds([]);
    }
    setAppOpen(true);
    setBoOpen(true);
  }, [open, role]);

  const handleToggle = (key: string, checked: boolean, childKeys: string[]) => {
    const { parentKey, siblingKeys } = findParentAndSiblings(key);
    setSelected((prev) =>
      applyPermissionToggle(prev, key, checked, childKeys, parentKey, siblingKeys),
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: t("employeesStaff.access.roleNameRequired", "Enter a role name."),
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await save.mutateAsync({
        id: role?.id,
        name,
        permission_keys: [...selected],
        staff_ids: staffIds,
      });
      toast({
        title: role
          ? t("employeesStaff.access.roleSaved", "Role saved.")
          : t("employeesStaff.access.roleCreated", "Role created."),
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: t("employeesStaff.access.roleSaveError", "Failed to save role."),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!role || role.is_system) return;
    setSaving(true);
    try {
      await remove.mutateAsync(role.id);
      toast({ title: t("employeesStaff.access.roleDeleted", "Role deleted.") });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: t("employeesStaff.access.roleDeleteError", "Failed to delete role."),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader className="border-b pb-3 text-left">
          <SheetTitle>
            {role
              ? t("employeesStaff.access.editRole", "Edit Employee Role")
              : t("employeesStaff.access.createRole", "Create Employee Role")}
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="pos-role-name">
              {t("employeesStaff.access.roleName", "Role Name")}
            </Label>
            <Input
              id="pos-role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={role?.is_system}
              placeholder={t("employeesStaff.access.roleNamePlaceholder", "Role Name")}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("employeesStaff.access.employeesAssigned", "Employees Assigned")}</Label>
            <RoleEmployeesAssign
              staff={staff.filter((s) => s.is_active)}
              selectedStaffIds={staffIds}
              onChange={setStaffIds}
              currentRoleId={role?.id}
            />
          </div>

          <AppPermissionSection
            selected={selected}
            onToggle={handleToggle}
            expanded={appOpen}
            onExpandedChange={setAppOpen}
          />
          <BackofficePermissionSection
            selected={selected}
            onToggle={handleToggle}
            expanded={boOpen}
            onExpandedChange={setBoOpen}
          />

          <div className="mt-auto flex flex-wrap gap-2 border-t pt-4">
            {role && !role.is_system ? (
              <Button
                type="button"
                variant="outline"
                className="text-destructive"
                disabled={saving}
                onClick={() => void handleDelete()}
              >
                {t("common.delete", "Delete")}
              </Button>
            ) : null}
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel", "Cancel")}
              </Button>
              <Button type="button" disabled={saving} onClick={() => void handleSave()}>
                {role
                  ? t("common.save", "Save")
                  : t("employeesStaff.access.create", "Create")}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
