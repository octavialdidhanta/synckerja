import { useEffect, useState } from "react";
import { Loader2, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { EditableStatement } from "@/thinking-lab/section/ManualStatementForm";
import {
  PassChecklist as TerritoryPassChecklist,
  IDEA_PASS_CHECK_LABELS,
} from "@/thinking-lab/section/inspector/PassChecklist";
import { ParentChangedBadge, UncheckedBadge, VerdictChip } from "@/thinking-lab/section/inspector/InspectorChrome";
import type { LabNodeInspectorProps } from "@/thinking-lab/section/inspector/types";

type InspectorIdea = NonNullable<LabNodeInspectorProps["ideas"]>[number];

export type IdeaInspectorBodyProps = {
  ideas: InspectorIdea[];
  angleId?: string;
  ideaHistory?: LabNodeInspectorProps["ideaHistory"];
  ideaRevisionTarget?: LabNodeInspectorProps["ideaRevisionTarget"];
  pendingAction?: string | null;
  onLockIdeas?: () => void;
  onEditIdea?: (id: string, statement: string) => Promise<string | null>;
  onReviseIdea?: (id: string) => void;
  onDeleteIdea?: (id: string) => void;
};

export function IdeaInspectorBody({
  ideas,
  angleId,
  ideaHistory = null,
  ideaRevisionTarget = null,
  pendingAction = null,
  onLockIdeas,
  onEditIdea,
  onReviseIdea,
  onDeleteIdea,
}: IdeaInspectorBodyProps) {
  const { t } = useAppTranslation();
  const [ideaEditToken, setIdeaEditToken] = useState<Record<string, number>>({});
  const [ideaListFilter, setIdeaListFilter] = useState<"LOLOS" | "DITOLAK">("LOLOS");

  useEffect(() => {
    setIdeaListFilter("LOLOS");
  }, [angleId]);

  useEffect(() => {
    if (!ideaRevisionTarget) return;
    setIdeaListFilter(ideaRevisionTarget.decision === "LOLOS" ? "LOLOS" : "DITOLAK");
  }, [ideaRevisionTarget]);

  const ideaFilterEnabled = ideas.some((idea) => idea.decision);
  const shownIdeas = ideas.filter((idea) => {
    if (!ideaFilterEnabled) return true;
    if (ideaListFilter === "LOLOS") return idea.decision === "LOLOS" && idea.listed !== false;
    return idea.decision === "DITOLAK" || idea.decision === "BELUM_TERVERIFIKASI";
  });

  if (ideas.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("thinkingLab.idea.list", "Ideas")}
        </p>
        {onLockIdeas ? (
          <Button
            type="button"
            size="sm"
            onClick={onLockIdeas}
            disabled={Boolean(pendingAction)}
            aria-busy={pendingAction === "lock"}
          >
            {pendingAction === "lock" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {t("thinkingLab.action.lock", "Lock")}
          </Button>
        ) : null}
      </div>
      {ideaFilterEnabled ? (
        <div className="space-y-1">
          <div className="flex flex-wrap gap-1" role="group" aria-label={t("thinkingLab.idea.filter.label", "Idea history")}>
            {(
              [
                ["LOLOS", "thinkingLab.idea.filter.passed", "Passed", ideaHistory?.passed],
                [
                  "DITOLAK",
                  "thinkingLab.idea.filter.rejected",
                  "Rejected",
                  ideaHistory ? ideaHistory.rejected + ideaHistory.unverified : undefined,
                ],
              ] as const
            ).map(([id, key, fallback, count]) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={ideaListFilter === id ? "default" : "outline"}
                aria-pressed={ideaListFilter === id}
                onClick={() => setIdeaListFilter(id)}
              >
                {t(key, fallback)}
                {typeof count === "number" ? ` ${count}` : ""}
              </Button>
            ))}
          </div>
          {ideaHistory ? (
            <p className="text-xs text-muted-foreground">
              {t(
                "thinkingLab.idea.historySummary",
                "{{passed}} passed · {{rejected}} rejected · most often failed: {{criterion}}",
                {
                  passed: ideaHistory.passed,
                  rejected: ideaHistory.rejected + ideaHistory.unverified,
                  criterion: ideaHistory.topFailed
                    ? t(
                        `thinkingLab.idea.pass.${ideaHistory.topFailed}`,
                        IDEA_PASS_CHECK_LABELS[ideaHistory.topFailed] ?? ideaHistory.topFailed,
                      )
                    : t("thinkingLab.idea.historyNone", "none"),
                },
              )}
            </p>
          ) : null}
        </div>
      ) : null}
      {shownIdeas.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("thinkingLab.idea.filter.empty", "No idea is in this list.")}</p>
      ) : null}
      <ul className="space-y-2">
        {shownIdeas.map((idea) => {
          const ideaBusy = Boolean(pendingAction);
          const showIdeaMenu = Boolean(idea.editable && onEditIdea) || Boolean(onDeleteIdea);
          return (
            <li key={idea.id} className="rounded-lg border border-border bg-background px-3 py-3">
              <div className="mb-3 flex items-center gap-1.5">
                <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">{idea.code}</span>
                {idea.verdict ? <VerdictChip verdict={idea.verdict} verbatim /> : null}
                {idea.unchecked ? <UncheckedBadge /> : null}
                {idea.parentChanged ? <ParentChangedBadge /> : null}
                {showIdeaMenu ? (
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="ml-auto h-6 w-6 shrink-0 text-muted-foreground"
                        aria-label={`${t("thinkingLab.action.more", "More actions")} ${idea.code}`}
                        disabled={ideaBusy}
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[11rem]">
                      {idea.editable && onEditIdea ? (
                        <DropdownMenuItem
                          className="cursor-pointer gap-2"
                          disabled={ideaBusy}
                          onSelect={() =>
                            setIdeaEditToken((current) => ({
                              ...current,
                              [idea.id]: (current[idea.id] ?? 0) + 1,
                            }))
                          }
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {t("thinkingLab.manual.edit", "Edit")}
                        </DropdownMenuItem>
                      ) : null}
                      {onDeleteIdea ? (
                        <DropdownMenuItem
                          className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                          disabled={ideaBusy}
                          onSelect={() => onDeleteIdea(idea.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t("thinkingLab.action.deleteIdea", "Delete Idea")}
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
              <div className="space-y-3 [&_p]:leading-relaxed">
                <EditableStatement
                  compact
                  showButton={false}
                  editToken={ideaEditToken[idea.id] ?? 0}
                  statement={idea.statement}
                  enabled={Boolean(idea.editable && onEditIdea)}
                  pending={Boolean(pendingAction)}
                  onSave={(next) => onEditIdea?.(idea.id, next) ?? Promise.resolve(null)}
                />
                {idea.title && idea.title !== idea.statement ? (
                  <p className="text-sm font-medium text-foreground">{idea.title}</p>
                ) : null}
                {idea.concept ? (
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground">{t("thinkingLab.idea.concept", "Concept")}: </span>
                    {idea.concept}
                  </p>
                ) : null}
                {idea.mechanism ? (
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground">{t("thinkingLab.idea.mechanism", "Mechanism")}: </span>
                    {idea.mechanism}
                  </p>
                ) : null}
                {idea.value ? (
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground">{t("thinkingLab.idea.value", "Value")}: </span>
                    {idea.value}
                  </p>
                ) : null}
                {idea.decision && idea.decision !== "LOLOS" ? (
                  <p className="text-xs text-muted-foreground">
                    {t(
                      `thinkingLab.idea.decision.${idea.decision}`,
                      idea.decision === "DITOLAK" ? "Rejected" : "Not verified yet",
                    )}
                  </p>
                ) : null}
                <TerritoryPassChecklist checks={idea.checklist} labelPrefix="thinkingLab.idea.pass" />
                {idea.canRevise && onReviseIdea ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2 gap-1.5"
                    disabled={Boolean(pendingAction)}
                    aria-busy={pendingAction === "revise-idea" || undefined}
                    onClick={() => onReviseIdea(idea.id)}
                  >
                    {pendingAction === "revise-idea" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                    {t("thinkingLab.idea.revise", "Revise")}
                  </Button>
                ) : null}
                {(idea.decision === "DITOLAK" || idea.decision === "BELUM_TERVERIFIKASI") && idea.canRevise === false ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("thinkingLab.idea.revisionClosed", "This idea stays rejected. It has already been revised three times.")}
                  </p>
                ) : null}
                {idea.mechanismKeys && idea.mechanismKeys.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">
                      {t("thinkingLab.idea.keys", "Keys")}
                    </p>
                    {idea.mechanismKeys.map((key, index) => (
                      <p key={`${idea.id}-key-${index}`} className="text-sm leading-relaxed text-muted-foreground">
                        {key.otherExplanation}. {key.close}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}