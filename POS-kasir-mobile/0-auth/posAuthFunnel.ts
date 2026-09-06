/**
 * POS auth funnel chunk entry (legacy named exports).
 * Prefer lazy-loading {@link ./PosAuthFunnelApp} as the single Suspense boundary.
 */
export { default as PosAuthFunnelApp } from "./PosAuthFunnelApp";
export { PosAuthFunnelLayout } from "./layout/PosAuthFunnelLayout";
export { default as PosWelcomePage } from "../0-welcome/pages/PosWelcomePage";
export { default as PosLoginPage } from "./pages/PosLoginPage";
export { default as PosLoginPasswordPage } from "./pages/PosLoginPasswordPage";
export { default as PosMfaVerifyPage } from "./pages/PosMfaVerifyPage";
export { default as PosRegisterPage } from "./pages/PosRegisterPage";
export { default as PosForgotPasswordPage } from "./pages/PosForgotPasswordPage";
export { default as PosSelectOutletPage } from "../1-outlet-select/pages/PosSelectOutletPage";
