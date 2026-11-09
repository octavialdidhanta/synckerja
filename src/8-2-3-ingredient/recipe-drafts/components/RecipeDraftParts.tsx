import { AlertTriangle, ArrowDown, ArrowUp, Ban, Info } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { deltaDirection, signedRupiah } from "../lib/recipeDraftFormat";
import { noticeText } from "../lib/recipeDraftMessages";
import type { RecipeDraftChange, RecipeDraftNotice } from "../types";

export function ChangeBadge({ change }: { change: RecipeDraftChange }) {
  const { t } = useAppTranslation();
  const label = {
    same: t("recipeDrafts.change.same", "Same"),
    changed: t("recipeDrafts.change.changed", "Changed"),
    new: t("recipeDrafts.change.new", "New"),
    removed: t("recipeDrafts.change.removed", "Removed"),
  }[change];
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold",
        change === "same" && "bg-gray-100 text-gray-600",
        change === "changed" && "bg-amber-100 text-amber-800",
        change === "new" && "bg-blue-100 text-blue-700",
        change === "removed" && "bg-red-100 text-red-700",
      )}
    >
      {label}
    </span>
  );
}

/** Signed money with an arrow, so up/down does not rely on color alone. */
export function DeltaText({ value, strong = false }: { value: number | null | undefined; strong?: boolean }) {
  const direction = deltaDirection(value);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap",
        strong ? "font-bold" : "font-semibold",
        direction === "up" && "text-orange-700",
        direction === "down" && "text-blue-700",
        direction === "flat" && "font-normal text-gray-600",
      )}
    >
      {direction === "up" ? <ArrowUp className="h-3 w-3" aria-hidden /> : null}
      {direction === "down" ? <ArrowDown className="h-3 w-3" aria-hidden /> : null}
      {signedRupiah(value)}
    </span>
  );
}

export function rowTint(change: RecipeDraftChange, hasError = false): string {
  if (hasError) return "bg-red-50/60";
  if (change === "changed") return "bg-amber-50/50";
  if (change === "new") return "bg-blue-50/50";
  if (change === "removed") return "bg-red-50/50";
  return "";
}

export function RecipeDraftNoticeList({
  blocking,
  warnings,
}: {
  blocking: RecipeDraftNotice[];
  warnings: RecipeDraftNotice[];
}) {
  const { t } = useAppTranslation();
  const notices = [...blocking, ...warnings].map((notice) => ({ notice, text: noticeText(t, notice) }));
  if (notices.length === 0) return null;
  return (
    <section aria-label={t("recipeDrafts.notices", "To check")} aria-live="polite" className="flex flex-col gap-2">
      {notices.map(({ notice, text }) => (
        <div
          key={notice.code}
          className={cn(
            "flex gap-3 rounded-lg border px-3.5 py-3",
            text.tone === "blocking" && "border-red-200 bg-red-50",
            text.tone === "warning" && "border-orange-200 bg-orange-50",
            text.tone === "info" && "border-blue-200 bg-blue-50",
          )}
        >
          {text.tone === "blocking" ? (
            <Ban className="mt-0.5 h-[18px] w-[18px] shrink-0 text-red-700" aria-hidden />
          ) : text.tone === "warning" ? (
            <AlertTriangle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-orange-700" aria-hidden />
          ) : (
            <Info className="mt-0.5 h-[18px] w-[18px] shrink-0 text-blue-700" aria-hidden />
          )}
          <div className="min-w-0">
            <p
              className={cn(
                "text-sm font-semibold",
                text.tone === "blocking" && "text-red-900",
                text.tone === "warning" && "text-orange-900",
                text.tone === "info" && "text-blue-900",
              )}
            >
              {text.title}
            </p>
            {text.body ? (
              <p
                className={cn(
                  "text-sm",
                  text.tone === "blocking" && "text-red-800",
                  text.tone === "warning" && "text-orange-800",
                  text.tone === "info" && "text-blue-800",
                )}
              >
                {text.body}
              </p>
            ) : null}
          </div>
        </div>
      ))}
    </section>
  );
}
