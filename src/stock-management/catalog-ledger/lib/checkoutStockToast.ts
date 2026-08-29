import { trackedStoreCheckoutLines } from "@/5-2-customer-visits/checkout/lib/storeCheckoutStock";
import {
  parseCheckoutPayStockError,
  type CheckoutPayStockErrorKind,
} from "./checkoutStockErrors";

export type CheckoutStockToastContext = {
  lines?: Array<{
    kind?: string | null;
    trackStock?: boolean | null;
    label?: string;
    serviceName?: string;
    availableQty?: number | null;
    quantity?: number;
    inventorySkuId?: string | null;
  }>;
  /** When true, append rollback hint for post-pay stock/income failures. */
  includeRollbackHint?: boolean;
};

type TranslateFn = (
  key: string,
  defaultValue: string,
  params?: Record<string, string | number>,
) => string;

function firstInsufficientProductLine(ctx?: CheckoutStockToastContext) {
  if (!ctx?.lines?.length) return null;
  const tracked = trackedStoreCheckoutLines(
    ctx.lines.map((line) => ({
      kind: line.kind,
      trackStock: line.trackStock,
      inventorySkuId: line.inventorySkuId ?? null,
      quantity: line.quantity ?? 0,
      availableQty: line.availableQty,
      label: line.label ?? line.serviceName,
    })),
  );
  return tracked[0] ?? null;
}

export function resolveCheckoutStockToastKind(err: unknown): CheckoutPayStockErrorKind | null {
  return parseCheckoutPayStockError(err)?.kind ?? null;
}

export function resolveCheckoutStockToast(
  err: unknown,
  t: TranslateFn,
  ctx?: CheckoutStockToastContext,
): { title: string; description?: string } | null {
  const parsed = parseCheckoutPayStockError(err);
  if (!parsed) return null;

  if (parsed.kind === "ingredient") {
    return {
      title: t(
        "checkout.errors.insufficientRecipeStock",
        "Not enough ingredient stock for this order.",
      ),
      description: parsed.ingredientName
        ? t(
            "checkout.errors.insufficientRecipeStockDetail",
            "{{name}} is short for this order.",
            { name: parsed.ingredientName },
          )
        : t(
            "checkout.errors.insufficientRecipeStock",
            "Not enough ingredient stock for this order.",
          ),
    };
  }

  if (parsed.kind === "product") {
    const line = firstInsufficientProductLine(ctx);
    return {
      title: t("customerVisits.toast.insufficientStockTitle", "Not enough stock"),
      description: t(
        "customerVisits.checkout.insufficientStock",
        "{{name}} only has {{qty}} left.",
        {
          name: line?.label || t("customerVisits.checkout.products", "Products"),
          qty: Number.isFinite(Number(line?.availableQty)) ? Number(line?.availableQty) : 0,
        },
      ),
    };
  }

  return {
    title: t(
      "checkout.errors.insufficientCatalogStock",
      "Not enough stock to complete this order.",
    ),
    description: ctx?.includeRollbackHint
      ? t(
          "customerVisits.toast.checkoutIncomeFailed",
          "Payment was not saved. The receipt was rolled back.",
        )
      : undefined,
  };
}

export type CheckoutCheckoutFailureToast = {
  title: string;
  description?: string;
};

export function resolveCheckoutFailureToast(
  err: unknown,
  t: TranslateFn,
  ctx?: CheckoutStockToastContext & {
    incomeErrorCode?: string | null;
    message?: string;
  },
): CheckoutCheckoutFailureToast {
  const stockToast = resolveCheckoutStockToast(err, t, ctx);
  if (stockToast) return stockToast;

  const message = ctx?.message ?? (err instanceof Error ? err.message : "");
  if (message === "store_checkout_already_paid") {
    return {
      title: t("customerVisits.toast.alreadyPaidTitle", "Already paid"),
      description: t(
        "customerVisits.toast.alreadyPaidDescription",
        "This visit already has a receipt. Checkout was not started again.",
      ),
    };
  }

  if (ctx?.incomeErrorCode === "store_checkout_omnichannel_bank_missing") {
    return {
      title: t("customerVisits.toast.checkoutErrorTitle", "Could not record payment"),
      description: t(
        "customerVisits.toast.checkoutBankMissing",
        "Set an omnichannel income bank account before taking store payments.",
      ),
    };
  }

  return {
    title: t("customerVisits.toast.checkoutErrorTitle", "Could not record payment"),
    description: t(
      "customerVisits.toast.checkoutIncomeFailed",
      "Payment was not saved. The receipt was rolled back.",
    ),
  };
}

export function resolvePosPayFailureToast(
  err: unknown,
  t: TranslateFn,
  ctx?: CheckoutStockToastContext,
): CheckoutCheckoutFailureToast | null {
  const stockToast = resolveCheckoutStockToast(err, t, ctx);
  if (stockToast) return stockToast;
  return null;
}
