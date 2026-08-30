import {
  flattenPermissionKeys,
  POS_APP_PERMISSION_TREE,
  POS_BACKOFFICE_PERMISSION_TREE,
} from "./posAccessPermissionCatalog";

export const POS_ADMIN_DEFAULT_PERMISSIONS: string[] = [
  ...flattenPermissionKeys(POS_APP_PERMISSION_TREE),
  ...flattenPermissionKeys(POS_BACKOFFICE_PERMISSION_TREE),
];

export const POS_CASHIER_DEFAULT_PERMISSIONS: string[] = [
  "app.pos.charge",
  "app.pos.manage_open_bills",
  "app.shift.view_print",
  "app.settings.view",
];

export const POS_KITCHEN_DEFAULT_PERMISSIONS: string[] = ["app.kitchen_display"];

export function slugifyPosRoleName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "role";
}

/** Sync legacy pos_role enum from role slug when possible. */
export function legacyPosRoleFromSlug(slug: string): "administrator" | "cashier" {
  if (slug === "administrator") return "administrator";
  // kitchen (and any custom role) uses cashier outlet rules
  return "cashier";
}
