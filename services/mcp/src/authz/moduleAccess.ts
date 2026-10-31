export type ModuleRow = {
  module_key: string;
  is_enabled: boolean;
};

export type ModuleEnablement = {
  subscriptionSelfServiceEnabled: boolean | null | undefined;
  salesRows: ModuleRow[] | null;
  subscriptionPlanId: string | null;
  planRows: ModuleRow[] | null;
};

export function isModuleEnabled(moduleKey: string, input: ModuleEnablement): boolean {
  if (input.subscriptionSelfServiceEnabled === false) {
    return (input.salesRows ?? []).some((row) => row.module_key === moduleKey && row.is_enabled);
  }
  if (!input.subscriptionPlanId) return true;
  if (!input.planRows || input.planRows.length === 0) return true;
  return input.planRows.some((row) => row.module_key === moduleKey && row.is_enabled);
}

export function isDigitalMarketingEnabled(input: ModuleEnablement): boolean {
  return isModuleEnabled("digitalMarketing", input);
}
