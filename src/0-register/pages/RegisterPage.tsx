import { useRef } from "react";
import { RegistrationForm } from "@/0-register/components/RegistrationForm";
import { AuthTestimonialsPanel } from "@/0-register/components/AuthTestimonialsPanel";
import { useMobileKeyboardViewport } from "@/shared/hooks/useMobileKeyboardViewport";

export default function RegisterPage() {
  const submitRef = useRef<HTMLButtonElement>(null);
  const kb = useMobileKeyboardViewport({ submitAnchorRef: submitRef });

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden safe-area-top lg:flex-row lg:items-stretch">
      <div className="hidden min-h-0 w-full min-w-0 self-stretch lg:flex lg:max-w-[50%] lg:flex-1 xl:max-w-[48%]">
        <AuthTestimonialsPanel />
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col bg-[hsl(var(--brand-white))] lg:border-l lg:border-slate-200/80"
        style={kb.keyboardPaddingBottom > 0 ? { paddingBottom: kb.keyboardPaddingBottom } : undefined}
      >
        <div
          ref={kb.panelRef}
          className="scrollbar-hide seamless-scroll flex min-h-0 flex-1 flex-col items-stretch justify-start overflow-x-hidden overflow-y-auto px-4 py-4 sm:px-10 sm:py-8 lg:items-center lg:justify-center lg:py-12"
        >
          <div className="w-full max-w-md">
            <RegistrationForm
              submitButtonRef={submitRef}
              onKeyboardInputFocus={kb.onInputFocus}
              onKeyboardInputBlur={kb.onInputBlur}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
