import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { StoryboardActionShell } from "@/6-1-dashboard/modal/StoryboardActionShell";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { isGeminiBillingNoticeError } from "@/shared/ai/geminiSpendCap";
import { toast } from "sonner";
import { useDigitalAssetCharactersListQuery } from "@/6-1-social-media-settings/hooks/useDigitalAssetsListQueries";
import {
  generateBriefSceneImageFile,
  lookFromStoryboardFilm,
  type StoryboardFilmContext,
} from "@/6-1-dashboard/lib/generateBriefSceneImage";
import {
  lookIsUgc,
  promptSlideForImage,
  readNarration,
  readShotBrief,
  UGC_LOOK_COMPONENTS,
} from "@/6-1-dashboard/lib/seedanceVideo";
import { briefAuditField } from "@/6-1-dashboard/modal/briefFieldVersions";
import type { BriefImageSceneVersion } from "@/6-1-dashboard/hook/useBriefStoryboardImages";
import { BriefMentionField } from "@/6-1-dashboard/modal/BriefMentionField";

type UploadImages = (
  rowIndex: number,
  files: File[],
  promptOverride?: string | BriefImageSceneVersion | null,
) => Promise<unknown>;

export function BriefImagePromptDialog({
  open,
  rowIndex,
  headers,
  row,
  imageColumnIndex,
  film,
  planId,
  characterIds = [],
  startingShot = null,
  startingAngle = null,
  startingVisual = null,
  startingPrompt = null,
  onUploadImages,
  onClose,
  onCreated,
}: {
  open: boolean;
  rowIndex: number;
  headers: string[];
  row: string[];
  imageColumnIndex: number;
  film?: StoryboardFilmContext;
  planId?: string;
  characterIds?: string[];
  startingShot?: string | null;
  startingAngle?: string | null;
  startingVisual?: string | null;
  startingPrompt?: string | null;
  onUploadImages?: UploadImages;
  onClose: () => void;
  onCreated: (imageId: string | null, version: BriefImageSceneVersion) => void;
}) {
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<"generate" | "regenerate" | null>(null);
  const busy = pending === "generate" || pending === "regenerate" ? pending : null;
  const [shot, setShot] = useState("");
  const [angle, setAngle] = useState("");
  const [visualFunction, setVisualFunction] = useState("");
  const [text, setText] = useState("");
  const [session, setSession] = useState("");
  const brief = readShotBrief(headers, row);
  const narration = readNarration(headers, [row], [0]);
  const look = lookFromStoryboardFilm(film, rowIndex);
  const lookIsUgcLook = lookIsUgc(look);
  const seededShot = startingShot?.trim() || brief.shot;
  const seededAngle = startingAngle?.trim() || brief.angle;
  const seededVisual = startingVisual?.trim() || brief.visualFunction;
  const seededPrompt = promptSlideForImage(startingPrompt, brief.veoPrompt).text;
  const nextSession = open ? `open:${rowIndex}:${seededShot}:${seededAngle}:${seededVisual}:${seededPrompt}` : "";
  if (nextSession !== session) {
    setSession(nextSession);
    if (open) {
      setShot(seededShot);
      setAngle(seededAngle);
      setVisualFunction(seededVisual);
      setText(seededPrompt);
    }
  }
  const { data: characters = [] } = useDigitalAssetCharactersListQuery();
  const characterNamesById = Object.fromEntries(
    characters.map((character) => [character.id, character.name || character.id.slice(0, 8)]),
  );

  const generate = async (refine: boolean) => {
    const veoPrompt = text.trim();
    if (!veoPrompt || !onUploadImages || busy) return;
    setPending(refine ? "regenerate" : "generate");
    try {
      const nextRow = headers.map((header, index) => {
        const field = briefAuditField(header);
        if (field === "shot") return shot;
        if (field === "angle") return angle;
        if (field === "visual") return visualFunction;
        if (field === "veo") return veoPrompt;
        return row[index] ?? "";
      });
      const result = await generateBriefSceneImageFile({
        characterIds,
        characterNamesById,
        headers,
        row: nextRow,
        imageColumnIndex,
        t,
        film,
        veoPrompt,
        refine,
        planId,
        rowIndex,
      });
      if (result.truncated) {
        toast.message(
          t("briefDialog.layout.poseRefsTruncated", "Sent {{included}} of {{total}} pose photos (payload limit).", {
            included: result.included,
            total: result.totalAvailable,
          }),
        );
      }
      const version: BriefImageSceneVersion = {
        shot: shot.trim(),
        angle: angle.trim(),
        visualFunction: visualFunction.trim(),
        veoPrompt,
        previous: {
          shot: brief.shot,
          angle: brief.angle,
          visualFunction: brief.visualFunction,
          veoPrompt: brief.veoPrompt,
        },
      };
      const inserted = await onUploadImages(rowIndex, [result.file], version);
      const created = Array.isArray(inserted) ? (inserted as Array<{ id?: string }>) : [];
      onCreated(created[0]?.id ?? null, version);
      toast.success(t("briefDialog.layout.generateSuccess", "Scene image generated."));
      onClose();
    } catch (error) {
      console.error(error);
      if (isGeminiSpendCapError(error)) return;
      const message = error instanceof Error ? error.message : t("briefDialog.layout.generateFailed", "Image generation failed.");
      toast.error(message);
    } finally {
      if (planId) void queryClient.invalidateQueries({ queryKey: ["content-ai-usage", planId] });
      setPending(null);
    }
  };

  const fields = [
    ["videoAi.confirm.shotField", "Shot", shot, setShot],
    ["videoAi.confirm.angle", "Angle", angle, setAngle],
    ["videoAi.confirm.visualFunction", "Visual function", visualFunction, setVisualFunction],
  ] as const;

  const keepOpen = (event: { preventDefault: () => void; target: EventTarget | null }) => {
    const target = event.target;
    if (target instanceof Element && target.closest("[data-brief-mention-menu]")) event.preventDefault();
  };

  return (
    <StoryboardActionShell
      open={open}
      onOpenChange={(next) => { if (!next && !busy) onClose(); }}
      title={t("briefDialog.imagePrompt.title", "Generate image")}
      keepOpen={keepOpen}
      footerClassName="shrink-0 sm:justify-end"
      headerExtra={(
        <div className="space-y-0.5 text-left">
          <p className="text-[11px] font-semibold text-muted-foreground">{t("videoAi.confirm.narration", "Narasi")}</p>
          <p className="max-h-24 overflow-y-auto whitespace-pre-wrap text-sm text-foreground [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {narration || "—"}
          </p>
        </div>
      )}
      footer={(
        <div className="flex w-full shrink-0 justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-none" disabled={Boolean(busy)} onClick={onClose}>
            {t("videoAi.confirm.cancel", "Batal")}
          </Button>
          <Button
            type="button"
            className="rounded-none"
            disabled={Boolean(busy) || !text.trim() || !onUploadImages}
            onClick={() => void generate(true)}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("briefDialog.imagePrompt.regenerate", "Regenerate")}
          </Button>
        </div>
      )}
    >
      <div className="space-y-3">
        {look ? (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-muted-foreground">{t("videoAi.confirm.look", "Look")}</p>
            <div className="rounded-none border border-border bg-muted/40 px-3 py-2 text-sm">
              {lookIsUgcLook ? (
                <div className="space-y-1">
                  <p className="font-medium">UGC</p>
                  <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                    {UGC_LOOK_COMPONENTS.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p>{look}</p>
              )}
            </div>
          </div>
        ) : null}
        <div className="space-y-2 rounded-none border border-border bg-muted/40 px-3 py-2">
          {fields.map(([key, fallback, value, setValue]) => (
            <div key={key} className="space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground">{t(key, fallback)}</p>
              <BriefMentionField
                value={value}
                concept={film?.concept}
                onChange={setValue}
                minRows={2}
                className="box-border w-full min-w-0 rounded-none border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          ))}
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-muted-foreground">{t("videoAi.confirm.veo", "Veo 3 prompt")}</p>
            <BriefMentionField
              value={text}
              concept={film?.concept}
              onChange={setText}
              minRows={4}
              className="box-border w-full min-w-0 rounded-none border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </StoryboardActionShell>
  );
}
