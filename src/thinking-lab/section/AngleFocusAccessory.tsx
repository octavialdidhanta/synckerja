import { AiEmployeeBotIcon } from "@/2-1-employees/ai/AiEmployeeBotIcon";
import { cn } from "@/shared/lib/utils";

export function AngleFocusAccessory({
  selected,
  disabled,
  onClick,
  label,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      // Keep clickable when blocked so the handler can toast the reason (HTML disabled swallows clicks).
      aria-disabled={disabled || undefined}
      aria-label={label}
      aria-pressed={selected}
      title={label}
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded border transition-colors",
        selected
          ? "border-violet-300 bg-violet-500 text-white"
          : "border-white/25 bg-black/25 text-white/85 hover:border-violet-300/80 hover:bg-violet-500/30",
        disabled && "cursor-not-allowed opacity-40",
      )}
      data-map-control=""
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <AiEmployeeBotIcon className="h-3 w-3" />
    </button>
  );
}
