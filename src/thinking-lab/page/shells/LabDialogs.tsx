import type { QueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { SaveToPlanModal } from "@/6-1-script-generator/components/SaveToPlanModal";
import { invalidateContentPillarQueries } from "@/6-1-dashboard/lib/contentPillarTracker";
import { PillarPickerSheet } from "@/thinking-lab/section/PillarPickerSheet";
import { ExecutionConfirmDialog } from "@/thinking-lab/section/ExecutionConfirmDialog";
import { leadMagnetBriefForPillar } from "@/thinking-lab/creative-idea/paths";
import { savePillarMediumDefault } from "@/thinking-lab/execution/pillarDefaults";
import type { ScriptDecision } from "@/thinking-lab/execution/confirm";
import { buildPlanScript, imageContentTypeName } from "@/thinking-lab/execution/script";
import type { LabIdea } from "@/thinking-lab/idea/repository";
import type { MutableRefObject } from "react";

export type PendingDelete =
  | { kind: "master"; id: string }
  | { kind: "bigThought"; id: string }
  | { kind: "territory"; id: string; bigThoughtId: string }
  | { kind: "angle"; id: string; territoryId: string }
  | { kind: "idea"; id: string; angleId: string }
  | { kind: "execution"; id: string };

type LabDialogsProps = {
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string;
  queryClient: QueryClient;
  organizationId: string | null;
  busy: boolean;
  pendingDelete: PendingDelete | null;
  setPendingDelete: (value: PendingDelete | null) => void;
  confirmDelete: () => void;
  pillarPickerOpen: boolean;
  setPillarPickerOpen: (open: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contentPillars: any[];
  masterSells: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pillarMediums: Record<string, any>;
  executionDirect: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loadScriptConfirm: (settings: any) => void;
  rememberedDevelopment: (pillarId: string) => string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scriptConfirm: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setScriptConfirm: (value: any) => void;
  confirmToken: MutableRefObject<number>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  askScriptDiscovery: (scriptConfirm: any, mode: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onGenerateExecutions: (...args: any[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ideaDiscover: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setIdeaDiscover: (value: any) => void;
  ideaDiscoverToken: MutableRefObject<number>;
  onGenerateIdea: (angleId: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  writeGeneratedIdeas: (angleId: string, payload: any) => void;
  planSaveOpen: boolean;
  setPlanSaveOpen: (open: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  focusedExecution: any;
  focusedIdea: LabIdea | null;
  pillarCardsFor: (idea: LabIdea) => { contentPillarId: string; leadMagnet?: boolean }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  creativeReviews: any;
};

export function LabDialogs({
  t,
  queryClient,
  organizationId,
  busy,
  pendingDelete,
  setPendingDelete,
  confirmDelete,
  pillarPickerOpen,
  setPillarPickerOpen,
  contentPillars,
  masterSells,
  pillarMediums,
  executionDirect,
  loadScriptConfirm,
  rememberedDevelopment,
  scriptConfirm,
  setScriptConfirm,
  confirmToken,
  askScriptDiscovery,
  onGenerateExecutions,
  ideaDiscover,
  setIdeaDiscover,
  ideaDiscoverToken,
  onGenerateIdea,
  writeGeneratedIdeas,
  planSaveOpen,
  setPlanSaveOpen,
  focusedExecution,
  focusedIdea,
  pillarCardsFor,
  creativeReviews,
}: LabDialogsProps) {
  return (
    <>
      <PillarPickerSheet
        open={pillarPickerOpen}
        pillars={contentPillars}
        masterSells={masterSells}
        pending={busy}
        mediumByPillar={pillarMediums}
        direct={executionDirect}
        onOpenChange={setPillarPickerOpen}
        onConfirm={(pillars, audio, look, speech, durationSeconds, brandName, cta, image) => {
          const pillar = pillars[0];
          if (pillar && organizationId) {
            void savePillarMediumDefault(organizationId, pillar.id, image ? "image" : "video").then(() => {
              void queryClient.invalidateQueries({ queryKey: ["thinking-lab-pillar-defaults", organizationId] });
            });
          }
          loadScriptConfirm({
            pillars,
            audio,
            look,
            speech,
            durationSeconds,
            brandName,
            cta,
            image,
            pillarDevelopment: pillar ? rememberedDevelopment(pillar.id) : null,
          });
        }}
      />
      <ExecutionConfirmDialog
        open={scriptConfirm !== null}
        loading={scriptConfirm?.loading ?? false}
        failed={scriptConfirm?.failed ?? false}
        questions={scriptConfirm?.questions ?? null}
        pending={busy}
        choosingMode={scriptConfirm?.phase === "mode"}
        onChooseMode={(mode) => {
          if (!scriptConfirm) return;
          askScriptDiscovery(scriptConfirm, mode);
        }}
        onOpenChange={(open) => {
          if (open) return;
          confirmToken.current += 1;
          setScriptConfirm(null);
        }}
        onRetry={() => {
          if (!scriptConfirm?.discovery) return;
          askScriptDiscovery(scriptConfirm, scriptConfirm.discovery);
        }}
        onConfirm={(answers) => {
          if (!scriptConfirm) return;
          const settings = scriptConfirm;
          confirmToken.current += 1;
          setScriptConfirm(null);
          const questions = settings.questions ?? [];
          const chosenDecisions: ScriptDecision[] = questions.flatMap((question) => {
            const answer = answers.find((item) => item.question === question.prompt)?.answer.trim() ?? "";
            if (!answer) return [];
            return [{ category: question.category, question: question.prompt, answer, binds: question.binds }];
          });
          onGenerateExecutions(
            settings.pillars,
            settings.audio,
            settings.look,
            settings.speech,
            null,
            settings.durationSeconds,
            settings.brandName,
            settings.cta,
            chosenDecisions.find((row) => row.binds === "viewpoint")?.answer ?? null,
            chosenDecisions,
            false,
            null,
            settings.image,
            false,
            null,
            null,
            settings.pillarDevelopment,
          );
        }}
      />
      <ExecutionConfirmDialog
        open={ideaDiscover !== null}
        loading={ideaDiscover?.loading ?? false}
        failed={ideaDiscover?.failed ?? false}
        questions={ideaDiscover?.questions ?? null}
        pending={busy}
        title={t("thinkingLab.idea.discoverTitle", "Confirm the situation")}
        hint={t(
          "thinkingLab.idea.discoverHint",
          "The chain is read first. Choose the situation these Ideas live in, then the sentences are written.",
        )}
        loadingText={t("thinkingLab.idea.discoverLoading", "Reading the chain from the Master Thought through the Angle...")}
        failedText={t("thinkingLab.idea.discoverFailed", "The situation questions could not be read. Try again.")}
        confirmText={t("thinkingLab.idea.discoverWrite", "Write the Ideas")}
        onOpenChange={(open) => {
          if (open) return;
          ideaDiscoverToken.current += 1;
          setIdeaDiscover(null);
        }}
        onRetry={() => {
          if (!ideaDiscover) return;
          onGenerateIdea(ideaDiscover.angleId);
        }}
        onConfirm={(answers) => {
          if (!ideaDiscover) return;
          const pending = ideaDiscover;
          ideaDiscoverToken.current += 1;
          setIdeaDiscover(null);
          const questions = pending.questions ?? [];
          const decisions = questions.flatMap((question) => {
            const answer = answers.find((item) => item.question === question.prompt)?.answer.trim() ?? "";
            if (!answer) return [];
            return [{ category: question.category, question: question.prompt, answer }];
          });
          writeGeneratedIdeas(pending.angleId, { angleFingerprint: pending.angleFingerprint, decisions });
        }}
      />
      <SaveToPlanModal
        isOpen={planSaveOpen && Boolean(focusedExecution?.script)}
        onClose={() => setPlanSaveOpen(false)}
        script={focusedExecution?.script ? buildPlanScript(focusedExecution.script) : ""}
        formDataForPlan={
          focusedExecution?.contentPillarId ? { content_pillar_id: focusedExecution.contentPillarId } : null
        }
        lockedTitle={focusedExecution?.script?.title ?? ""}
        lockedPillarId={focusedExecution?.contentPillarId}
        leadMagnet={
          focusedIdea &&
          focusedExecution?.contentPillarId &&
          pillarCardsFor(focusedIdea).some(
            (card) => card.contentPillarId === focusedExecution.contentPillarId && card.leadMagnet,
          )
            ? leadMagnetBriefForPillar(
                focusedIdea.developmentPaths,
                focusedExecution.contentPillarId,
                creativeReviews,
              )
            : null
        }
        lockedContentTypeName={
          focusedExecution?.script?.medium === "image"
            ? imageContentTypeName(focusedExecution.script.image?.format ?? "single")
            : null
        }
        preserveTableColumns
        syncPlanIdentity
        onSuccess={() => {
          void invalidateContentPillarQueries(queryClient, organizationId);
        }}
      />
      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDelete?.kind === "territory"
                ? t("thinkingLab.confirm.deleteTerritoryTitle", "Delete this Territory?")
                : pendingDelete?.kind === "angle"
                  ? t("thinkingLab.confirm.deleteAngleTitle", "Delete this Angle?")
                  : pendingDelete?.kind === "bigThought"
                  ? t("thinkingLab.confirm.deleteBigThoughtTitle", "Delete this Big Thought?")
                  : pendingDelete?.kind === "idea"
                    ? t("thinkingLab.confirm.deleteIdeaTitle", "Delete this Idea?")
                  : pendingDelete?.kind === "execution"
                    ? t("thinkingLab.confirm.deleteExecutionTitle", "Delete this Execution?")
                    : t("thinkingLab.confirm.deleteTitle", "Delete this Master Thought?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.kind === "territory"
                ? t(
                    "thinkingLab.confirm.deleteTerritoryBody",
                    "This deletes the Territory and the Angles under it. This cannot be undone.",
                  )
                : pendingDelete?.kind === "angle"
                  ? t(
                      "thinkingLab.confirm.deleteAngleBody",
                      "This deletes the Angle and the Ideas under it. This cannot be undone.",
                    )
                  : pendingDelete?.kind === "bigThought"
                  ? t(
                      "thinkingLab.confirm.deleteBigThoughtBody",
                      "This deletes the Big Thought and the Territories and Angles under it. This cannot be undone.",
                    )
                  : pendingDelete?.kind === "idea"
                    ? t(
                        "thinkingLab.confirm.deleteIdeaBody",
                        "This deletes the Idea and the Executions under it. This cannot be undone.",
                      )
                  : pendingDelete?.kind === "execution"
                    ? t(
                        "thinkingLab.confirm.deleteExecutionBody",
                        "This deletes the Script VO for this pillar. This cannot be undone.",
                      )
                    : t(
                "thinkingLab.confirm.deleteBody",
                "This deletes the Master Thought and everything under it: Big Thoughts, plus any Territories, Angles, and Ideas. This cannot be undone.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              {t("thinkingLab.confirm.deleteAction", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}