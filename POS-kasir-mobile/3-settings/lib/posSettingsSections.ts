import { POS_SETTINGS_I18N } from "./posSettingsCopy";

export type PosSettingsSectionId =
  | "online-orders"
  | "payment"
  | "tax"
  | "surcharge"
  | "payment-settings"
  | "printer"
  | "barcode-scanner"
  | "gobiz-edc"
  | "customer-display"
  | "kitchen-display"
  | "language"
  | "profile"
  | "support";

export type PosSettingsNavItem = {
  id: PosSettingsSectionId;
  sectionKey: string;
  sectionFallback: string;
  labelKey: string;
  labelFallback: string;
  panelTitleKey: string;
  panelTitleFallback: string;
  /** When set, show status text on the right (e.g. Aktif). */
  statusKey?: string;
  statusFallback?: string;
};

/** Master–detail nav model for `/pos/settings`. */
export const POS_SETTINGS_NAV: readonly PosSettingsNavItem[] = [
  {
    id: "online-orders",
    sectionKey: POS_SETTINGS_I18N.sectionOnlineOrders,
    sectionFallback: "Online Orders",
    labelKey: POS_SETTINGS_I18N.navOnlineOrderSettings,
    labelFallback: "Online Order Settings",
    panelTitleKey: POS_SETTINGS_I18N.onlineOrdersTitle,
    panelTitleFallback: "Online Order Settings",
  },
  {
    id: "payment",
    sectionKey: POS_SETTINGS_I18N.sectionPayment,
    sectionFallback: "Payment",
    labelKey: POS_SETTINGS_I18N.navPayment,
    labelFallback: "Payment",
    panelTitleKey: POS_SETTINGS_I18N.paymentTitle,
    panelTitleFallback: "Payment",
  },
  {
    id: "tax",
    sectionKey: POS_SETTINGS_I18N.sectionPayment,
    sectionFallback: "Payment",
    labelKey: POS_SETTINGS_I18N.navTax,
    labelFallback: "Tax",
    panelTitleKey: POS_SETTINGS_I18N.taxTitle,
    panelTitleFallback: "Tax",
  },
  {
    id: "surcharge",
    sectionKey: POS_SETTINGS_I18N.sectionPayment,
    sectionFallback: "Payment",
    labelKey: POS_SETTINGS_I18N.navSurcharge,
    labelFallback: "Additional Fees",
    panelTitleKey: POS_SETTINGS_I18N.surchargeTitle,
    panelTitleFallback: "Additional Fees",
  },
  {
    id: "payment-settings",
    sectionKey: POS_SETTINGS_I18N.sectionPayment,
    sectionFallback: "Payment",
    labelKey: POS_SETTINGS_I18N.navPaymentSettings,
    labelFallback: "Payment Settings",
    panelTitleKey: POS_SETTINGS_I18N.paymentSettingsTitle,
    panelTitleFallback: "Payment Settings",
  },
  {
    id: "printer",
    sectionKey: POS_SETTINGS_I18N.sectionHardware,
    sectionFallback: "Hardware",
    labelKey: POS_SETTINGS_I18N.navPrinter,
    labelFallback: "Printer",
    panelTitleKey: POS_SETTINGS_I18N.printerTitle,
    panelTitleFallback: "Printer",
  },
  {
    id: "barcode-scanner",
    sectionKey: POS_SETTINGS_I18N.sectionHardware,
    sectionFallback: "Hardware",
    labelKey: POS_SETTINGS_I18N.navBarcodeScanner,
    labelFallback: "Barcode Scanner",
    panelTitleKey: POS_SETTINGS_I18N.barcodeScannerTitle,
    panelTitleFallback: "Barcode Scanner",
  },
  {
    id: "gobiz-edc",
    sectionKey: POS_SETTINGS_I18N.sectionHardware,
    sectionFallback: "Hardware",
    labelKey: POS_SETTINGS_I18N.navGobizEdc,
    labelFallback: "GoBiz PLUS EDC",
    panelTitleKey: POS_SETTINGS_I18N.gobizEdcTitle,
    panelTitleFallback: "GoBiz PLUS EDC",
  },
  {
    id: "customer-display",
    sectionKey: POS_SETTINGS_I18N.sectionHardware,
    sectionFallback: "Hardware",
    labelKey: POS_SETTINGS_I18N.navCustomerDisplay,
    labelFallback: "Customer Display",
    panelTitleKey: POS_SETTINGS_I18N.customerDisplayTitle,
    panelTitleFallback: "Customer Display",
  },
  {
    id: "kitchen-display",
    sectionKey: POS_SETTINGS_I18N.sectionHardware,
    sectionFallback: "Hardware",
    labelKey: POS_SETTINGS_I18N.navKitchenDisplay,
    labelFallback: "Kitchen Display System",
    panelTitleKey: POS_SETTINGS_I18N.kitchenDisplayTitle,
    panelTitleFallback: "Kitchen Display System",
  },
  {
    id: "language",
    sectionKey: POS_SETTINGS_I18N.sectionAccount,
    sectionFallback: "Account",
    labelKey: POS_SETTINGS_I18N.navLanguage,
    labelFallback: "Language",
    panelTitleKey: POS_SETTINGS_I18N.languageTitle,
    panelTitleFallback: "Language",
  },
  {
    id: "profile",
    sectionKey: POS_SETTINGS_I18N.sectionAccount,
    sectionFallback: "Account",
    labelKey: POS_SETTINGS_I18N.navProfile,
    labelFallback: "Profile",
    panelTitleKey: POS_SETTINGS_I18N.profileTitle,
    panelTitleFallback: "Profile",
  },
  {
    id: "support",
    sectionKey: POS_SETTINGS_I18N.sectionAccount,
    sectionFallback: "Account",
    labelKey: POS_SETTINGS_I18N.navSupport,
    labelFallback: "Help",
    panelTitleKey: POS_SETTINGS_I18N.supportTitle,
    panelTitleFallback: "Help",
  },
] as const;

export const DEFAULT_POS_SETTINGS_SECTION: PosSettingsSectionId = "online-orders";

const SECTION_IDS: readonly PosSettingsSectionId[] = [
  "online-orders",
  "payment",
  "tax",
  "surcharge",
  "payment-settings",
  "printer",
  "barcode-scanner",
  "gobiz-edc",
  "customer-display",
  "kitchen-display",
  "language",
  "profile",
  "support",
];

export function parsePosSettingsSection(raw: string | null): PosSettingsSectionId {
  if (raw && (SECTION_IDS as readonly string[]).includes(raw)) {
    return raw as PosSettingsSectionId;
  }
  return DEFAULT_POS_SETTINGS_SECTION;
}

export function getPosSettingsNavItem(id: PosSettingsSectionId): PosSettingsNavItem {
  return POS_SETTINGS_NAV.find((item) => item.id === id) ?? POS_SETTINGS_NAV[0];
}
