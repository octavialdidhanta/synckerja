/**
 * Maps mobile shortcut routes to the permission path checked by PageAccessGuard (see App.tsx).
 */
const MOBILE_PERMISSION_PATH: Record<string, string> = {
  "/schedule": "/operations/sales",
  "/client-visit": "/operations/sales",
};

/** Routes that skip the permission matrix entirely (`requiresPermissions={false}`). */
const PERMISSION_EXEMPT_PATHS = new Set(["/reports", "/profile"]);

function normalizeNavPath(navPath: string): string {
  const pathname = navPath.split("?")[0]?.trim().toLowerCase() ?? "/";
  const withoutTrailing = pathname.replace(/\/+$/, "");
  return withoutTrailing || "/";
}

export function resolvePermissionPath(navPath: string): string {
  const normalized = normalizeNavPath(navPath);
  return MOBILE_PERMISSION_PATH[normalized] ?? normalized;
}

export function isPermissionExemptNavPath(navPath: string): boolean {
  return PERMISSION_EXEMPT_PATHS.has(normalizeNavPath(navPath));
}
