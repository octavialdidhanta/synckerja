import { useEffect, useState } from "react";
import { ChevronRight, Copy, Loader2, MoreVertical, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import {
  allPromptsCopy,
  lineAudio,
  lineMasterPrompt,
  visibleShotPrompt,
  narrationDurationSeconds,
  scriptDurationSeconds,
  scriptLineRepairReady,
  voiceOverCopy,
  type CharacterVisualKind,
  type VoiceOverScript,
} from "@/thinking-lab/execution/script";
import { characterVisualUrl, type CharacterGeneratePhase } from "@/thinking-lab/execution/generateCharacterVisual";
import { CharacterVisualSlots, type CharacterStudioTab } from "@/thinking-lab/section/CharacterVisualStudio";
import type { ExecutionRelation, ExecutionSemanticFacts } from "@/thinking-lab/execution/types";

export type CharacterGenerateState = { handle: string; phase: CharacterGeneratePhase } | null;

export type ExecutionRunPhase = "write" | "audit" | "repair";

const RELATION_COPY: Record<ExecutionRelation, string> = {
  VALID_EXECUTION: "The script carries the Idea and a viewer can climb to the Master Thought.",
  MESSAGE_ADDED: "Some lines add a claim the Idea does not carry.",
  MECHANISM_HIDDEN: "The Idea's mechanism is not visible in this script.",
  PILLAR_OUTSIDE: "This pillar forces a message outside the Idea.",
  PILLAR_NOT_SELLING: "Flash Sale Hook needs a Master Thought that is actually selling.",
  CLIMB_MISSED: "A viewer does not climb from this script to the Master Thought.",
  SUBJECT_MISMATCH: "The viewer reaches a different subject than the Master Thought.",
  UNRESOLVED: "The check could not finish.",
};

function ExecutionMenu({ onDelete, pending = false }: { onDelete?: () => void; pending?: boolean }) {
  const { t } = useAppTranslation();
  if (!onDelete) return null;
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
        <DropdownMenuItem
          className="cursor-pointer gap-2 text-destructive focus:text-destructive"
          disabled={pending}
          onSelect={() => onDelete()}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t("thinkingLab.action.delete", "Delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PostPack({ title, caption }: { title: string; caption: string }) {
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

function StoredCharacterImage({
  path,
  revision = 0,
  alt,
  className,
  deleteLabel,
  deleting = false,
  disabled = false,
  onDelete,
}: {
  path: string;
  revision?: number;
  alt: string;
  className: string;
  deleteLabel: string;
  deleting?: boolean;
  disabled?: boolean;
  onDelete?: () => void;
}) {
  const { t } = useAppTranslation();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancel = false;
    setUrl(null);
    void characterVisualUrl(path).then((next) => {
      if (!cancel) setUrl(next);
    });
    return () => {
      cancel = true;
    };
  }, [path, revision]);
  return (
    <div className={cn("relative", className)}>
      {url ? (
        <img key={`${path}-${revision}`} src={url} alt={alt} className="h-full w-full rounded-md bg-white object-contain" />
      ) : (
        <div className="h-full w-full animate-pulse rounded-md bg-muted" aria-hidden />
      )}
      {onDelete ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="absolute right-1.5 top-1.5 h-7 gap-1 rounded-md px-2 text-xs shadow-sm"
          aria-label={deleteLabel}
          title={deleteLabel}
          disabled={disabled || deleting}
          onClick={onDelete}
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Trash2 className="h-3.5 w-3.5" aria-hidden />}
          {t("thinkingLab.execution.deleteVisual", "Delete")}
        </Button>
      ) : null}
    </div>
  );
}

const COMPACT_BUTTON = "h-7 rounded-md px-2.5 text-xs";

function AssetList({
  script,
  onGenerateCharacter,
  onStoreCharacterVisual,
  onDeleteCharacterVisual,
  generating = null,
  deleting = null,
  saving = null,
}: {
  script: VoiceOverScript;
  onGenerateCharacter?: (handle: string) => void;
  onStoreCharacterVisual?: (handle: string, kind: CharacterStudioTab, source: File | { storagePath: string }) => void;
  onDeleteCharacterVisual?: (handle: string, kind: CharacterVisualKind) => void;
  generating?: CharacterGenerateState;
  deleting?: { handle: string; kind: CharacterVisualKind } | null;
  saving?: { handle: string; kind: CharacterStudioTab } | null;
}) {
  const { t } = useAppTranslation();
  const groups = [
    ["Location", script.assets.locations, false],
    ["Character", script.assets.characters, true],
    ["Property", script.assets.properties, false],
  ] as const;
  return (
    <div className="space-y-3 text-sm">
      {groups.map(([label, items, isCharacter]) =>
        items.length === 0 ? null : (
          <div key={label}>
            <p className="font-medium text-foreground">{label}</p>
            <ul className="mt-1 space-y-3">
              {items.map((item) => {
                const busy = generating?.handle === item.handle;
                const hasVisual = Boolean(item.portraitPath || item.sheetPath);
                return (
                  <li key={item.handle} className="text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1">
                        <span className="font-medium text-foreground">{item.handle}</span>
                        {item.description ? ` ${item.description}` : ""}
                      </p>
                    </div>
                    {isCharacter && onStoreCharacterVisual && onDeleteCharacterVisual ? (
                      <CharacterVisualSlots
                        character={item}
                        savingKind={saving?.handle === item.handle ? saving.kind : null}
                        deletingKind={deleting?.handle === item.handle ? deleting.kind : null}
                        disabled={Boolean(generating) || (Boolean(deleting) && deleting?.handle !== item.handle) || (Boolean(saving) && saving?.handle !== item.handle)}
                        onUploadFile={(kind, file) => onStoreCharacterVisual(item.handle, kind, file)}
                        onUseProjectImage={(kind, storagePath) => onStoreCharacterVisual(item.handle, kind, { storagePath })}
                        onDelete={(kind) => onDeleteCharacterVisual(item.handle, kind)}
                        onGenerate={onGenerateCharacter ? () => onGenerateCharacter(item.handle) : undefined}
                        generating={busy}
                        generateLabel={
                          busy
                            ? generating?.phase === "sheet"
                              ? t("thinkingLab.execution.generatingSheet", "Character sheet...")
                              : t("thinkingLab.execution.generatingPortrait", "Portrait...")
                            : hasVisual
                              ? t("thinkingLab.execution.regenerateCharacter", "Generate again")
                              : t("thinkingLab.execution.generateCharacter", "Generate")
                        }
                      />
                    ) : null}
                    {isCharacter && item.sheetPath ? (
                      <StoredCharacterImage
                        path={item.sheetPath}
                        revision={item.visualRevision}
                        alt={t("thinkingLab.execution.characterSheet", "Character sheet")}
                        className="mx-auto mt-4 aspect-video w-full max-w-xl"
                        deleteLabel={t("thinkingLab.execution.deleteSheet", "Delete character sheet")}
                        deleting={deleting?.handle === item.handle && deleting.kind === "sheet"}
                        disabled={Boolean(generating) || Boolean(deleting) || Boolean(saving)}
                        onDelete={onDeleteCharacterVisual ? () => onDeleteCharacterVisual(item.handle, "sheet") : undefined}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ),
      )}
    </div>
  );
}

const SCENE_COLUMN_WIDTHS = ["16rem", "10rem", "8rem", "14rem", "20rem", "28rem"] as const;
const SCENE_COLUMN_SHARES = ["16%", "10%", "8%", "14%", "22%", "30%"] as const;

function SceneTables({ script, failing, fill = false }: { script: VoiceOverScript; failing: Set<string>; fill?: boolean }) {
  const { t } = useAppTranslation();
  const copyPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      return;
    }
  };
  return (
    <div className="space-y-4">
      {script.scenes.map((scene) => (
        <section key={scene.id} className="overflow-hidden rounded-lg border border-border">
          <h3 className="border-b border-border bg-muted/50 px-3 py-2 text-sm font-semibold">{scene.title}</h3>
          <div className="scrollbar-hide overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table
              className={cn("table-fixed border-collapse text-left text-sm", fill && "w-full")}
              style={fill ? undefined : { width: "80rem" }}
            >
              <colgroup>
                {(fill ? SCENE_COLUMN_SHARES : SCENE_COLUMN_WIDTHS).map((width, index) => (
                  <col key={index} style={{ width }} />
                ))}
              </colgroup>
              <thead className="bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{t("thinkingLab.execution.vo", "VO / Narration")}</th>
                  <th className="px-3 py-2 font-medium">{t("thinkingLab.execution.shot", "Shot")}</th>
                  <th className="px-3 py-2 font-medium">{t("thinkingLab.execution.angle", "Angle")}</th>
                  <th className="px-3 py-2 font-medium">{t("thinkingLab.execution.visual", "Visual function")}</th>
                  <th className="px-3 py-2 font-medium">{t("thinkingLab.execution.prompt", "Veo 3 prompt")}</th>
                  <th className="px-3 py-2 font-medium">{t("thinkingLab.execution.masterPrompt", "Master prompt")}</th>
                </tr>
              </thead>
              <tbody>
                {scene.lines.flatMap((line) => {
                  const shots = line.shots.length > 0 ? line.shots : [null];
                  const master = lineMasterPrompt(line, lineAudio(script, line), script.look);
                  return shots.map((shot, index) => {
                    const prompt = visibleShotPrompt(line, index);
                    return (
                    <tr key={shot?.id ?? `${line.id}-empty`} className="border-t border-border align-top">
                      {index === 0 ? (
                        <td className={cn("px-3 py-2 break-words", failing.has(line.id) && "bg-rose-50")} rowSpan={shots.length}>
                          <p className="whitespace-pre-wrap break-words">{line.narration}</p>
                          {failing.has(line.id) ? (
                            <p className="mt-1 text-xs text-rose-700">
                              {script.lineIssues.find((issue) => issue.lineId === line.id)?.reason}
                            </p>
                          ) : null}
                        </td>
                      ) : null}
                      <td className="break-words px-3 py-2">{shot?.role}</td>
                      <td className="break-words px-3 py-2">{shot?.angle}</td>
                      <td className="break-words px-3 py-2">{shot?.visualFunction}</td>
                      <td className="px-3 py-2">
                        {prompt ? (
                          <div className="flex items-start gap-2 rounded-md bg-muted px-2 py-1.5">
                            <p className="min-w-0 flex-1 whitespace-pre-wrap font-mono text-xs">{prompt}</p>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 shrink-0 p-0"
                              aria-label={t("thinkingLab.execution.copyPrompt", "Copy prompt")}
                              title={t("thinkingLab.execution.copyPrompt", "Copy prompt")}
                              onClick={() => void copyPrompt(prompt)}
                            >
                              <Copy className="h-3.5 w-3.5" aria-hidden />
                            </Button>
                          </div>
                        ) : null}
                      </td>
                      {index === 0 ? (
                        <td className="px-3 py-2" rowSpan={shots.length}>
                          {master ? (
                            <div className="flex items-start gap-2 rounded-md bg-muted px-2 py-1.5">
                              <p className="min-w-0 flex-1 whitespace-pre-wrap font-mono text-xs">{master}</p>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 shrink-0 p-0"
                                aria-label={t("thinkingLab.execution.copyMasterPrompt", "Copy master prompt")}
                                title={t("thinkingLab.execution.copyMasterPrompt", "Copy master prompt")}
                                onClick={() => void copyPrompt(master)}
                              >
                                <Copy className="h-3.5 w-3.5" aria-hidden />
                              </Button>
                            </div>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

export function ExecutionScriptPanel({
  pillarName,
  statement,
  script,
  admission,
  facts,
  progress = null,
  pending = false,
  onStop,
  onRepair,
  onRewrite,
  onChangePillar,
  onViewTable,
  onDelete,
  onGenerateCharacter,
  onStoreCharacterVisual,
  onDeleteCharacterVisual,
  generatingCharacter = null,
  deletingCharacterVisual = null,
  savingCharacterVisual = null,
}: {
  pillarName: string;
  statement: string;
  script: VoiceOverScript | null;
  admission: string;
  facts: ExecutionSemanticFacts;
  progress?: { phase: ExecutionRunPhase; pillarName: string } | null;
  pending?: boolean;
  onStop?: () => void;
  onRepair?: () => void;
  onRewrite?: () => void;
  onChangePillar?: () => void;
  onViewTable?: () => void;
  onDelete?: () => void;
  onGenerateCharacter?: (handle: string) => void;
  onStoreCharacterVisual?: (handle: string, kind: CharacterStudioTab, source: File | { storagePath: string }) => void;
  onDeleteCharacterVisual?: (handle: string, kind: CharacterVisualKind) => void;
  generatingCharacter?: CharacterGenerateState;
  deletingCharacterVisual?: { handle: string; kind: CharacterVisualKind } | null;
  savingCharacterVisual?: { handle: string; kind: CharacterStudioTab } | null;
}) {
  const { t } = useAppTranslation();
  const [tab, setTab] = useState<"script" | "execution">("script");
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const duration = script ? scriptDurationSeconds(script) : narrationDurationSeconds(statement);
  const failing = new Set(script?.lineIssues.map((issue) => issue.lineId) ?? []);
  const passed = admission === "GENERATE_VALID" && failing.size === 0;
  const repairReady = scriptLineRepairReady(facts, script);
  const needsAnotherPillar =
    facts.relationToParent === "MESSAGE_ADDED" ||
    facts.relationToParent === "PILLAR_OUTSIDE" ||
    facts.relationToParent === "PILLAR_NOT_SELLING";
  const scriptWarning = failing.size > 0;
  const executionWarning = !passed;

  const copyText = async (value: string) => {
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
  };

  return (
    <div className="scrollbar-hide flex h-full min-h-0 flex-col gap-4 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-violet-700">
              <span className="h-3.5 w-3.5 shrink-0 rounded-[4px] bg-violet-500" aria-hidden />
              {t("thinkingLab.execution.label", "Execution")}
            </p>
            <h2 className="text-2xl font-bold leading-tight tracking-tight text-slate-900">{pillarName}</h2>
          </div>
          <ExecutionMenu onDelete={onDelete} pending={pending || Boolean(progress)} />
        </div>
        <div className="grid w-full grid-cols-2 rounded-lg bg-muted p-1 text-sm font-medium">
          <button
            type="button"
            className={cn("rounded-md px-3 py-2", tab === "script" ? "bg-background shadow-sm" : "text-muted-foreground")}
            onClick={() => setTab("script")}
          >
            {t("thinkingLab.execution.scriptTab", "Script VO")}
            {scriptWarning ? " !" : ""}
          </button>
          <button
            type="button"
            className={cn("rounded-md px-3 py-2", tab === "execution" ? "bg-background shadow-sm" : "text-muted-foreground")}
            onClick={() => setTab("execution")}
          >
            {t("thinkingLab.execution.executionTab", "Execution")}
            {executionWarning ? " !" : ""}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", passed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800")}>
            {passed ? t("thinkingLab.execution.passed", "Passed") : t("thinkingLab.execution.failed", "Not passed")}
          </span>
          {duration > 0 ? (
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {t("thinkingLab.execution.seconds", "{{count}} seconds", { count: duration })}
            </span>
          ) : null}
          {!passed ? (
            <button
              type="button"
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              aria-expanded={reasonOpen}
              aria-label={t("thinkingLab.execution.whyFailed", "Why not passed")}
              onClick={() => setReasonOpen((open) => !open)}
            >
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", reasonOpen && "rotate-90")} aria-hidden />
            </button>
          ) : null}
        </div>
        {!passed && reasonOpen ? (
          <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
            <p>{t(`thinkingLab.execution.relation.${facts.relationToParent}`, RELATION_COPY[facts.relationToParent])}</p>
            {(script?.lineIssues ?? []).map((issue) => (
              <p key={issue.lineId}>{issue.reason}</p>
            ))}
          </div>
        ) : null}
      </header>
      {progress ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted/40 px-3 py-3">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {progress.phase === "write"
              ? t("thinkingLab.execution.writing", "Writing the voice-over script for {{pillar}}...", { pillar: progress.pillarName })
              : progress.phase === "repair"
                ? t("thinkingLab.execution.repairing", "Repairing only the failing lines...")
                : t("thinkingLab.execution.auditing", "Tracing the script path up to the Master Thought...")}
          </p>
          {onStop ? (
            <Button type="button" size="sm" variant="outline" onClick={onStop}>
              {t("thinkingLab.execution.stop", "Stop")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {!progress && !passed && !repairReady ? (
        needsAnotherPillar ? (
          onChangePillar ? (
            <div>
              <Button type="button" size="sm" onClick={onChangePillar} disabled={pending}>
                {t("thinkingLab.execution.changePillar", "Choose another pillar")}
              </Button>
            </div>
          ) : null
        ) : onRewrite ? (
          <div>
            <Button type="button" size="sm" onClick={onRewrite} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {t("thinkingLab.execution.rewrite", "Rewrite this execution")}
            </Button>
          </div>
        ) : null
      ) : null}
      {tab === "script" ? (
        <div className="space-y-4">
          {repairReady && !progress ? (
            <div className="space-y-3 rounded-lg border border-border bg-muted/40 px-3 py-3">
              <p className="text-sm font-medium">{t("thinkingLab.execution.next", "Next step")}</p>
              <p className="text-sm leading-relaxed text-foreground">
                {t(
                  "thinkingLab.execution.repairReady",
                  "Repair checks the belief chain and rewrites only the lines that install another cause. The other lines and their shots stay.",
                )}
              </p>
              {onRepair ? (
                <Button type="button" size="sm" onClick={onRepair} disabled={pending}>
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {t("thinkingLab.execution.repair", "Repair the failing lines")}
                </Button>
              ) : null}
            </div>
          ) : null}
          {script ? (
            <>
              <PostPack title={script.title} caption={script.caption} />
              <button type="button" className="flex items-center gap-2 text-sm font-medium" onClick={() => setAssetsOpen((current) => !current)}>
                <ChevronRight className={cn("h-4 w-4 transition-transform", assetsOpen && "rotate-90")} aria-hidden />
                {t("thinkingLab.execution.assets", "Asset list")}
              </button>
              {assetsOpen ? (
                <AssetList
                  script={script}
                  onGenerateCharacter={onGenerateCharacter}
                  onStoreCharacterVisual={onStoreCharacterVisual}
                  onDeleteCharacterVisual={onDeleteCharacterVisual}
                  generating={generatingCharacter}
                  deleting={deletingCharacterVisual}
                  saving={savingCharacterVisual}
                />
              ) : null}
              <div className="flex flex-wrap gap-1.5">
                {onViewTable ? (
                  <Button type="button" size="sm" variant="outline" className={COMPACT_BUTTON} onClick={onViewTable}>
                    {t("thinkingLab.execution.viewTable", "View as table")}
                  </Button>
                ) : null}
                <Button type="button" size="sm" variant="outline" className={COMPACT_BUTTON} onClick={() => void copyText(voiceOverCopy(script))}>
                  {t("thinkingLab.execution.copyVo", "Copy VO script")}
                </Button>
                <Button type="button" size="sm" variant="outline" className={COMPACT_BUTTON} onClick={() => void copyText(allPromptsCopy(script))}>
                  {t("thinkingLab.execution.copyPrompts", "Copy all prompts")}
                </Button>
              </div>
              <SceneTables script={script} failing={failing} />
            </>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{statement}</p>
          )}
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm leading-relaxed">
          <p className="font-medium">{t("thinkingLab.execution.statusTitle", "Check result")}</p>
          <p>{t(`thinkingLab.execution.relation.${facts.relationToParent}`, RELATION_COPY[facts.relationToParent])}</p>
          {facts.whatItSays ? <p className="text-muted-foreground">{facts.whatItSays}</p> : null}
          <ul className="space-y-1 text-muted-foreground">
            <li>
              {t("thinkingLab.execution.climb", "Path to Master Thought")}:{" "}
              {facts.viewerClimb === "CLIMBS"
                ? t("thinkingLab.execution.climbs", "Climbs")
                : facts.viewerClimb === "OTHER" || facts.viewerClimb === "NEGATIVE"
                  ? t("thinkingLab.execution.misses", "Does not climb")
                  : t("thinkingLab.execution.unresolved", "Unresolved")}
            </li>
            <li>
              {t("thinkingLab.execution.message", "Idea message")}:{" "}
              {facts.messageAdded === false
                ? t("thinkingLab.execution.messageKept", "Stays with the Idea")
                : facts.messageAdded === true
                  ? t("thinkingLab.execution.messageAdded", "A new claim was added")
                  : t("thinkingLab.execution.unresolved", "Unresolved")}
            </li>
            <li>
              {t("thinkingLab.execution.fit", "Pillar fit")}:{" "}
              {facts.pillarOutside === false
                ? t("thinkingLab.execution.fitInside", "Realizes the Idea")
                : facts.pillarOutside === true
                  ? t("thinkingLab.execution.fitOutside", "Forces a message outside the Idea")
                  : t("thinkingLab.execution.unresolved", "Unresolved")}
            </li>
            {duration > 0 ? <li>{t("thinkingLab.execution.seconds", "{{count}} seconds", { count: duration })}</li> : null}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ExecutionScriptTable({
  pillarName,
  script,
  onClose,
  onDelete,
  onSaveToPlan,
  onGenerateCharacter,
  onStoreCharacterVisual,
  onDeleteCharacterVisual,
  generatingCharacter = null,
  deletingCharacterVisual = null,
  savingCharacterVisual = null,
}: {
  pillarName: string;
  script: VoiceOverScript;
  onClose: () => void;
  onDelete?: () => void;
  onSaveToPlan?: () => void;
  onGenerateCharacter?: (handle: string) => void;
  onStoreCharacterVisual?: (handle: string, kind: CharacterStudioTab, source: File | { storagePath: string }) => void;
  onDeleteCharacterVisual?: (handle: string, kind: CharacterVisualKind) => void;
  generatingCharacter?: CharacterGenerateState;
  deletingCharacterVisual?: { handle: string; kind: CharacterVisualKind } | null;
  savingCharacterVisual?: { handle: string; kind: CharacterStudioTab } | null;
}) {
  const { t } = useAppTranslation();
  const duration = scriptDurationSeconds(script);
  const failing = new Set(script.lineIssues.map((issue) => issue.lineId));
  const copyText = async (value: string) => {
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
  };
  return (
    <div className="scrollbar-hide flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-card p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">{t("thinkingLab.execution.scriptTab", "Script VO")}</h2>
          <p className="text-sm text-muted-foreground">
            {pillarName}
            {script.scenes.length > 0
              ? ` · ${t("thinkingLab.execution.sceneCount", "{{count}} scenes, {{seconds}} seconds", { count: script.scenes.length, seconds: duration })}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button type="button" size="sm" variant="outline" className={COMPACT_BUTTON} onClick={() => void copyText(voiceOverCopy(script))}>
            {t("thinkingLab.execution.copyVo", "Copy VO script")}
          </Button>
          <Button type="button" size="sm" variant="outline" className={COMPACT_BUTTON} onClick={() => void copyText(allPromptsCopy(script))}>
            {t("thinkingLab.execution.copyPrompts", "Copy all prompts")}
          </Button>
          {onSaveToPlan ? (
            <Button type="button" size="sm" variant="outline" className={COMPACT_BUTTON} onClick={onSaveToPlan}>
              {t("scriptGenerator.saveToPlanButton", "Save to Plan")}
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" className={COMPACT_BUTTON} onClick={onClose}>
            {t("thinkingLab.execution.close", "Close")}
          </Button>
          <ExecutionMenu onDelete={onDelete} />
        </div>
      </div>
      <PostPack title={script.title} caption={script.caption} />
      <AssetList
        script={script}
        onGenerateCharacter={onGenerateCharacter}
        onStoreCharacterVisual={onStoreCharacterVisual}
        onDeleteCharacterVisual={onDeleteCharacterVisual}
        generating={generatingCharacter}
        deleting={deletingCharacterVisual}
        saving={savingCharacterVisual}
      />
      <SceneTables script={script} failing={failing} fill />
    </div>
  );
}
