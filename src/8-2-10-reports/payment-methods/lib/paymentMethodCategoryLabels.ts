import type { PaymentMethodCategory } from "./paymentMethodsTypes";

export const PAYMENT_METHOD_CATEGORY_I18N: Record<
  PaymentMethodCategory,
  { key: string; fallback: string }
> = {
  cash: { key: "reports.paymentMethods.category.cash", fallback: "Cash" },
  qris: { key: "reports.paymentMethods.category.qris", fallback: "QRIS" },
  e_wallet: { key: "reports.paymentMethods.category.eWallet", fallback: "E-Wallet" },
  edc: { key: "reports.paymentMethods.category.edc", fallback: "EDC" },
  e_commerce: {
    key: "reports.paymentMethods.category.eCommerce",
    fallback: "E-Commerce",
  },
  integration: {
    key: "reports.paymentMethods.category.integration",
    fallback: "Integration",
  },
  other: { key: "reports.paymentMethods.category.other", fallback: "Other" },
};
