import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { roleLabelKey } from "../lib/inventoryFeatureKeys";
import { useInventoryOrgRoles } from "../hooks/useInventoryFeatureAccess";
import type { InventoryFeatureKey, InventoryUserRole } from "../types";

export function AssignFeatureAccessDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureKey: InventoryFeatureKey | null;
  featureLabel: string;
  selectedRoles: InventoryUserRole[];
  onAssign: (roles: InventoryUserRole[]) => void;
  busy?: boolean;
}) {
  const { t } = useAppTranslation();
  const rolesQuery = useInventoryOrgRoles(props.open);
  const [search, setSearch] = useState("");
  const [draftRoles, setDraftRoles] = useState<InventoryUserRole[]>([]);

  useEffect(() => {
    if (!props.open) return;
    setDraftRoles(props.selectedRoles);
    setSearch("");
  }, [props.open, props.selectedRoles, props.featureKey]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rolesQuery.data ?? []).filter((row) => {
      const label = t(roleLabelKey(row.role), row.role).toLowerCase();
      return !q || label.includes(q) || row.role.includes(q);
    });
  }, [rolesQuery.data, search, t]);

  const toggleRole = (role: InventoryUserRole, checked: boolean) => {
    setDraftRoles((prev) => {
      if (checked) return prev.includes(role) ? prev : [...prev, role];
      return prev.filter((r) => r !== role);
    });
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-0 border-b bg-blue-600 px-6 py-4 text-left text-white">
          <DialogTitle className="text-base font-semibold text-white">
            {t("settings.inventory.assignModal.title", "Assign Feature Access to Employee Roles")}
          </DialogTitle>
          {props.featureLabel ? (
            <p className="text-sm text-blue-100">{props.featureLabel}</p>
          ) : null}
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("settings.inventory.assignModal.search", "Search roles")}
              className="pl-9"
            />
          </div>

          <div className="max-h-[320px] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>{t("settings.inventory.assignModal.role", "Role")}</TableHead>
                  <TableHead>{t("settings.inventory.assignModal.employees", "Employees")}</TableHead>
                  <TableHead className="text-right">
                    {t("settings.inventory.assignModal.assigned", "Employees Assigned")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rolesQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      {t("common.loading", "Loading…")}
                    </TableCell>
                  </TableRow>
                ) : filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      {t("settings.inventory.assignModal.empty", "No roles found.")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => {
                    const checked = draftRoles.includes(row.role);
                    return (
                      <TableRow key={row.role}>
                        <TableCell>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => toggleRole(row.role, value === true)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {t(roleLabelKey(row.role), row.role)}
                        </TableCell>
                        <TableCell>{row.employee_count}</TableCell>
                        <TableCell className="text-right">{checked ? row.employee_count : 0}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)} disabled={props.busy}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => props.onAssign(draftRoles)}
            disabled={props.busy || draftRoles.length === 0}
          >
            {t("settings.inventory.assignModal.assign", "Assign")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
