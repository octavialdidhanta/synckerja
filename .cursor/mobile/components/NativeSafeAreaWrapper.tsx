import React, { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { SafeAreaInsetsProvider, useSafeAreaInsets } from "@/mobile/contexts/SafeAreaInsetsContext";
import { AndroidSystemNavBarStrip } from "@/mobile/components/AndroidSystemNavBarStrip";

interface NativeSafeAreaWrapperProps {
  children: React.ReactNode;
}

function NativeSafeAreaWrapperInner({ children }: NativeSafeAreaWrapperProps) {
  const { top, bottom } = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const check = () =>
      setKeyboardOpen(vv.height < window.innerHeight * 0.65);
    check();
    vv.addEventListener("resize", check);
    return () => vv.removeEventListener("resize", check);
  }, []);

  // Set on <html> so every node (including Radix portals under <body>) inherits the same insets.
  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("data-capacitor-native", "true");
    el.setAttribute("data-capacitor-platform", Capacitor.getPlatform());
    el.style.setProperty("--safe-area-inset-top", `${top}px`);
    el.style.setProperty("--safe-area-inset-bottom", `${bottom}px`);
    return () => {
      el.removeAttribute("data-capacitor-native");
      el.removeAttribute("data-capacitor-platform");
      el.style.removeProperty("--safe-area-inset-top");
      el.style.removeProperty("--safe-area-inset-bottom");
    };
  }, [top, bottom]);

  return (
    <>
      {/* Only inject CSS variables on documentElement (above). Do not add padding here — headers use
          .safe-area-top; wrapper padding + offsetTop + header padding stacked and pushed headers down. */}
      <div className="min-h-[100dvh]">{children}</div>
      <AndroidSystemNavBarStrip keyboardOpen={keyboardOpen} />
    </>
  );
}

/**
 * When running inside Capacitor (native app), wraps children with safe area
 * insets so content is not obscured by status bar (top) or device nav bar (bottom).
 * No-op when not on native platform (web/desktop).
 */
export function NativeSafeAreaWrapper({ children }: NativeSafeAreaWrapperProps) {
  if (!Capacitor.isNativePlatform()) {
    return <>{children}</>;
  }

  return (
    <SafeAreaInsetsProvider>
      <NativeSafeAreaWrapperInner>{children}</NativeSafeAreaWrapperInner>
    </SafeAreaInsetsProvider>
  );
}
