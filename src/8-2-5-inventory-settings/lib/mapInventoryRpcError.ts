const INVENTORY_RPC_MESSAGES: Record<string, string> = {
  catalog_inventory_feature_forbidden: "You do not have permission for this inventory action.",
  catalog_inventory_access_roles_required: "Assign at least one role for each feature.",
  catalog_inventory_mode_invalid: "Invalid workflow mode.",
};

export function matchInventoryRpcError(error: unknown): string | undefined {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  for (const [code, message] of Object.entries(INVENTORY_RPC_MESSAGES)) {
    if (raw.includes(code)) return message;
  }
  return undefined;
}

export function mapInventoryRpcError(error: unknown, fallback: string): string {
  const matched = matchInventoryRpcError(error);
  if (matched) return matched;
  const raw = (error instanceof Error ? error.message : String(error ?? "")).trim();
  return raw || fallback;
}

export function isInventoryFeatureForbiddenError(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  return raw.includes("catalog_inventory_feature_forbidden");
}
