import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { isNativeCapacitorAuth, parseNativeSsoCallbackUrl } from "@/0-auth/lib/ssoRedirectUrl";

/**
 * Handles Supabase Google OAuth deep links on Capacitor (Android/iOS).
 * OAuth opens in system browser / Custom Tab; redirect returns via app URL scheme.
 */
export function NativeSupabaseOAuthBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativeCapacitorAuth()) {
      return;
    }

    const handleUrl = (url: string) => {
      const parsed = parseNativeSsoCallbackUrl(url);
      if (!parsed) {
        return;
      }

      void Browser.close().catch(() => undefined);

      const target = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      navigate(target, { replace: true });
    };

    let listenerRemove: (() => void) | undefined;

    void App.addListener("appUrlOpen", (event) => {
      handleUrl(event.url);
    }).then((handle) => {
      listenerRemove = () => {
        void handle.remove();
      };
    });

    void App.getLaunchUrl().then((launch) => {
      if (launch?.url) {
        handleUrl(launch.url);
      }
    });

    return () => {
      listenerRemove?.();
    };
  }, [navigate]);

  return null;
}
