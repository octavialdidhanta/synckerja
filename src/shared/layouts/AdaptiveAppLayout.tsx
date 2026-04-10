import { Outlet, useLocation } from "react-router-dom";
import { AppShellLayout } from "@/shared/layouts/AppShellLayout";
import { useAuthSurface } from "@/shared/hooks/useAuthSurface";

/** Bottom-nav parity routes render full-screen chrome inside the page (no desktop AppHeader / sidebar). */
const MOBILE_MAIN_TAB_PATHS = new Set([
  "/",
  "/schedule",
  "/client-visit",
  "/reports",
  "/profile",
]);

export function AdaptiveAppLayout() {
  const { isDesktop } = useAuthSurface();
  const { pathname } = useLocation();

  const isMobileExpensesPath = pathname === "/expenses" || pathname.startsWith("/expenses/");

  if (!isDesktop && (MOBILE_MAIN_TAB_PATHS.has(pathname) || isMobileExpensesPath)) {
    return <Outlet />;
  }

  return <AppShellLayout />;
}
