import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { triggerMobileLayoutReflow } from "@/shared/mobile/triggerMobileLayoutReflow";

let subscriberCount = 0;
let removeResume: (() => void) | undefined;
let visibilityHandler: (() => void) | undefined;

function attachGlobalForegroundReflow(): void {
  const bump = () => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    triggerMobileLayoutReflow();
    requestAnimationFrame(() => {
      triggerMobileLayoutReflow();
    });
  };

  visibilityHandler = () => {
    if (document.visibilityState === "visible") bump();
  };
  document.addEventListener("visibilitychange", visibilityHandler);

  void App.addListener("resume", bump).then((handle) => {
    removeResume = () => void handle.remove();
  });
}

function detachGlobalForegroundReflow(): void {
  if (visibilityHandler) {
    document.removeEventListener("visibilitychange", visibilityHandler);
    visibilityHandler = undefined;
  }
  removeResume?.();
  removeResume = undefined;
}

/**
 * Banyak instance (dialog/drawer) boleh memanggil hook ini; listener native hanya satu.
 */
export function useMobileChromeReflowOnForeground(): void {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    subscriberCount += 1;
    if (subscriberCount === 1) {
      attachGlobalForegroundReflow();
    }

    return () => {
      subscriberCount -= 1;
      if (subscriberCount <= 0) {
        subscriberCount = 0;
        detachGlobalForegroundReflow();
      }
    };
  }, []);
}
