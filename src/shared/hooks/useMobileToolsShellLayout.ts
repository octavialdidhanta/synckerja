import { useEffect, useMemo } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { cn } from "@/shared/lib/utils";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { triggerMobileLayoutReflow } from "@/shared/mobile/triggerMobileLayoutReflow";

/**
 * Pola shell tools mobile (expenses, subscription, …): Android native memakai **flex `h-dvh`** tanpa
 * `<main fixed>` agar `adjustResize` + resume tidak meninggalkan strip; header memakai **satu** sumber
 * padding atas — persis `var(--safe-area-inset-top)` dari plugin (netral per device).
 */
export function useMobileToolsShellLayout() {
  const isAndroidNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  const { mainFixedStyle } = useVisualViewport();

  useEffect(() => {
    if (!isAndroidNative) return;
    const onResume = () => {
      triggerMobileLayoutReflow();
      requestAnimationFrame(() => triggerMobileLayoutReflow());
    };
    let remove: (() => void) | undefined;
    void App.addListener("resume", onResume).then((h) => {
      remove = () => void h.remove();
    });
    return () => remove?.();
  }, [isAndroidNative]);

  const outerShellClassName = useMemo(
    () =>
      cn(
        "relative min-w-0 w-full bg-background",
        isAndroidNative ? "flex h-dvh min-h-0 flex-col overflow-hidden" : "min-h-[100dvh]",
      ),
    [isAndroidNative],
  );

  const mainShellClassName = useMemo(
    () =>
      cn(
        "z-0 flex w-full min-w-0 max-w-none flex-col bg-background",
        isAndroidNative ? "min-h-0 flex-1 overflow-hidden" : "fixed inset-x-0 min-h-0",
      ),
    [isAndroidNative],
  );

  const mainShellStyle = isAndroidNative ? undefined : mainFixedStyle;

  const mobileHeaderChrome = useMemo(
    () => ({
      className: cn(
        "sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-border bg-card",
        !isAndroidNative && "safe-area-top p-3",
      ),
      style: isAndroidNative
        ? ({
            paddingTop: "var(--safe-area-inset-top, 0px)",
            paddingBottom: 12,
            paddingLeft: 12,
            paddingRight: 12,
          } as const)
        : undefined,
    }),
    [isAndroidNative],
  );

  return {
    isAndroidNative,
    outerShellClassName,
    mainShellClassName,
    mainShellStyle,
    mobileHeaderChrome,
  };
}
