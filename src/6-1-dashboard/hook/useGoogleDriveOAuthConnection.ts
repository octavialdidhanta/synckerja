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
  const [needsReconnect, setNeedsReconnect] = useState(false);

  const applyStatus = useCallback(
    (data: { connected?: boolean; needsReconnect?: boolean } | null | undefined) => {
      setConnected(Boolean(data?.connected));
      setNeedsReconnect(Boolean(data?.connected && data?.needsReconnect));
    },
    [],
  );

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke<{
      connected?: boolean;
      needsReconnect?: boolean;
      error?: string;
    }>("google-oauth-manage", { body: { action: "status" } });
    if (error || data?.error) {
      setConnected(false);
      setNeedsReconnect(false);
      return;
    }
    applyStatus(data);
  }, [applyStatus]);

  useEffect(() => {
    if (!enabled) {
      setConnected(null);
      return;
    }
    setConnected(null);
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.functions.invoke<{
        connected?: boolean;
        needsReconnect?: boolean;
        error?: string;
      }>("google-oauth-manage", { body: { action: "status" } });
      if (cancelled) return;
      if (error || data?.error) {
        setConnected(false);
        setNeedsReconnect(false);
        return;
      }
      applyStatus(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, applyStatus]);

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
    setNeedsReconnect(false);
    return { ok: true };
  }, []);

  const pending = enabled && connected === null;

  return { connected, needsReconnect, pending, refresh, disconnect };
}
