import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/shared/lib/supabaseClient";
import {
  GOOGLE_DRIVE_OAUTH_SUCCESS_MESSAGE_TYPE,
  GOOGLE_OAUTH_REFRESH_HINT_KEY,
} from "@/shared/lib/googleDriveOAuth";

/**
 * Whether Synckerja has stored Google OAuth credentials for the current user (Drive integration).
 * `null` = not loaded yet while `enabled` (e.g. dialog open).
 */
export function useGoogleDriveOAuthConnection(enabled: boolean) {
  const [connected, setConnected] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke<{ connected?: boolean; error?: string }>(
      "google-oauth-manage",
      { body: { action: "status" } },
    );
    if (error || data?.error) {
      setConnected(false);
      return;
    }
    setConnected(Boolean(data?.connected));
  }, []);

  useEffect(() => {
    if (!enabled) {
      setConnected(null);
      return;
    }
    setConnected(null);
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.functions.invoke<{ connected?: boolean; error?: string }>(
        "google-oauth-manage",
        { body: { action: "status" } },
      );
      if (cancelled) return;
      if (error || data?.error) {
        setConnected(false);
        return;
      }
      setConnected(Boolean(data?.connected));
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const onStorage = (e: StorageEvent) => {
      if (e.key === GOOGLE_OAUTH_REFRESH_HINT_KEY && e.newValue) {
        void refresh();
      }
    };

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === GOOGLE_DRIVE_OAUTH_SUCCESS_MESSAGE_TYPE) {
        void refresh();
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("message", onMessage);
    };
  }, [enabled, refresh]);

  const disconnect = useCallback(async (): Promise<{ ok: boolean; message?: string }> => {
    const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
      "google-oauth-manage",
      { body: { action: "disconnect" } },
    );
    if (error) {
      return { ok: false, message: error.message };
    }
    if (data?.error) {
      return { ok: false, message: data.error };
    }
    setConnected(false);
    return { ok: true };
  }, []);

  const pending = enabled && connected === null;

  return { connected, pending, refresh, disconnect };
}
