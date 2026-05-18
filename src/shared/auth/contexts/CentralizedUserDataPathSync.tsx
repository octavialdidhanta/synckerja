import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/shared/auth/contexts/AuthContext";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";

const AUTH_PATHS = new Set(["/login", "/register", "/verify-email"]);

function isAuthPath(pathname: string) {
  return AUTH_PATHS.has(pathname);
}

/**
 * Provider sits above BrowserRouter; this syncs route changes into profile fetch
 * (e.g. post-login navigate /login → / with forceRefreshUserData).
 */
export function CentralizedUserDataPathSync() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { userData, refreshUserData } = useCentralizedUserData();
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    if (!user?.id) {
      prevPathRef.current = pathname;
      return;
    }

    const prevPath = prevPathRef.current;
    prevPathRef.current = pathname;

    const leftAuthScreen = isAuthPath(prevPath) && !isAuthPath(pathname);
    let forceRefresh = false;
    try {
      forceRefresh = sessionStorage.getItem("forceRefreshUserData") === "1";
    } catch {
      forceRefresh = false;
    }

    const needsProfileOnAppRoute = !isAuthPath(pathname) && !userData;

    if (forceRefresh || leftAuthScreen || needsProfileOnAppRoute) {
      void refreshUserData();
    }
  }, [pathname, user?.id, userData, refreshUserData]);

  return null;
}
