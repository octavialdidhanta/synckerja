import { useEffect, useMemo, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { SYNCKERJA_SPLASH_HIDDEN_EVENT } from "@/shared/hooks/useNativeSafeAreaCssVars";

/** Cadangan: hindari splash tak terbatas jika jaringan/query macet. */
const FALLBACK_HIDE_MS = 35_000;

/**
 * Native (Capacitor): splash sampai auth + org + bundle `CentralizedUserData` selesai, lalu `SplashScreen.hide()`.
 * Konfigurasi izin halaman **tidak** di-gate di sini — `PermissionConfigurationProvider` bisa lama / berkedip
 * `loading` dan membuat `hiddenRef` terkunci bila diset sebelum rAF (bug: cancel rAF + ref sudah true).
 * Wajib `launchAutoHide: false` di `capacitor.config.ts`.
 */
export function NativeBootstrapSplashGate() {
  const { loading: centralLoading } = useCentralizedUserData();
  const { loading: orgLoading } = useCurrentOrg();

  const bootstrapPending = useMemo(
    () => orgLoading || centralLoading,
    [orgLoading, centralLoading],
  );

  const hiddenRef = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const t = window.setTimeout(() => {
      if (hiddenRef.current) return;
      hiddenRef.current = true;
      void SplashScreen.hide({ fadeOutDuration: 200 })
        .then(() => {
          window.dispatchEvent(new CustomEvent(SYNCKERJA_SPLASH_HIDDEN_EVENT));
        })
        .catch(() => {});
    }, FALLBACK_HIDE_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (bootstrapPending) return;
    if (hiddenRef.current) return;
    const raf = requestAnimationFrame(() => {
      if (hiddenRef.current) return;
      hiddenRef.current = true;
      void SplashScreen.hide({ fadeOutDuration: 220 })
        .then(() => {
          window.dispatchEvent(new CustomEvent(SYNCKERJA_SPLASH_HIDDEN_EVENT));
        })
        .catch(() => {});
    });
    return () => cancelAnimationFrame(raf);
  }, [bootstrapPending]);

  return null;
}
