import { Button } from "@/shared/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { featureAccessLabelKey, roleLabelKey } from "../lib/inventoryFeatureKeys";
import type { InventoryFeatureAccessRow, InventoryFeatureKey, InventoryUserRole } from "../types";

export function FeatureAccessTable(props: {
  rows: InventoryFeatureAccessRow[];
  onManageRoles: (featureKey: InventoryFeatureKey) => void;
  disabled?: boolean;
  invalidKeys?: InventoryFeatureKey[];
}) {
  const { t } = useAppTranslation();
  const invalidSet = new Set(props.invalidKeys ?? []);

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">
              <span className="text-red-500">*</span> {t("settings.inventory.accessColumn", "Access")}
            </TableHead>
            <TableHead>{t("settings.inventory.rolesColumn", "Employee Roles")}</TableHead>
            <TableHead className="w-[120px] text-right">
              {t("settings.inventory.manageRoles", "Manage Roles")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.rows.map((row) => {
            const roles = row.allowed_roles;
            const isInvalid = invalidSet.has(row.feature_key) || roles.length === 0;
            return (
              <TableRow key={row.feature_key}>
                <TableCell className="font-medium">
                  {t(featureAccessLabelKey(row.feature_key), row.feature_key)}
                </TableCell>
                <TableCell className={isInvalid ? "text-red-600" : "text-muted-foreground"}>
                  {roles.length > 0
                    ? roles.map((role) => t(roleLabelKey(role as InventoryUserRole), role)).join(", ")
                    : t("settings.inventory.noRolesAssigned", "No roles assigned")}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={props.disabled}
                    onClick={() => props.onManageRoles(row.feature_key)}
                  >
                    {t("settings.inventory.manageRoles", "Manage Roles")}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
