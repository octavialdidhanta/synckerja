import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { isGeminiSpendCapError } from "@/shared/ai/geminiSpendCap";
import { toast } from "sonner";
import { useDigitalAssetCharactersListQuery } from "@/6-1-social-media-settings/hooks/useDigitalAssetsListQueries";
import {
  generateBriefSceneImageFile,
  type StoryboardFilmContext,
} from "@/6-1-dashboard/lib/generateBriefSceneImage";
import { promptSlideForImage, readNarration, readShotBrief } from "@/6-1-dashboard/lib/seedanceVideo";
import { BriefMentionField } from "@/6-1-dashboard/modal/BriefMentionField";

type UploadImages = (rowIndex: number, files: File[], promptOverride?: string | null) => Promise<unknown>;

export function BriefImagePromptDialog({
  open,
  rowIndex,
  headers,
  row,
  imageColumnIndex,
  film,
  characterIds = [],
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
  characterIds?: string[];
  startingPrompt?: string | null;
  onUploadImages?: UploadImages;
  onClose: () => void;
  onCreated: (imageId: string | null) => void;
}) {
  const { t } = useAppTranslation();
  const [pending, setPending] = useState<"generate" | "regenerate" | null>(null);
  const busy = pending === "generate" || pending === "regenerate" ? pending : null;
  const [text, setText] = useState("");
  const [session, setSession] = useState("");
  const brief = readShotBrief(headers, row);
  const narration = readNarration(headers, [row], [0]);
  const seededPrompt = promptSlideForImage(startingPrompt, brief.veoPrompt).text;
  const nextSession = open ? `open:${rowIndex}:${seededPrompt}` : "";
  if (nextSession !== session) {
    setSession(nextSession);
    if (open) setText(seededPrompt);
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
      const result = await generateBriefSceneImageFile({
        characterIds,
        characterNamesById,
        headers,
        row,
        imageColumnIndex,
        t,
        film,
        veoPrompt,
        refine,
      });
      if (result.truncated) {
        toast.message(
          t("briefDialog.layout.poseRefsTruncated", "Sent {{included}} of {{total}} pose photos (payload limit).", {
            included: result.included,
            total: result.totalAvailable,
          }),
        );
      }
      const inserted = await onUploadImages(rowIndex, [result.file], veoPrompt);
      const created = Array.isArray(inserted) ? (inserted as Array<{ id?: string }>) : [];
      onCreated(created[0]?.id ?? null);
      toast.success(t("briefDialog.layout.generateSuccess", "Scene image generated."));
      onClose();
    } catch (error) {
      console.error(error);
      if (isGeminiSpendCapError(error)) return;
      const message = error instanceof Error ? error.message : t("briefDialog.layout.generateFailed", "Image generation failed.");
      toast.error(message);
    } finally {
      setPending(null);
    }
  };

  const fields = [
    ["videoAi.confirm.shotField", "Shot", brief.shot],
    ["videoAi.confirm.angle", "Angle", brief.angle],
    ["videoAi.confirm.visualFunction", "Visual function", brief.visualFunction],
  ] as const;

  return (
      <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
      <DialogContent className="!flex aspect-square !h-auto !w-[min(32rem,88vmin)] !max-w-[88vmin] flex-col overflow-hidden rounded-none sm:rounded-none">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t("briefDialog.imagePrompt.title", "Generate image")}</DialogTitle>
          <div className="space-y-0.5 text-left">
            <p className="text-[11px] font-semibold text-muted-foreground">{t("videoAi.confirm.narration", "Narasi")}</p>
            <p className="max-h-24 overflow-y-auto whitespace-pre-wrap text-sm text-foreground [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {narration || "—"}
            </p>
          </div>
        </DialogHeader>
        <div className="scrollbar-hide seamless-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="space-y-3">
            <div className="space-y-2 rounded-none border border-border bg-muted/40 px-3 py-2">
              {fields.map(([key, fallback, value]) => (
                <div key={key} className="space-y-0.5">
                  <p className="text-[11px] font-semibold text-muted-foreground">{t(key, fallback)}</p>
                  <p className="whitespace-pre-wrap text-sm">{value || "—"}</p>
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
        </div>
        <DialogFooter className="shrink-0 sm:justify-end">
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="outline" className="rounded-none" disabled={Boolean(busy)} onClick={onClose}>
              {t("videoAi.confirm.cancel", "Batal")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              disabled={Boolean(busy) || !text.trim() || !onUploadImages}
              onClick={() => void generate(true)}
            >
              {busy === "regenerate" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("briefDialog.imagePrompt.regenerate", "Regenerate")}
            </Button>
            <Button type="button" className="rounded-none" disabled={Boolean(busy) || !text.trim() || !onUploadImages} onClick={() => void generate(false)}>
              {busy === "generate" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("videoAi.confirm.start", "Generate")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
