import { Copy, Loader2, RefreshCw, Wrench } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import {
  lineAudio,
  lineMasterPrompt,
  visibleShotPrompt,
  type VoiceOverScript,
} from "@/thinking-lab/execution/script";

const SCENE_COLUMN_WIDTHS = ["16rem", "10rem", "8rem", "14rem", "20rem", "28rem"] as const;
const SCENE_COLUMN_SHARES = ["16%", "10%", "8%", "14%", "22%", "30%"] as const;

export function SceneTables({
  script,
  failing,
  fill = false,
  pending = false,
  fixingLineId = null,
  onFixLine,
  onRegenerateLine,
  fixable,
  reasonFor,
}: {
  script: VoiceOverScript;
  failing: Set<string>;
  fill?: boolean;
  pending?: boolean;
  fixingLineId?: string | null;
  onFixLine?: (lineId: string) => void;
  onRegenerateLine?: (lineId: string) => void;
  fixable?: Set<string>;
  reasonFor?: (lineId: string) => string;
}) {
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
                            <p className="mt-2 text-xs text-rose-700">
                              {reasonFor?.(line.id) ||
                                (script.productionIssues ?? []).find((issue) => issue.lineId === line.id)?.reason ||
                                script.lineIssues.find((issue) => issue.lineId === line.id)?.reason}
                            </p>
                          ) : null}
                          {onFixLine || onRegenerateLine ? (
                            <div className="mt-2 flex flex-wrap items-center gap-1">
                              {failing.has(line.id) && onFixLine && (!fixable || fixable.has(line.id)) ? (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  className="h-6 w-6 shrink-0"
                                  disabled={pending}
                                  aria-busy={fixingLineId === line.id}
                                  aria-label={t("thinkingLab.execution.fixLine", "Fix this line")}
                                  title={t("thinkingLab.execution.fixLine", "Fix this line")}
                                  onClick={() => onFixLine(line.id)}
                                >
                                  {fixingLineId === line.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                                  ) : (
                                    <Wrench className="h-3 w-3" aria-hidden />
                                  )}
                                </Button>
                              ) : null}
                              {onRegenerateLine ? (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  className="h-6 w-6 shrink-0"
                                  disabled={pending}
                                  aria-busy={fixingLineId === line.id}
                                  aria-label={t("thinkingLab.execution.regenerateLine", "Regenerate this line")}
                                  title={t("thinkingLab.execution.regenerateLine", "Regenerate this line")}
                                  onClick={() => onRegenerateLine(line.id)}
                                >
                                  {fixingLineId === line.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                                  ) : (
                                    <RefreshCw className="h-3 w-3" aria-hidden />
                                  )}
                                </Button>
                              ) : null}
                            </div>
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
