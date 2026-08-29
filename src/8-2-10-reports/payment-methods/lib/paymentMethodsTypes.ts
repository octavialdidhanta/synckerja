export type PaymentMethodCategory =
  | "cash"
  | "qris"
  | "e_wallet"
  | "edc"
  | "e_commerce"
  | "integration"
  | "other";

export const PAYMENT_METHOD_CATEGORY_ORDER: PaymentMethodCategory[] = [
  "cash",
  "qris",
  "e_wallet",
  "edc",
  "e_commerce",
  "integration",
  "other",
];

export type PaymentMethodChannelRow = {
  channelId: string | null;
  channelName: string;
  channelSlug: string;
  category: PaymentMethodCategory;
  transactionCount: number;
  totalCollected: number;
};

export type PaymentMethodsSummary = {
  totalCollected: number;
  transactionCount: number;
};

export type PaymentMethodsCategoryBlock = {
  category: PaymentMethodCategory;
  channels: PaymentMethodChannelRow[];
  transactionCount: number;
  totalCollected: number;
  hasActiveChannels: boolean;
};

export type PaymentMethodsDisplay = {
  categories: PaymentMethodsCategoryBlock[];
  grandTotal: PaymentMethodsSummary;
  summaryTotalCollected: number;
  summaryTransactionCount: number;
  matchesSummary: boolean;
};

export type PaymentMethodChannelConfig = {
  id: string;
  organizationId: string;
  posOutletId: string | null;
  category: PaymentMethodCategory;
  name: string;
  slug: string;
  legacyPaymentMethod: string | null;
  isActive: boolean;
  sortOrder: number;
};

export const EMPTY_PAYMENT_METHODS_DISPLAY: PaymentMethodsDisplay = {
  categories: [],
  grandTotal: { totalCollected: 0, transactionCount: 0 },
  summaryTotalCollected: 0,
  summaryTransactionCount: 0,
  matchesSummary: true,
};
