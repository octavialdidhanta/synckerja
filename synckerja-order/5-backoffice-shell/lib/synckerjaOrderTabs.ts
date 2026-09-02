export const SYNCKERJA_ORDER_BASE_PATH = "/operations/synckerja-order";
export const SYNCKERJA_ORDER_PROFILE_PATH = "/operations/synckerja-order/profile";
export const SYNCKERJA_ORDER_CONTACT_PATH = "/operations/synckerja-order/contact";
export const SYNCKERJA_ORDER_TERMS_PATH = "/operations/synckerja-order/terms";
export const SYNCKERJA_ORDER_OUTLETS_PATH = "/operations/synckerja-order/outlets";
export const SYNCKERJA_ORDER_HOURS_PATH = "/operations/synckerja-order/hours";
export const SYNCKERJA_ORDER_CATALOG_PATH = "/operations/synckerja-order/catalog";
export const SYNCKERJA_ORDER_QR_PATH = "/operations/synckerja-order/qr";

export type SynckerjaOrderSubTab =
  | "profile"
  | "contact"
  | "terms"
  | "outlets"
  | "hours"
  | "catalog"
  | "qr";

export function synckerjaOrderTabFromPathname(pathname: string): SynckerjaOrderSubTab {
  if (pathname.startsWith(SYNCKERJA_ORDER_CONTACT_PATH)) return "contact";
  if (pathname.startsWith(SYNCKERJA_ORDER_TERMS_PATH)) return "terms";
  if (pathname.startsWith(SYNCKERJA_ORDER_OUTLETS_PATH)) return "outlets";
  if (pathname.startsWith(SYNCKERJA_ORDER_HOURS_PATH)) return "hours";
  if (pathname.startsWith(SYNCKERJA_ORDER_CATALOG_PATH)) return "catalog";
  if (pathname.startsWith(SYNCKERJA_ORDER_QR_PATH)) return "qr";
  return "profile";
}

export function synckerjaOrderTabPath(tab: SynckerjaOrderSubTab): string {
  switch (tab) {
    case "contact":
      return SYNCKERJA_ORDER_CONTACT_PATH;
    case "terms":
      return SYNCKERJA_ORDER_TERMS_PATH;
    case "outlets":
      return SYNCKERJA_ORDER_OUTLETS_PATH;
    case "hours":
      return SYNCKERJA_ORDER_HOURS_PATH;
    case "catalog":
      return SYNCKERJA_ORDER_CATALOG_PATH;
    case "qr":
      return SYNCKERJA_ORDER_QR_PATH;
    default:
      return SYNCKERJA_ORDER_PROFILE_PATH;
  }
}

export function synckerjaOrderTabLocation(
  path: string,
  search: string,
): { pathname: string; search: string } {
  return { pathname: path, search };
}
