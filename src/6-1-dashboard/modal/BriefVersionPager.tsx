import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { briefVersionName } from "./briefVoVersions";

export function BriefVersionPager({
  count,
  activeIndex,
  onSelect,
}: {
  count: number;
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  const { t } = useAppTranslation();
  if (count <= 1) return null;
  const label = (index: number) =>
    index <= 0
      ? t("briefDialog.version.original", "Original")
      : t("briefDialog.version.numbered", "V.{{index}}", { index });
  const current = label(activeIndex);

  return (
    <div className="mt-1.5 flex min-w-0 items-center justify-start gap-1.5">
      <button
        type="button"
        title={t("briefDialog.version.previous", "Previous version")}
        aria-label={t("briefDialog.version.previous", "Previous version")}
        disabled={activeIndex === 0}
        onClick={() => onSelect(activeIndex - 1)}
        className="-ml-1.5 flex h-4 w-4 shrink-0 items-center justify-center p-0 text-gray-600 hover:text-gray-900 disabled:opacity-30"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: count }, (_, index) => (
          <button
            key={briefVersionName(index)}
            type="button"
            title={label(index)}
            aria-label={label(index)}
            aria-pressed={index === activeIndex}
            onClick={() => onSelect(index)}
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-all",
              index === activeIndex ? "w-3 bg-gray-800" : "bg-gray-300 hover:bg-gray-500",
            )}
          />
        ))}
      </div>
      <span className="shrink-0 text-[11px] font-medium text-gray-700">{current}</span>
      <button
        type="button"
        title={t("briefDialog.version.next", "Next version")}
        aria-label={t("briefDialog.version.next", "Next version")}
        disabled={activeIndex >= count - 1}
        onClick={() => onSelect(activeIndex + 1)}
        className="flex h-4 w-4 shrink-0 items-center justify-center p-0 text-gray-600 hover:text-gray-900 disabled:opacity-30"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
