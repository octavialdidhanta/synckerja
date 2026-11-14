import { Copy, MoreVertical, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { VoiceOverScript } from "@/thinking-lab/execution/script";
import type { NarrationWordPart } from "@/thinking-lab/execution/passChecklist";
import type { ExecutionRelation } from "@/thinking-lab/execution/types";

export const COMPACT_BUTTON = "h-7 rounded-md px-2.5 text-xs";

export const RELATION_COPY: Record<ExecutionRelation, string> = {
  VALID_EXECUTION: "The script carries the Idea and a viewer can climb to the Master Thought.",
  MESSAGE_ADDED: "Some lines add a claim the Idea does not carry.",
  MECHANISM_HIDDEN: "The Idea's mechanism is not visible in this script.",
  PILLAR_OUTSIDE: "This pillar forces a message outside the Idea.",
  PILLAR_NOT_SELLING: "Flash Sale Hook needs a Master Thought that is actually selling.",
  HOOK_MISSED: "The first sentence is not spoken inside the unfinished problem.",
  SPEECH_STIFF: "A line sounds like a report.",
  SLANG_MISSED: "A line is not spoken in slang.",
  FORMAT_MISSED: "The spoken lines use a different format from the pillar.",
  CLIMB_MISSED: "A viewer does not climb from this script to the Master Thought.",
  SUBJECT_MISMATCH: "The viewer reaches a different subject than the Master Thought.",
  CAUSE_BROKEN: "A line installs a cause other than the Big Thought's stake.",
  PERSON_MISSED: "The story leaves out the person it happens to.",
  UNRESOLVED: "The check could not finish.",
};

export function LockedChoices({ script }: { script: VoiceOverScript }) {
  const { t } = useAppTranslation();
  const decisions = (script.decisions ?? []).filter((row) => row.category.trim() && row.answer.trim());
  if (decisions.length > 0) {
    return (
      <div className="space-y-2">
        {decisions.map((row) => (
          <div key={`${row.binds}:${row.question}`} className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{row.category}</p>
            <p className="text-sm text-foreground">{row.answer}</p>
          </div>
        ))}
      </div>
    );
  }
  if (!script.pointOfView?.trim()) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{t("thinkingLab.execution.viewpointLabel", "Point of view")}</p>
      <p className="text-sm text-foreground">{script.pointOfView.trim()}</p>
    </div>
  );
}

export function NarrationWordLine({ parts, changedClass }: { parts: NarrationWordPart[]; changedClass: string }) {
  return (
    <p className="text-sm leading-relaxed text-foreground">
      {parts.map((part, index) => (
        <span key={`${part.text}-${index}`}>
          {index > 0 ? " " : null}
          <span className={part.changed ? changedClass : undefined} data-word-change={part.changed ? "yes" : undefined}>
            {part.text}
          </span>
        </span>
      ))}
    </p>
  );
}

export function ExecutionMenu({
  onRegenerate,
  onDelete,
  pending = false,
}: {
  onRegenerate?: () => void;
  onDelete?: () => void;
  pending?: boolean;
}) {
  const { t } = useAppTranslation();
  if (!onRegenerate && !onDelete) return null;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          aria-label={t("thinkingLab.action.more", "More actions")}
          disabled={pending}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[11rem]">
        {onRegenerate ? (
          <DropdownMenuItem className="cursor-pointer gap-2" disabled={pending} onSelect={() => onRegenerate()}>
            <RefreshCw className="h-3.5 w-3.5" />
            {t("thinkingLab.action.regenerate", "Regenerate")}
          </DropdownMenuItem>
        ) : null}
        {onDelete ? (
          <DropdownMenuItem
            className="cursor-pointer gap-2 text-destructive focus:text-destructive"
            disabled={pending}
            onSelect={() => onDelete()}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("thinkingLab.action.delete", "Delete")}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PostPack({ title, caption }: { title: string; caption: string }) {
  const { t } = useAppTranslation();
  const copy = async (value: string) => {
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
  };
  const rows = [
    title.trim() ? { label: t("thinkingLab.execution.bestTitle", "Best title"), value: title.trim(), copyLabel: t("thinkingLab.execution.copyTitle", "Copy title") } : null,
    caption.trim()
      ? { label: t("thinkingLab.execution.bestCaption", "Best caption"), value: caption.trim(), copyLabel: t("thinkingLab.execution.copyCaption", "Copy caption") }
      : null,
  ].filter((row): row is { label: string; value: string; copyLabel: string } => Boolean(row));
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.label} className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{row.label}</p>
          <div className="flex items-start gap-2 rounded-md bg-muted px-2 py-1.5">
            <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm text-foreground">{row.value}</p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 w-7 shrink-0 p-0"
              aria-label={row.copyLabel}
              title={row.copyLabel}
              onClick={() => void copy(row.value)}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
