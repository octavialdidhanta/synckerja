import {
  isAppPermissionKey,
  isBackofficePermissionKey,
} from "./posAccessPermissionCatalog";

export type PosAccessSurface = "app_and_backoffice" | "app_only" | "backoffice_only" | "none";

export function formatPosAccessSurface(keys: string[]): PosAccessSurface {
  const hasApp = keys.some(isAppPermissionKey);
  const hasBo = keys.some(isBackofficePermissionKey);
  if (hasApp && hasBo) return "app_and_backoffice";
  if (hasApp) return "app_only";
  if (hasBo) return "backoffice_only";
  return "none";
}

export function countPosPrivileges(keys: string[]): number {
  return new Set(keys).size;
}
