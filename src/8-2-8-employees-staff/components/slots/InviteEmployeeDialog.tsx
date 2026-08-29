import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useEmployees } from "@/2-1-employees/hooks/useEmployees";
import { usePosOutlets } from "@/8-2-2-outlets/hooks/usePosOutlets";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { usePosEmployeeStaff } from "../../hooks/usePosEmployeeStaff";
import { usePosStaffInvite } from "../../hooks/usePosStaffInvite";
import {
  useEnsurePosDefaultRoles,
  usePosEmployeeRoles,
  type PosEmployeeRoleRow,
} from "../../hooks/usePosEmployeeRoles";
import { legacyPosRoleFromSlug } from "../../lib/posAccessPermissionPresets";
import type { PosStaffRole } from "../../lib/posStaffTypes";
import { PosEmployeeRoleSelect } from "../detail/PosEmployeeRoleSelect";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Mode = "new" | "link";

export function InviteEmployeeDialog({ open, onOpenChange }: Props) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { data: employees = [], isPending: employeesPending } = useEmployees();
  const { staff, memberLimit } = usePosEmployeeStaff();
  const { roles, isLoading: rolesLoading } = usePosEmployeeRoles();
  useEnsurePosDefaultRoles(open && !rolesLoading);
  const { inviteNew, linkExisting, isPending } = usePosStaffInvite();
  const { rows: outlets } = usePosOutlets();

  const [mode, setMode] = useState<Mode>("new");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [roleId, setRoleId] = useState<string | null>(null);
  const [posRole, setPosRole] = useState<PosStaffRole>("cashier");
  const [outletIds, setOutletIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setMode("new");
    setFullName("");
    setEmail("");
    setSearch("");
    setEmployeeId("");
    setOutletIds([]);
    const cashier = roles.find((r) => r.slug === "cashier");
    if (cashier) {
      setRoleId(cashier.id);
      setPosRole("cashier");
    } else {
      setRoleId(null);
      setPosRole("cashier");
    }
  }, [open, roles]);

  const applyRole = (role: PosEmployeeRoleRow) => {
    setRoleId(role.id);
    setPosRole(legacyPosRoleFromSlug(role.slug));
  };

  const linkedIds = useMemo(() => new Set(staff.map((s) => s.employee_id)), [staff]);

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees
      .filter((e) => !linkedIds.has(e.id))
      .filter((e) => {
        if (!q) return true;
        return (
          e.full_name?.toLowerCase().includes(q) ||
          e.email?.toLowerCase().includes(q) ||
          false
        );
      });
  }, [employees, linkedIds, search]);

  const toggleOutlet = (id: string) => {
    setOutletIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const slotsFull = staff.length >= memberLimit;

  const mapError = (err: unknown) => {
    const code = err instanceof Error ? err.message : "";
    if (code === "cashier_needs_outlet") {
      return t(
        "employeesStaff.admin.cashierNeedsOutlet",
        "Cashiers must be assigned at least one outlet.",
      );
    }
    if (code === "employee_email_exists") {
      return t(
        "employeesStaff.invite.emailExists",
        "An employee with this email already exists. Use Link existing.",
      );
    }
    if (code === "already_linked") {
      return t("employeesStaff.invite.alreadyLinked", "This employee is already linked to POS.");
    }
    if (code === "name_email_required") {
      return t("employeesStaff.invite.nameEmailRequired", "Name and email are required.");
    }
    return err instanceof Error ? err.message : t("employeesStaff.invite.error", "Invite failed.");
  };

  const handleSubmit = async () => {
    if (slotsFull) {
      toast({
        title: t("employeesStaff.invite.slotsFull", "No free employee slots left."),
        variant: "destructive",
      });
      return;
    }

    try {
      if (mode === "new") {
        const result = await inviteNew.mutateAsync({
          fullName,
          email,
          role_id: roleId,
          pos_role: posRole,
          outlet_ids: outletIds,
        });
        toast({
          title: result.emailSent
            ? t("employeesStaff.invite.sent", "Invitation email sent.")
            : t("employeesStaff.invite.createdPending", "Staff created; invitation email pending."),
          description: result.emailError || undefined,
          variant: result.emailSent ? "default" : "destructive",
        });
      } else {
        if (!employeeId) {
          toast({
            title: t("employeesStaff.invite.pickEmployee", "Select an employee to link."),
            variant: "destructive",
          });
          return;
        }
        const result = await linkExisting.mutateAsync({
          employee_id: employeeId,
          role_id: roleId,
          pos_role: posRole,
          outlet_ids: outletIds,
          sendInviteIfPending: true,
        });
        toast({
          title: result.verified
            ? t("employeesStaff.invite.linkedVerified", "Employee linked and verified.")
            : result.emailSent
              ? t("employeesStaff.invite.linkedSent", "Employee linked; invitation sent.")
              : t("employeesStaff.invite.linkedPending", "Employee linked; awaiting verification."),
          description: result.emailError || undefined,
        });
      }
      onOpenChange(false);
    } catch (err) {
      toast({
        title: t("employeesStaff.invite.error", "Invite failed."),
        description: mapError(err),
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle>{t("employeesStaff.invite.title", "Invite Employee")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-4 py-3">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "new" ? "default" : "outline"}
              onClick={() => setMode("new")}
            >
              {t("employeesStaff.invite.modeNew", "New invite")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "link" ? "default" : "outline"}
              onClick={() => setMode("link")}
            >
              {t("employeesStaff.invite.modeLink", "Link existing")}
            </Button>
          </div>

          {mode === "new" ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="pos-invite-name">{t("employeesStaff.detail.name", "Name")}</Label>
                <Input
                  id="pos-invite-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pos-invite-email">{t("employeesStaff.detail.email", "Email")}</Label>
                <Input
                  id="pos-invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t(
                  "employeesStaff.invite.operationsDeptHint",
                  "HR department will be set to Operations on Employee Management.",
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("employeesStaff.invite.search", "Search HR employees")}
              />
              <Select value={employeeId || undefined} onValueChange={setEmployeeId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      employeesPending
                        ? t("common.loading", "Loading…")
                        : t("employeesStaff.invite.select", "Select employee")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {candidates.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground">
                      {t("employeesStaff.invite.none", "No unlinked employees")}
                    </div>
                  ) : (
                    candidates.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.full_name}
                        {e.email ? ` · ${e.email}` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{t("employeesStaff.detail.role", "Employee Role")}</Label>
            <PosEmployeeRoleSelect value={roleId} onChange={applyRole} />
            {posRole === "administrator" ? (
              <p className="text-xs text-muted-foreground">
                {t(
                  "employeesStaff.admin.defaultOutletsHint",
                  "Administrators default to all active outlets when none are selected.",
                )}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t(
                  "employeesStaff.admin.cashierOutletHint",
                  "Cashiers need at least one assigned outlet.",
                )}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t("employeesStaff.detail.outlets", "Assigned Outlets")}</Label>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
              {outlets.length === 0 ? (
                <p className="px-1 py-4 text-center text-sm text-muted-foreground">
                  {t("employeesStaff.assignOutlet.empty", "No outlets found.")}
                </p>
              ) : (
                outlets.map((outlet) => (
                  <label
                    key={outlet.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
                  >
                    <Checkbox
                      checked={outletIds.includes(outlet.id)}
                      onCheckedChange={() => toggleOutlet(outlet.id)}
                    />
                    <span className="text-sm">{outlet.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t px-4 py-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="button" disabled={isPending || slotsFull} onClick={() => void handleSubmit()}>
            {mode === "new"
              ? t("employeesStaff.actions.invite", "Invite Employee")
              : t("employeesStaff.invite.link", "Link to POS")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
