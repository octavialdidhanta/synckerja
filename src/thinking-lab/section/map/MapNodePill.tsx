import type { ReactNode } from "react";
import { AlertCircle, Star } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

export type PillTone = "master" | "bigThought" | "territory" | "angle" | "idea" | "pillar" | "execution";

const SOLID: Record<"master" | "bigThought", string> = {
  master: "border border-[#16365c] bg-[#1b3a6b] text-white",
  bigThought: "border border-[#3d6cb5] bg-[#3d6cb5] text-white",
};

const ACCENT: Record<"territory" | "angle" | "idea" | "pillar" | "execution", string> = {
  territory: "border border-[#c9a24a] bg-[#3a342c] text-white",
  angle: "border border-amber-700/80 bg-[#3a342c] text-white",
  idea: "border border-rose-400/80 bg-[#3a342c] text-white",
  pillar: "border border-sky-400/80 bg-[#3a342c] text-white",
  execution: "border border-violet-400/80 bg-[#3a342c] text-white",
};

const ACCENT_BAR: Record<"territory" | "angle" | "idea" | "pillar" | "execution", string> = {
  territory: "bg-[#e8b84a]",
  angle: "bg-amber-500",
  idea: "bg-rose-400",
  pillar: "bg-sky-400",
  execution: "bg-violet-400",
};

export function Pill({
  nodeId,
  tone,
  title,
  code,
  fullTitle,
  selected,
  childCount,
  recommended,
  warning = false,
  stretch = false,
  truncateTitle = false,
  mark,
  accessory,
  onClick,
}: {
  nodeId: string;
  tone: PillTone;
  title: string;
  code?: string;
  /** Extra words after the level, such as Lead Magnet. */
  mark?: string;
  fullTitle?: string;
  selected: boolean;
  childCount?: number;
  recommended?: boolean;
  warning?: boolean;
  stretch?: boolean;
  /** Ellipsize the title inside the shared node width. */
  truncateTitle?: boolean;
  accessory?: ReactNode;
  onClick: () => void;
}) {
  const { t } = useAppTranslation();
  const count = childCount ?? 0;
  const solid = tone === "master" || tone === "bigThought";
  const level =
    tone === "master"
      ? t("thinkingLab.tree.masterThought", "Master Thought")
      : tone === "bigThought"
        ? t("thinkingLab.tree.bigThought", "Big Thought")
        : tone === "territory"
          ? t("thinkingLab.tree.territory", "Territory")
          : tone === "angle"
            ? t("thinkingLab.tree.angle", "Angle")
            : tone === "pillar"
              ? t("thinkingLab.tree.pillar", "Pillar")
              : tone === "execution"
                ? t("thinkingLab.execution.label", "Execution")
                : t("thinkingLab.idea.list", "Idea");
  const badge = code?.trim();
  const levelText = mark?.trim() ? `${level} - ${mark.trim()}` : badge ? `${level} - ${badge}` : level;
  return (
    <div className={cn("relative col-start-1 row-start-1 min-w-0", stretch && "w-full")} data-map-node={nodeId}>
      <button
        type="button"
        onClick={onClick}
        title={fullTitle && (truncateTitle || fullTitle.trim() !== title.trim()) ? fullTitle.trim() : undefined}
        aria-label={title.trim() || levelText}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "items-stretch rounded-[4px] px-2 py-0.5 text-left text-xs font-medium",
          tone === "master" ? "max-w-[22rem] whitespace-normal" : "whitespace-nowrap",
          accessory && "pl-6",
          truncateTitle ? "flex w-full min-w-0 overflow-hidden" : stretch ? "flex w-full" : "inline-flex w-max",
          solid ? SOLID[tone] : cn("gap-1.5 pl-1", ACCENT[tone]),
          tone === "bigThought" && selected && "border-[#16365c] bg-[#1e4a86]",
          tone === "territory" && selected && "border-[#f0c14b]",
          !solid && selected && tone !== "territory" && "ring-2 ring-[#16365c]",
        )}
      >
        {solid ? null : <span className={cn("my-0.5 w-0.5 shrink-0 self-stretch rounded-[1px]", ACCENT_BAR[tone])} aria-hidden />}
        <span className={cn("flex flex-col gap-0.5 py-0.5", stretch ? "min-w-0 flex-1" : "w-max")}>
          <span className={cn("text-[10px] font-medium leading-none text-white/90", truncateTitle && "truncate")}>
            {levelText}
          </span>
          {title ? (
            <span className={truncateTitle ? "block truncate leading-none" : tone === "master" ? "whitespace-normal break-words leading-snug" : "leading-none"}>{title}</span>
          ) : null}
        </span>
        {recommended ? (
          <Star
            className="ml-1 h-3 w-3 shrink-0 self-center fill-current"
            aria-label={t("thinkingLab.idea.recommended", "Recommended to start")}
          />
        ) : null}
        {warning ? (
          <AlertCircle className="ml-1 h-3.5 w-3.5 shrink-0 self-center text-rose-300" aria-label={t("thinkingLab.execution.failed", "Not passed")} />
        ) : null}
      </button>
      {accessory ? <div className="absolute left-0.5 top-1/2 z-10 -translate-y-1/2">{accessory}</div> : null}
      {count > 0 ? (
        <span
          className="absolute -right-2.5 top-1/2 flex h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white px-1 text-[10px] font-semibold text-slate-600 shadow-sm"
          data-map-count=""
          aria-label={t("thinkingLab.tree.childCount", "{{count}} below", { count })}
        >
          +{count}
        </span>
      ) : null}
    </div>
  );
}
