export type InventoryWorkflowMode = "simple" | "advanced";

export type InventoryFeatureKey =
  | "po_request"
  | "po_approval"
  | "po_fulfillment"
  | "transfer_request"
  | "transfer_approval"
  | "transfer_shipment"
  | "transfer_fulfillment";

export type InventoryUserRole = "owner" | "admin" | "hr" | "employee";

export type InventoryFeatureAccessRow = {
  feature_key: InventoryFeatureKey;
  allowed_roles: InventoryUserRole[];
};

export type CatalogInventorySettings = {
  organization_id: string;
  po_mode: InventoryWorkflowMode;
  transfer_mode: InventoryWorkflowMode;
  feature_access: InventoryFeatureAccessRow[];
};

export type CatalogInventorySettingsSave = {
  po_mode: InventoryWorkflowMode;
  transfer_mode: InventoryWorkflowMode;
  feature_access: InventoryFeatureAccessRow[];
};

export type InventoryOrgRoleRow = {
  role: InventoryUserRole;
  employee_count: number;
};

export const INVENTORY_RPC_ERRORS = {
  organization_id_required: "settings.inventory.errors.organizationRequired",
  forbidden: "settings.inventory.errors.forbidden",
  catalog_inventory_mode_invalid: "settings.inventory.errors.modeInvalid",
  catalog_inventory_access_roles_required: "settings.inventory.errors.accessRolesRequired",
} as const;

export type InventoryRpcErrorCode = keyof typeof INVENTORY_RPC_ERRORS;
