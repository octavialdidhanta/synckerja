import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";

const LENGTH = 6;

type EmailOtpInputProps = {
  disabled?: boolean;
  /** Increment to clear all cells (e.g. after resend or failed attempt). */
  resetTrigger?: number;
  onComplete: (code: string) => void | Promise<void>;
  legend: string;
  inputClassName?: string;
};

export function EmailOtpInput({
  disabled,
  resetTrigger = 0,
  onComplete,
  legend,
  inputClassName,
}: EmailOtpInputProps) {
  const [digits, setDigits] = useState<string[]>(() => Array(LENGTH).fill(""));
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const completedRef = useRef(false);

  useEffect(() => {
    setDigits(Array(LENGTH).fill(""));
    completedRef.current = false;
    queueMicrotask(() => inputsRef.current[0]?.focus());
  }, [resetTrigger]);

  const tryComplete = useCallback(
    (next: string[]) => {
      const code = next.join("");
      if (code.length !== LENGTH || next.some((d) => !d)) return;
      if (completedRef.current || disabled) return;
      completedRef.current = true;
      void (async () => {
        try {
          await onComplete(code);
        } catch {
          completedRef.current = false;
        }
      })();
    },
    [disabled, onComplete],
  );

  const setDigitAt = (index: number, value: string) => {
    if (disabled) return;
    const d = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = d;
    setDigits(next);
    if (d && index < LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
    tryComplete(next);
  };

  const onKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === "Backspace") {
      if (digits[index]) {
        const next = [...digits];
        next[index] = "";
        setDigits(next);
      } else if (index > 0) {
        inputsRef.current[index - 1]?.focus();
        const next = [...digits];
        next[index - 1] = "";
        setDigits(next);
      }
      e.preventDefault();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
      e.preventDefault();
    }
    if (e.key === "ArrowRight" && index < LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
      e.preventDefault();
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    if (disabled) return;
    e.preventDefault();
    const raw = e.clipboardData.getData("text");
    const nums = raw.replace(/\D/g, "").slice(0, LENGTH);
    if (!nums) return;
    const next = Array(LENGTH).fill("") as string[];
    for (let i = 0; i < nums.length; i++) next[i] = nums[i]!;
    setDigits(next);
    const focusIdx = Math.min(nums.length, LENGTH - 1);
    inputsRef.current[focusIdx]?.focus();
    if (nums.length === LENGTH) tryComplete(next);
  };

  return (
    <fieldset className="w-full border-0 p-0">
      <legend className="sr-only">{legend}</legend>
      <div className="flex justify-center gap-2 sm:gap-3" role="group" aria-label={legend}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputsRef.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={d}
            disabled={disabled}
            aria-label={`${legend} ${i + 1} / ${LENGTH}`}
            onChange={(e) => setDigitAt(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onPaste={i === 0 ? onPaste : undefined}
            className={cn(
              "h-12 w-10 rounded-lg border-2 border-slate-200 bg-white text-center text-lg font-semibold text-slate-900 shadow-sm transition-colors",
              "focus-visible:border-[hsl(var(--brand-blue))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-blue))]/30",
              "disabled:cursor-not-allowed disabled:opacity-50 sm:h-14 sm:w-12 sm:text-xl",
              inputClassName,
            )}
          />
        ))}
      </div>
    </fieldset>
  );
}
