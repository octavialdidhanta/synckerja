export const BLIBLI_ORDERS_BASE_PATH = '/operations/sales/blibli-orders';
export const BLIBLI_ORDERS_PAGE_PATH = BLIBLI_ORDERS_BASE_PATH;
export const BLIBLI_ORDERS_SETTINGS_PATH = `${BLIBLI_ORDERS_BASE_PATH}/settings`;

export function isBlibliOrdersSettingsPath(pathname: string): boolean {
  return pathname === BLIBLI_ORDERS_SETTINGS_PATH || pathname.startsWith(`${BLIBLI_ORDERS_SETTINGS_PATH}/`);
}
