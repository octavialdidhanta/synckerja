import { useEffect, useRef, useState } from "react";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ORDER_WHATSAPP_DEFAULT_TABLE_MESSAGE, ORDER_WHATSAPP_MESSAGE_MAX } from "../lib/orderWhatsApp";

const AUTOSAVE_DELAY_MS = 1000;

type SaveState = "idle" | "saving" | "saved" | "error";

type Props = {
  value: string;
  disabled?: boolean;
  onSave: (message: string) => Promise<void>;
};

/** Per-outlet opening message. Auto-saves 1s after typing stops, and on blur. */
export function OutletWhatsAppMessageInput({ value, disabled, onSave }: Props) {
  const { t } = useAppTranslation();
  const [draft, setDraft] = useState(value);
  const [state, setState] = useState<SaveState>("idle");
  const lastSaved = useRef(value);
  const timer = useRef<number | null>(null);
  const dirty = draft.trim() !== lastSaved.current.trim();

  // Server value changed (another tab / refetch) while the user is not editing.
  useEffect(() => {
    if (!dirty) {
      setDraft(value);
      lastSaved.current = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to server value
  }, [value]);

  const flush = async (next: string) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    if (next.trim() === lastSaved.current.trim()) return;
    setState("saving");
    try {
      await onSave(next);
      lastSaved.current = next;
      setState("saved");
    } catch {
      setState("error");
    }
  };

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const statusText =
    state === "saving"
      ? t("synckerjaOrder.whatsapp.saving", "Saving…")
      : state === "saved" && !dirty
        ? t("synckerjaOrder.whatsapp.saved", "Saved ✓")
        : state === "error"
          ? t("synckerjaOrder.whatsapp.saveError", "Failed to save")
          : `${draft.length}/${ORDER_WHATSAPP_MESSAGE_MAX}`;

  return (
    <div className="flex w-72 flex-col gap-0.5">
      <Input
        className="h-8 text-xs"
        value={draft}
        maxLength={ORDER_WHATSAPP_MESSAGE_MAX}
        disabled={disabled}
        placeholder={ORDER_WHATSAPP_DEFAULT_TABLE_MESSAGE}
        aria-label={t("synckerjaOrder.whatsapp.message", "Opening message")}
        onChange={(e) => {
          const next = e.target.value;
          setDraft(next);
          setState("idle");
          if (timer.current) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => void flush(next), AUTOSAVE_DELAY_MS);
        }}
        onBlur={() => void flush(draft)}
      />
      <span
        className={`text-[10px] leading-tight ${state === "error" ? "text-destructive" : "text-muted-foreground"}`}
        aria-live="polite"
      >
        {disabled
          ? t("synckerjaOrder.whatsapp.messageNeedsNumber", "Select a WhatsApp number first")
          : `${t("synckerjaOrder.whatsapp.placeholderHint", "Use {outlet} and {meja}")} · ${statusText}`}
      </span>
    </div>
  );
}
