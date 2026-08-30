/** Canonical public routes for Synckerja POS auth funnel. */
export const POS_AUTH_PATHS = {
  welcome: "/pos",
  login: "/pos/login",
  loginPassword: "/pos/login/password",
  loginMfa: "/pos/login/mfa",
  register: "/pos/register",
  forgotPassword: "/pos/forgot-password",
  selectOutlet: "/pos/select-outlet",
  cashier: "/pos/cashier",
  tableMap: "/pos/table-map",
  orders: "/pos/orders",
  activity: "/pos/activity",
  inventory: "/pos/inventory",
  shift: "/pos/shift",
  settings: "/pos/settings",
  kitchen: "/pos/kitchen",
} as const;

/** Default post-auth land for a ready POS session (outlet gate before cashier). */
export const POS_POST_LOGIN_REDIRECT = POS_AUTH_PATHS.selectOutlet;

/**
 * Default land after outlet is chosen when caller does not resolve role capabilities.
 * Prefer `resolvePosPostOutletPath` for staff ACL-aware redirects.
 */
export const POS_AFTER_OUTLET_REDIRECT = POS_AUTH_PATHS.cashier;

export type PosAuthPath = (typeof POS_AUTH_PATHS)[keyof typeof POS_AUTH_PATHS];
