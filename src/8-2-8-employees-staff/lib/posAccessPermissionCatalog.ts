export type PosPermissionKey = string;

export type PosPermissionNode = {
  key: PosPermissionKey;
  labelKey: string;
  labelFallback: string;
  descriptionKey?: string;
  descriptionFallback?: string;
  /** UI-only soon flag (still storable). */
  soon?: boolean;
  children?: PosPermissionNode[];
};

/** Flat list of all known keys (app + backoffice). */
export const POS_ALL_PERMISSION_KEYS: readonly PosPermissionKey[] = [
  "app.pos.charge",
  "app.pos.manage_open_bills",
  "app.pos.discounts",
  "app.pos.refunds",
  "app.pos.void_cancel",
  "app.pos.resend_receipt",
  "app.shift.view_print",
  "app.shift.cash_movement",
  "app.settings.view",
  "app.settings.edit",
  "app.customers.edit",
  "app.table_map",
  "app.online_orders",
  "app.inventory",
  "bo.library",
  "bo.library.products",
  "bo.library.bundles",
  "bo.library.categories",
  "bo.library.brands",
  "bo.library.modifiers",
  "bo.library.promos",
  "bo.library.discounts",
  "bo.library.sales_types",
  "bo.library.taxes",
  "bo.library.gratuity",
  "bo.ingredient",
  "bo.ingredient.list",
  "bo.ingredient.categories",
  "bo.ingredient.recipes",
  "bo.settings",
  "bo.settings.outlets",
  "bo.settings.checkout",
  "bo.settings.receipt",
  "bo.settings.email_notifications",
  "bo.settings.inventory",
  "bo.settings.bank_account",
  "bo.customers",
  "bo.customers.list",
  "bo.customers.feedback",
  "bo.employees",
  "bo.employees.slots",
  "bo.employees.access",
  "bo.employees.pin_access",
  "bo.table_management",
  "bo.table_management.group",
  "bo.table_management.map",
  "bo.table_management.report",
  "bo.dashboard",
  "bo.reports",
  "bo.reports.sales",
  "bo.reports.transactions",
  "bo.reports.invoices",
  "bo.reports.shift",
  "bo.inventory",
  "bo.inventory.summary",
  "bo.inventory.suppliers",
  "bo.inventory.purchase_orders",
  "bo.inventory.transfer",
  "bo.inventory.adjustments",
  "bo.inventory.sync_logs",
] as const;

export const POS_APP_PERMISSION_TREE: PosPermissionNode[] = [
  {
    key: "app.pos.charge",
    labelKey: "employeesStaff.perm.app.charge",
    labelFallback: "Charge Customers",
    descriptionKey: "employeesStaff.perm.app.chargeHint",
    descriptionFallback: "Required to complete transactions",
  },
  {
    key: "app.pos.manage_open_bills",
    labelKey: "employeesStaff.perm.app.openBills",
    labelFallback: "Manage All Open Bills",
    descriptionKey: "employeesStaff.perm.app.openBillsHint",
    descriptionFallback: "Required to complete transactions",
  },
  {
    key: "app.pos.discounts",
    labelKey: "employeesStaff.perm.app.discounts",
    labelFallback: "Manage Discounts",
  },
  {
    key: "app.pos.refunds",
    labelKey: "employeesStaff.perm.app.refunds",
    labelFallback: "Issue Refunds",
  },
  {
    key: "app.pos.void_cancel",
    labelKey: "employeesStaff.perm.app.voidCancel",
    labelFallback: "Cancel / Void Items",
  },
  {
    key: "app.pos.resend_receipt",
    labelKey: "employeesStaff.perm.app.resendReceipt",
    labelFallback: "Resend Receipts",
  },
  {
    key: "app.shift.view_print",
    labelKey: "employeesStaff.perm.app.shiftView",
    labelFallback: "View and Print Current Shift Details",
    descriptionKey: "employeesStaff.perm.app.shiftViewHint",
    descriptionFallback: "Allow employees to view expected ending amounts and print current shifts",
  },
  {
    key: "app.shift.cash_movement",
    labelKey: "employeesStaff.perm.app.cashMovement",
    labelFallback: "Cash In / Cash Out",
  },
  {
    key: "app.settings.view",
    labelKey: "employeesStaff.perm.app.settingsView",
    labelFallback: "View Settings",
  },
  {
    key: "app.settings.edit",
    labelKey: "employeesStaff.perm.app.settingsEdit",
    labelFallback: "Edit Settings",
  },
  {
    key: "app.customers.edit",
    labelKey: "employeesStaff.perm.app.customersEdit",
    labelFallback: "Edit Customer Information",
  },
  {
    key: "app.table_map",
    labelKey: "employeesStaff.perm.app.tableMap",
    labelFallback: "Table Map",
  },
  {
    key: "app.online_orders",
    labelKey: "employeesStaff.perm.app.onlineOrders",
    labelFallback: "Online Orders",
    soon: true,
  },
  {
    key: "app.inventory",
    labelKey: "employeesStaff.perm.app.inventory",
    labelFallback: "Inventory (App)",
    soon: true,
  },
];

export const POS_BACKOFFICE_PERMISSION_TREE: PosPermissionNode[] = [
  {
    key: "bo.library",
    labelKey: "employeesStaff.perm.bo.library",
    labelFallback: "Manage Library",
    children: [
      { key: "bo.library.products", labelKey: "employeesStaff.perm.bo.libraryProducts", labelFallback: "Item / Product Library" },
      { key: "bo.library.bundles", labelKey: "employeesStaff.perm.bo.libraryBundles", labelFallback: "Bundle Package" },
      { key: "bo.library.categories", labelKey: "employeesStaff.perm.bo.libraryCategories", labelFallback: "Item Categories" },
      { key: "bo.library.brands", labelKey: "employeesStaff.perm.bo.libraryBrands", labelFallback: "Brands" },
      { key: "bo.library.modifiers", labelKey: "employeesStaff.perm.bo.libraryModifiers", labelFallback: "Modifiers" },
      { key: "bo.library.promos", labelKey: "employeesStaff.perm.bo.libraryPromos", labelFallback: "Promos" },
      { key: "bo.library.discounts", labelKey: "employeesStaff.perm.bo.libraryDiscounts", labelFallback: "Discounts" },
      { key: "bo.library.sales_types", labelKey: "employeesStaff.perm.bo.librarySalesTypes", labelFallback: "Sales Types" },
      { key: "bo.library.taxes", labelKey: "employeesStaff.perm.bo.libraryTaxes", labelFallback: "Taxes" },
      { key: "bo.library.gratuity", labelKey: "employeesStaff.perm.bo.libraryGratuity", labelFallback: "Gratuity" },
    ],
  },
  {
    key: "bo.ingredient",
    labelKey: "employeesStaff.perm.bo.ingredient",
    labelFallback: "Manage Ingredients",
    children: [
      { key: "bo.ingredient.list", labelKey: "employeesStaff.perm.bo.ingredientList", labelFallback: "Ingredient Library" },
      { key: "bo.ingredient.categories", labelKey: "employeesStaff.perm.bo.ingredientCategories", labelFallback: "Ingredient Categories" },
      { key: "bo.ingredient.recipes", labelKey: "employeesStaff.perm.bo.ingredientRecipes", labelFallback: "Recipes" },
    ],
  },
  {
    key: "bo.settings",
    labelKey: "employeesStaff.perm.bo.settings",
    labelFallback: "Manage Account Settings",
    children: [
      { key: "bo.settings.outlets", labelKey: "employeesStaff.perm.bo.settingsOutlets", labelFallback: "Outlets" },
      { key: "bo.settings.checkout", labelKey: "employeesStaff.perm.bo.settingsCheckout", labelFallback: "Checkout" },
      { key: "bo.settings.receipt", labelKey: "employeesStaff.perm.bo.settingsReceipt", labelFallback: "Receipts" },
      { key: "bo.settings.email_notifications", labelKey: "employeesStaff.perm.bo.settingsEmail", labelFallback: "Email Notifications" },
      { key: "bo.settings.inventory", labelKey: "employeesStaff.perm.bo.settingsInventory", labelFallback: "Inventory Settings" },
      { key: "bo.settings.bank_account", labelKey: "employeesStaff.perm.bo.settingsBankAccount", labelFallback: "Bank Account" },
    ],
  },
  {
    key: "bo.customers",
    labelKey: "employeesStaff.perm.bo.customers",
    labelFallback: "Manage Customers",
    children: [
      { key: "bo.customers.list", labelKey: "employeesStaff.perm.bo.customersList", labelFallback: "Customer List" },
      { key: "bo.customers.feedback", labelKey: "employeesStaff.perm.bo.customersFeedback", labelFallback: "Feedback" },
    ],
  },
  {
    key: "bo.employees",
    labelKey: "employeesStaff.perm.bo.employees",
    labelFallback: "Manage Employees",
    children: [
      { key: "bo.employees.slots", labelKey: "employeesStaff.perm.bo.employeesSlots", labelFallback: "Employee Slots" },
      { key: "bo.employees.access", labelKey: "employeesStaff.perm.bo.employeesAccess", labelFallback: "Employee Access" },
      { key: "bo.employees.pin_access", labelKey: "employeesStaff.perm.bo.employeesPin", labelFallback: "PIN Access" },
    ],
  },
  {
    key: "bo.table_management",
    labelKey: "employeesStaff.perm.bo.tableManagement",
    labelFallback: "Table Management",
    children: [
      {
        key: "bo.table_management.group",
        labelKey: "employeesStaff.perm.bo.tableGroup",
        labelFallback: "Table Group",
      },
      {
        key: "bo.table_management.map",
        labelKey: "employeesStaff.perm.bo.tableMap",
        labelFallback: "Table Map",
      },
      {
        key: "bo.table_management.report",
        labelKey: "employeesStaff.perm.bo.tableReport",
        labelFallback: "Table Report",
      },
    ],
  },
  {
    key: "bo.dashboard",
    labelKey: "employeesStaff.perm.bo.dashboard",
    labelFallback: "Dashboard",
  },
  {
    key: "bo.reports",
    labelKey: "employeesStaff.perm.bo.reports",
    labelFallback: "Reports",
    children: [
      {
        key: "bo.reports.sales",
        labelKey: "employeesStaff.perm.bo.reportsSales",
        labelFallback: "Sales",
      },
      {
        key: "bo.reports.transactions",
        labelKey: "employeesStaff.perm.bo.reportsTransactions",
        labelFallback: "Transactions",
      },
      {
        key: "bo.reports.invoices",
        labelKey: "employeesStaff.perm.bo.reportsInvoices",
        labelFallback: "Invoices",
      },
      {
        key: "bo.reports.shift",
        labelKey: "employeesStaff.perm.bo.reportsShift",
        labelFallback: "Shift",
      },
    ],
  },
  {
    key: "bo.inventory",
    labelKey: "employeesStaff.perm.bo.inventory",
    labelFallback: "Manage Inventory",
    children: [
      { key: "bo.inventory.summary", labelKey: "employeesStaff.perm.bo.inventorySummary", labelFallback: "Inventory Summary" },
      { key: "bo.inventory.suppliers", labelKey: "employeesStaff.perm.bo.inventorySuppliers", labelFallback: "Suppliers" },
      { key: "bo.inventory.purchase_orders", labelKey: "employeesStaff.perm.bo.inventoryPo", labelFallback: "Purchase Orders (PO)" },
      { key: "bo.inventory.transfer", labelKey: "employeesStaff.perm.bo.inventoryTransfer", labelFallback: "View Transfer" },
      { key: "bo.inventory.adjustments", labelKey: "employeesStaff.perm.bo.inventoryAdjustments", labelFallback: "Adjustments" },
      { key: "bo.inventory.sync_logs", labelKey: "employeesStaff.perm.bo.inventorySync", labelFallback: "Sync Logs" },
    ],
  },
];

export function flattenPermissionKeys(nodes: PosPermissionNode[]): string[] {
  const out: string[] = [];
  const walk = (list: PosPermissionNode[]) => {
    for (const n of list) {
      out.push(n.key);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

export function isAppPermissionKey(key: string): boolean {
  return key.startsWith("app.");
}

export function isBackofficePermissionKey(key: string): boolean {
  return key.startsWith("bo.");
}

/** Map top-level Office POS nav path prefixes to permission keys. */
export const POS_BACKOFFICE_NAV_PERMISSION: Record<string, string> = {
  "/operations/library": "bo.library",
  "/operations/ingredient": "bo.ingredient",
  "/operations/settings": "bo.settings",
  "/operations/customers-list": "bo.customers",
  "/operations/customers-feedback": "bo.customers",
  "/operations/employees-staff": "bo.employees",
  "/operations/table-management": "bo.table_management",
  "/operations/dashboard": "bo.dashboard",
  "/operations/reports": "bo.reports",
  "/operations/inventory": "bo.inventory",
};

export const POS_BACKOFFICE_PATH_PERMISSION: Array<{ prefix: string; key: string }> = [
  { prefix: "/operations/library", key: "bo.library" },
  { prefix: "/operations/ingredient", key: "bo.ingredient" },
  { prefix: "/operations/settings/outlets-list", key: "bo.settings.outlets" },
  { prefix: "/operations/settings/checkout", key: "bo.settings.checkout" },
  { prefix: "/operations/settings/receipt", key: "bo.settings.receipt" },
  { prefix: "/operations/settings/email-notifications", key: "bo.settings.email_notifications" },
  { prefix: "/operations/settings/inventory", key: "bo.settings.inventory" },
  { prefix: "/operations/settings/bank-account", key: "bo.settings.bank_account" },
  { prefix: "/operations/settings", key: "bo.settings" },
  { prefix: "/operations/customers-list", key: "bo.customers.list" },
  { prefix: "/operations/customers-feedback", key: "bo.customers.feedback" },
  { prefix: "/operations/employees-staff/slots", key: "bo.employees.slots" },
  { prefix: "/operations/employees-staff/access", key: "bo.employees.access" },
  { prefix: "/operations/employees-staff/pin-access", key: "bo.employees.pin_access" },
  { prefix: "/operations/employees-staff", key: "bo.employees" },
  { prefix: "/operations/table-management/group", key: "bo.table_management.group" },
  { prefix: "/operations/table-management/map", key: "bo.table_management.map" },
  { prefix: "/operations/table-management/report", key: "bo.table_management.report" },
  { prefix: "/operations/table-management", key: "bo.table_management" },
  { prefix: "/operations/dashboard", key: "bo.dashboard" },
  { prefix: "/operations/reports/sales", key: "bo.reports.sales" },
  { prefix: "/operations/reports/transactions", key: "bo.reports.transactions" },
  { prefix: "/operations/reports/invoices", key: "bo.reports.invoices" },
  { prefix: "/operations/reports/shift", key: "bo.reports.shift" },
  { prefix: "/operations/reports", key: "bo.reports" },
  { prefix: "/operations/inventory", key: "bo.inventory" },
];

export function resolveBackofficePermissionForPath(pathname: string): string | null {
  const path = pathname.toLowerCase();
  let best: { key: string; len: number } | null = null;
  for (const row of POS_BACKOFFICE_PATH_PERMISSION) {
    const p = row.prefix.toLowerCase();
    if (path === p || path.startsWith(`${p}/`)) {
      if (!best || p.length > best.len) best = { key: row.key, len: p.length };
    }
  }
  return best?.key ?? null;
}
