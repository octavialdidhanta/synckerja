export const CHECKOUT_INSUFFICIENT_INGREDIENT_STOCK =
  "store_checkout_insufficient_recipe_stock" as const;

export const CHECKOUT_INSUFFICIENT_PRODUCT_STOCK = "store_checkout_insufficient_stock" as const;

export const CATALOG_STOCK_INSUFFICIENT = "catalog_stock_insufficient" as const;

export type CheckoutPayStockErrorKind = "product" | "ingredient" | "catalog";

export class CheckoutStockError extends Error {
  readonly code: string;
  readonly ingredientName?: string;

  constructor(code: string, ingredientName?: string) {
    super(code);
    this.name = "CheckoutStockError";
    this.code = code;
    this.ingredientName = ingredientName?.trim() || undefined;
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "";
}

export function parseCheckoutPayStockError(err: unknown): {
  kind: CheckoutPayStockErrorKind;
  ingredientName?: string;
} | null {
  if (err instanceof CheckoutStockError) {
    if (err.code === CHECKOUT_INSUFFICIENT_INGREDIENT_STOCK) {
      return { kind: "ingredient", ingredientName: err.ingredientName };
    }
    if (err.code === CHECKOUT_INSUFFICIENT_PRODUCT_STOCK) {
      return { kind: "product" };
    }
    if (err.code === CATALOG_STOCK_INSUFFICIENT) {
      return { kind: "catalog" };
    }
  }

  const message = errorMessage(err);
  if (!message) return null;

  if (
    message === CHECKOUT_INSUFFICIENT_INGREDIENT_STOCK ||
    message.startsWith(`${CHECKOUT_INSUFFICIENT_INGREDIENT_STOCK}:`) ||
    message.includes(CHECKOUT_INSUFFICIENT_INGREDIENT_STOCK)
  ) {
    const prefix = `${CHECKOUT_INSUFFICIENT_INGREDIENT_STOCK}:`;
    const ingredientName = message.startsWith(prefix)
      ? message.slice(prefix.length).trim() || undefined
      : undefined;
    return { kind: "ingredient", ingredientName };
  }

  if (
    message === CHECKOUT_INSUFFICIENT_PRODUCT_STOCK ||
    message.includes(CHECKOUT_INSUFFICIENT_PRODUCT_STOCK)
  ) {
    return { kind: "product" };
  }

  if (message.includes(CATALOG_STOCK_INSUFFICIENT)) {
    return { kind: "catalog" };
  }

  return null;
}

/** @deprecated Use parseCheckoutPayStockError */
export function parseCheckoutStockError(err: unknown): {
  code: string;
  ingredientName?: string;
} | null {
  const parsed = parseCheckoutPayStockError(err);
  if (!parsed) return null;
  if (parsed.kind === "ingredient") {
    return {
      code: CHECKOUT_INSUFFICIENT_INGREDIENT_STOCK,
      ingredientName: parsed.ingredientName,
    };
  }
  if (parsed.kind === "product") {
    return { code: CHECKOUT_INSUFFICIENT_PRODUCT_STOCK };
  }
  return { code: CATALOG_STOCK_INSUFFICIENT };
}
