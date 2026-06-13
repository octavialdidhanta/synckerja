export const TIKTOK_SHOP_BASE_PATH = "/operations/sales/tiktok-shop";
export const TIKTOK_SHOP_DASHBOARD_PATH = TIKTOK_SHOP_BASE_PATH;
export const TIKTOK_SHOP_SETTINGS_PATH = "/operations/sales/tiktok-shop/settings";
export const TIKTOK_SHOP_PRODUCTS_PATH = "/operations/sales/tiktok-shop/products";

/** @deprecated Redirect-only; OAuth may still return here for older sessions. */
export const TIKTOK_SHOP_LEGACY_BASE_PATH = "/digital-marketing/tiktok-shop";
export const TIKTOK_SHOP_LEGACY_SETTINGS_PATH = "/digital-marketing/tiktok-shop/settings";

export const TIKTOK_SHOP_PAGE_PATH = TIKTOK_SHOP_BASE_PATH;

export const TIKTOK_SHOP_OAUTH_RETURN_PATHS = [
  TIKTOK_SHOP_SETTINGS_PATH,
  TIKTOK_SHOP_LEGACY_SETTINGS_PATH,
] as const;

export type TikTokShopOAuthReturnPath = (typeof TIKTOK_SHOP_OAUTH_RETURN_PATHS)[number];

export function isTikTokShopSettingsPath(pathname: string): boolean {
  return (
    pathname === TIKTOK_SHOP_SETTINGS_PATH || pathname === TIKTOK_SHOP_LEGACY_SETTINGS_PATH
  );
}

export function isTikTokShopModulePath(pathname: string): boolean {
  return (
    pathname.startsWith(TIKTOK_SHOP_BASE_PATH) ||
    pathname.startsWith(TIKTOK_SHOP_LEGACY_BASE_PATH)
  );
}
