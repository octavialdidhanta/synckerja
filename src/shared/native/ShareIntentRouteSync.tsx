import { useCallback, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { ShareIntent } from "@/plugins/share-intent";
import { supabase } from "@/shared/lib/supabaseClient";
import { useAuth } from "@/shared/auth/contexts/AuthContext";
import { SHARE_RECEIPT_VALIDATION_PATH } from "@/shared/native/shareReceiptValidationPath";

/**
 * Native Android: when the app receives a gallery/files share, navigate to receipt validation
 * if there is a pending payload and an authenticated session (avoids /login loop).
 */
export function ShareIntentRouteSync() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathnameRef = useRef(location.pathname);
  pathnameRef.current = location.pathname;

  const { user, loading: authLoading } = useAuth();

  const maybeNavigateToShareValidation = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;

    const { files } = await ShareIntent.getPendingPayload();
    if (!files.length) return;
    if (pathnameRef.current === SHARE_RECEIPT_VALIDATION_PATH) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    navigate(SHARE_RECEIPT_VALIDATION_PATH, { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let handle: { remove: () => Promise<void> } | undefined;

    void ShareIntent.addListener("shareIntentReceived", () => {
      void maybeNavigateToShareValidation();
    }).then((h) => {
      handle = h;
    });

    return () => {
      void handle?.remove();
    };
  }, [maybeNavigateToShareValidation]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (authLoading) return;
    if (!user) return;
    void maybeNavigateToShareValidation();
  }, [authLoading, user?.id, maybeNavigateToShareValidation]);

  return null;
}
