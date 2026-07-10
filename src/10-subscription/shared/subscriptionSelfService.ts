/** Paths under the subscription module hidden when self-service is disabled (sales tenants). */
export const SUBSCRIPTION_MODULE_PATHS = [
  "/subscription",
  "/subscription/overview",
  "/subscription/plans",
  "/subscription/management",
] as const;

export function isSubscriptionModulePath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return SUBSCRIPTION_MODULE_PATHS.some(
    (route) => normalized === route || normalized.startsWith(`${route}/`),
  );
}

/** Default true when org flag is unknown (DB default + fail-open during bootstrap). */
export function isSubscriptionSelfServiceEnabled(
  enabled: boolean | null | undefined,
): boolean {
  return enabled !== false;
}
