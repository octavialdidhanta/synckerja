export type ModuleRow = {
  module_key: string;
  is_enabled: boolean;
};

export function isDigitalMarketingEnabled(input: {
  subscriptionSelfServiceEnabled: boolean | null | undefined;
  salesRows: ModuleRow[] | null;
  subscriptionPlanId: string | null;
  planRows: ModuleRow[] | null;
}): boolean {
  if (input.subscriptionSelfServiceEnabled === false) {
    return (input.salesRows ?? []).some(
      (row) => row.module_key === "digitalMarketing" && row.is_enabled,
    );
  }
  if (!input.subscriptionPlanId) return true;
  if (!input.planRows || input.planRows.length === 0) return true;
  return input.planRows.some((row) => row.module_key === "digitalMarketing" && row.is_enabled);
}
