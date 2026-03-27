import { useRef, useCallback } from "react";
import { TestimonialsPanel } from "@/components/auth/TestimonialsPanel";
import { RegistrationForm } from "@/components/auth/RegistrationForm";

const Register = () => {
  const panelRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (typeof window === "undefined" || window.innerWidth >= 1024) return;
    const panel = panelRef.current;
    if (!panel) return;
    setTimeout(() => {
      panel.scrollTo({ top: panel.scrollHeight, behavior: "smooth" });
    }, 150);
  }, []);

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Testimonials */}
      <TestimonialsPanel />

      {/* Right Panel - Registration Form */}
      <div
        ref={panelRef}
        className="flex w-full lg:w-1/2 flex-col items-center justify-center overflow-y-auto px-6 py-12 sm:px-12"
      >
        <RegistrationForm
          onInputFocus={scrollToBottom}
          onInputBlur={() => {}}
        />
      </div>
    </div>
  );
};

export default Register;
