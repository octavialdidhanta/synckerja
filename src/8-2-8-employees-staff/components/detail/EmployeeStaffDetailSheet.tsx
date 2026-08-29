import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Badge } from "@/shared/components/ui/badge";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { usePosOutlets } from "@/8-2-2-outlets/hooks/usePosOutlets";
import type { PosStaffListItem, PosStaffRole } from "../../lib/posStaffTypes";
import { legacyPosRoleFromSlug } from "../../lib/posAccessPermissionPresets";
import {
  countActiveAdministrators,
  resolveOutletIdsForRole,
  validateOutletsForRole,
} from "../../lib/posStaffRoleRules";
import { usePosEmployeeStaff } from "../../hooks/usePosEmployeeStaff";
import { usePosEmployeeRoles, type PosEmployeeRoleRow } from "../../hooks/usePosEmployeeRoles";
import { usePosStaffPin } from "../../hooks/usePosStaffPin";
import { PosEmployeeRoleSelect } from "./PosEmployeeRoleSelect";
import { AssignOutletModal } from "./AssignOutletModal";
import { StaffPinFields } from "./StaffPinFields";

type Props = {
  staff: PosStaffListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showPinSection?: boolean;
};

export function EmployeeStaffDetailSheet({
  staff,
  open,
  onOpenChange,
  showPinSection = true,
}: Props) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { staff: allStaff, save, setActive, setOutlets } = usePosEmployeeStaff();
  const { roles } = usePosEmployeeRoles();
  const { setPin, clearPin, updateAllowPin } = usePosStaffPin();
  const { rows: outlets } = usePosOutlets();

  const [roleId, setRoleId] = useState<string | null>(null);
  const [posRole, setPosRole] = useState<PosStaffRole>("cashier");
  const [description, setDescription] = useState("");
  const [outletIds, setOutletIds] = useState<string[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const activeOutletIds = outlets.filter((o) => o.is_active !== false).map((o) => o.id);

  useEffect(() => {
    if (!open || !staff) return;
    setRoleId(staff.role_id);
    setPosRole(staff.pos_role);
    setDescription(staff.description ?? "");
    setOutletIds([...staff.outlet_ids]);
  }, [open, staff]);

  if (!staff) return null;

  const applyRole = (role: PosEmployeeRoleRow) => {
    setRoleId(role.id);
    setPosRole(legacyPosRoleFromSlug(role.slug));
  };

  const handleSave = async () => {
    const resolvedOutlets = resolveOutletIdsForRole(posRole, outletIds, activeOutletIds);
    const outletCheck = validateOutletsForRole(posRole, resolvedOutlets);
    if (!outletCheck.ok) {
      toast({
        title: t(
          "employeesStaff.admin.cashierNeedsOutlet",
          "Cashiers must be assigned at least one outlet.",
        ),
        variant: "destructive",
      });
      return;
    }

    const nextStaffPreview = allStaff.map((s) =>
      s.id === staff.id ? { ...s, pos_role: posRole, is_active: staff.is_active } : s,
    );
    if (
      staff.pos_role === "administrator" &&
      posRole === "cashier" &&
      staff.is_active &&
      countActiveAdministrators(nextStaffPreview) === 0
    ) {
      toast({
        title: t(
          "employeesStaff.admin.noAdminWarning",
          "Warning: no active POS administrator left.",
        ),
      });
    }

    const resolvedRoleId =
      roleId ??
      roles.find((r) => r.slug === posRole)?.id ??
      null;

    setSaving(true);
    try {
      await save.mutateAsync({
        id: staff.id,
        employee_id: staff.employee_id,
        pos_role: posRole,
        role_id: resolvedRoleId,
        description,
        outlet_ids: resolvedOutlets,
        is_active: staff.is_active,
        allow_pin_for_permissions: staff.allow_pin_for_permissions,
      });
      setOutletIds(resolvedOutlets);
      toast({ title: t("employeesStaff.detail.saved", "Staff access saved.") });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: t("employeesStaff.detail.saveError", "Failed to save staff."),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async (ids: string[]) => {
    const resolved = resolveOutletIdsForRole(posRole, ids, activeOutletIds);
    const outletCheck = validateOutletsForRole(posRole, resolved);
    if (!outletCheck.ok) {
      toast({
        title: t(
          "employeesStaff.admin.cashierNeedsOutlet",
          "Cashiers must be assigned at least one outlet.",
        ),
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await setOutlets.mutateAsync({ staffId: staff.id, outletIds: resolved });
      setOutletIds(resolved);
      setAssignOpen(false);
      toast({ title: t("employeesStaff.assignOutlet.saved", "Outlets assigned.") });
    } catch (err) {
      toast({
        title: t("employeesStaff.assignOutlet.error", "Failed to assign outlets."),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const showingAllOutlets =
    activeOutletIds.length > 1 &&
    activeOutletIds.every((id) => outletIds.includes(id));

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b pb-3 text-left">
            <SheetTitle>{t("employeesStaff.detail.title", "Employee Access")}</SheetTitle>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 py-4">
            <div className="space-y-1.5">
              <Label>{t("employeesStaff.detail.name", "Name")}</Label>
              <Input value={staff.full_name} readOnly />
            </div>
            <div className="space-y-1.5">
              <Label>{t("employeesStaff.detail.email", "Email")}</Label>
              <Input value={staff.email ?? ""} readOnly />
            </div>
            <div className="space-y-1.5">
              <Label>{t("employeesStaff.detail.phone", "Phone")}</Label>
              <Input value={staff.mobile_phone ?? ""} readOnly />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pos-staff-role">
                {t("employeesStaff.detail.role", "Employee Role")}
              </Label>
              <PosEmployeeRoleSelect
                id="pos-staff-role"
                value={roleId}
                onChange={applyRole}
              />
              <p className="text-xs text-muted-foreground">
                {posRole === "administrator"
                  ? t(
                      "employeesStaff.admin.defaultOutletsHint",
                      "Administrators default to all active outlets when none are selected.",
                    )
                  : t(
                      "employeesStaff.admin.cashierOutletHint",
                      "Cashiers need at least one assigned outlet.",
                    )}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pos-staff-desc">
                {t("employeesStaff.detail.description", "Description")}
              </Label>
              <Textarea
                id="pos-staff-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>{t("employeesStaff.detail.outlets", "Assigned Outlets")}</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
                  {t("employeesStaff.detail.assignOutlet", "Assign Outlet")}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {outletIds.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {posRole === "administrator"
                      ? t(
                          "employeesStaff.admin.willAssignAll",
                          "None selected — all active outlets will be assigned on save.",
                        )
                      : t("employeesStaff.detail.noOutlets", "No outlets assigned.")}
                  </span>
                ) : showingAllOutlets ? (
                  <Badge variant="secondary">
                    {t("employeesStaff.badge.allOutlets", "All Outlets")}
                  </Badge>
                ) : (
                  outlets
                    .filter((o) => outletIds.includes(o.id))
                    .map((o) => (
                      <Badge key={o.id} variant="outline">
                        {o.name}
                      </Badge>
                    ))
                )}
              </div>
            </div>

            {showPinSection ? (
              <div className="space-y-2 border-t pt-4">
                <p className="text-sm font-medium">
                  {t("employeesStaff.detail.pinSection", "Assign PIN")}
                </p>
                <StaffPinFields
                  hasPin={staff.has_pin}
                  allowPinForPermissions={staff.allow_pin_for_permissions}
                  busy={saving || setPin.isPending || clearPin.isPending || updateAllowPin.isPending}
                  onAllowPinChange={async (value) => {
                    try {
                      await updateAllowPin.mutateAsync({
                        staffId: staff.id,
                        allow_pin_for_permissions: value,
                      });
                    } catch (err) {
                      toast({
                        title: t("employeesStaff.pin.updateError", "Failed to update PIN setting."),
                        description: err instanceof Error ? err.message : undefined,
                        variant: "destructive",
                      });
                    }
                  }}
                  onSetPin={async (pin) => {
                    try {
                      await setPin.mutateAsync({ staffId: staff.id, pin });
                      if (!staff.allow_pin_for_permissions) {
                        await updateAllowPin.mutateAsync({
                          staffId: staff.id,
                          allow_pin_for_permissions: true,
                        });
                      }
                      toast({ title: t("employeesStaff.pin.saved", "PIN saved.") });
                    } catch (err) {
                      toast({
                        title: t("employeesStaff.pin.saveError", "Failed to save PIN."),
                        description: err instanceof Error ? err.message : undefined,
                        variant: "destructive",
                      });
                    }
                  }}
                  onClearPin={async () => {
                    try {
                      await clearPin.mutateAsync(staff.id);
                      toast({ title: t("employeesStaff.pin.cleared", "PIN cleared.") });
                    } catch (err) {
                      toast({
                        title: t("employeesStaff.pin.clearError", "Failed to clear PIN."),
                        description: err instanceof Error ? err.message : undefined,
                        variant: "destructive",
                      });
                    }
                  }}
                />
              </div>
            ) : null}

            <div className="mt-auto flex flex-col gap-2 border-t pt-4">
              <Button asChild variant="outline" size="sm">
                <Link to={`/employees?employee=${staff.employee_id}`}>
                  {t("employeesStaff.detail.openHr", "Open HR employee record")}
                </Link>
              </Button>
              <Button
                type="button"
                variant={staff.is_active ? "outline" : "default"}
                size="sm"
                disabled={setActive.isPending}
                onClick={() =>
                  void setActive
                    .mutateAsync({ id: staff.id, is_active: !staff.is_active })
                    .then(() => {
                      toast({
                        title: staff.is_active
                          ? t("employeesStaff.detail.deactivated", "POS staff deactivated.")
                          : t("employeesStaff.detail.activated", "POS staff activated."),
                      });
                    })
                }
              >
                {staff.is_active
                  ? t("employeesStaff.detail.deactivate", "Deactivate Employee")
                  : t("employeesStaff.detail.activate", "Activate Employee")}
              </Button>
              <Button type="button" disabled={saving} onClick={() => void handleSave()}>
                {t("common.save", "Save")}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AssignOutletModal
        open={assignOpen}
        onOpenChange={setAssignOpen}
        selectedOutletIds={outletIds}
        onAssign={handleAssign}
        saving={saving}
      />
    </>
  );
}
