import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/features/1-login";
import { ShareIntent } from "@/plugins/share-intent";

/**
 * When the app opens from Android share with pending files, navigate authenticated users
 * to the receipt validation route.
 */
export function ShareIntentBootstrap() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user?.id) return;
    if (!Capacitor.isPluginAvailable("ShareIntent")) return;

    const goIfNeeded = async () => {
      try {
        const path = pathRef.current;
        const { files } = await ShareIntent.getPendingPayload();
        if (files.length === 0) return;
        if (path === "/share/receipt-validation") return;
        navigate("/share/receipt-validation", { replace: true });
      } catch {
        /* ignore */
      }
    };

    void goIfNeeded();

    let removeListener: (() => Promise<void>) | undefined;
    ShareIntent.addListener("shareIntentReceived", () => {
      void goIfNeeded();
    }).then((handle) => {
      removeListener = () => handle.remove();
    }).catch(() => {});

    return () => {
      void removeListener?.();
    };
  }, [user?.id, navigate]);

  return null;
}
