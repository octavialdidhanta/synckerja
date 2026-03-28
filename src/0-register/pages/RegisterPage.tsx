import { useEffect, useRef, useState, useCallback } from "react";
import { RegistrationForm } from "@/0-register/components/RegistrationForm";
import { AuthTestimonialsPanel } from "@/0-register/components/AuthTestimonialsPanel";
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";

const GAP_ABOVE_KEYBOARD = 12;

export default function RegisterPage() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const inputFocusedRef = useRef(false);

  const scrollPanelSoButtonNearKeyboard = useCallback(() => {
    if (typeof window === "undefined" || window.innerWidth >= 1024) return;
    const panel = panelRef.current;
    const btn = submitButtonRef.current;
    if (!panel || !btn || !inputFocusedRef.current) return;
    const vv = window.visualViewport;
    const visibleHeight = vv ? vv.height : window.innerHeight;
    const btnRect = btn.getBoundingClientRect();
    const targetBottom = visibleHeight - GAP_ABOVE_KEYBOARD;
    const scrollDelta = btnRect.bottom - targetBottom;
    if (scrollDelta > 0) {
      panel.scrollTop = Math.max(0, panel.scrollTop + scrollDelta);
    }
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      if (inputFocusedRef.current) scrollPanelSoButtonNearKeyboard();
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, [scrollPanelSoButtonNearKeyboard]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const showHandler = (info: { keyboardHeight: number }) => {
      setKeyboardHeight(info.keyboardHeight ?? 0);
      if (inputFocusedRef.current) {
        setTimeout(scrollPanelSoButtonNearKeyboard, 100);
        setTimeout(scrollPanelSoButtonNearKeyboard, 400);
      }
    };
    const hideHandler = () => setKeyboardHeight(0);
    const showPromise = Keyboard.addListener("keyboardWillShow", showHandler);
    const hidePromise = Keyboard.addListener("keyboardWillHide", hideHandler);
    return () => {
      showPromise.then((h) => h.remove());
      hidePromise.then((h) => h.remove());
    };
  }, [scrollPanelSoButtonNearKeyboard]);

  return (
    <div className="flex min-h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden safe-area-top lg:max-h-none lg:min-h-screen lg:flex-row">
      <div className="hidden min-h-0 w-full min-w-0 lg:flex lg:max-w-[50%] lg:flex-1 lg:items-center lg:justify-center lg:min-h-screen xl:max-w-[48%]">
        <AuthTestimonialsPanel />
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col bg-[hsl(var(--brand-white))] lg:border-l lg:border-slate-200/80"
        style={keyboardHeight > 0 ? { paddingBottom: keyboardHeight } : undefined}
      >
        <div
          ref={panelRef}
          className="flex flex-1 min-h-0 flex-col items-center justify-center overflow-y-auto px-5 py-8 sm:px-10 seamless-scroll max-h-[calc(100vh-120px)] lg:max-h-none lg:py-12"
        >
          <div className="w-full max-w-md">
            <RegistrationForm
              submitButtonRef={submitButtonRef}
              onKeyboardInputFocus={() => {
                inputFocusedRef.current = true;
                setTimeout(scrollPanelSoButtonNearKeyboard, 150);
                setTimeout(scrollPanelSoButtonNearKeyboard, 450);
                setTimeout(scrollPanelSoButtonNearKeyboard, 800);
              }}
              onKeyboardInputBlur={() => {
                inputFocusedRef.current = false;
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
