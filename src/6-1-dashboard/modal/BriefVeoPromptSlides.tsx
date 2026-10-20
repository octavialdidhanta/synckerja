import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { BriefStoryboardImageWithUrl } from "@/6-1-dashboard/hook/useBriefStoryboardImages";
import type { BriefConceptDocument } from "@/6-1-dashboard/modal/briefConceptAssets";
import { promptSlideForImage } from "@/6-1-dashboard/lib/seedanceVideo";
import { BriefMentionField, BriefMentionText } from "@/6-1-dashboard/modal/BriefMentionField";

export function BriefVeoPromptSlides({
  images,
  activeImageId,
  originalPrompt,
  editable,
  concept,
  onChangeOriginal,
  onSelectImage,
  fieldClassName,
  minRows = 2,
}: {
  images: BriefStoryboardImageWithUrl[];
  activeImageId?: string | null;
  originalPrompt: string;
  editable: boolean;
  concept?: BriefConceptDocument | null;
  onChangeOriginal: (value: string) => void;
  onSelectImage: (imageId: string) => void;
  fieldClassName: string;
  minRows?: number;
}) {
  const { t } = useAppTranslation();
  const found = images.findIndex((image) => image.id === activeImageId);
  const activeIndex = found >= 0 ? found : 0;
  const active = images[activeIndex];
  const slide = promptSlideForImage(active?.prompt_override, originalPrompt);
  const move = (index: number) => {
    const image = images[index];
    if (image) onSelectImage(image.id);
  };

  return (
    <div className="min-w-0">
      {slide.locked || !editable ? (
        <BriefMentionText value={slide.text} concept={concept} className="block min-w-0 w-full whitespace-pre-wrap text-sm" />
      ) : (
        <BriefMentionField
          value={slide.text}
          concept={concept}
          onChange={onChangeOriginal}
          minRows={minRows}
          className={fieldClassName}
        />
      )}
      {images.length > 1 ? (
        <div className="mt-1.5 flex items-center justify-start gap-1.5">
          <button
            type="button"
            title={t("briefDialog.imagePrompt.previous", "Previous prompt")}
            aria-label={t("briefDialog.imagePrompt.previous", "Previous prompt")}
            disabled={activeIndex === 0}
            onClick={() => move(activeIndex - 1)}
            className="-ml-1.5 flex h-4 w-4 shrink-0 items-center justify-center p-0 text-gray-600 hover:text-gray-900 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5">
            {images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                title={t("briefDialog.imagePrompt.promptSlide", "Prompt {{index}}", { index: index + 1 })}
                aria-label={t("briefDialog.imagePrompt.promptSlide", "Prompt {{index}}", { index: index + 1 })}
                aria-pressed={index === activeIndex}
                onClick={() => move(index)}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-all",
                  index === activeIndex ? "w-3 bg-gray-800" : "bg-gray-300 hover:bg-gray-500",
                )}
              />
            ))}
          </div>
          <button
            type="button"
            title={t("briefDialog.imagePrompt.next", "Next prompt")}
            aria-label={t("briefDialog.imagePrompt.next", "Next prompt")}
            disabled={activeIndex >= images.length - 1}
            onClick={() => move(activeIndex + 1)}
            className="flex h-4 w-4 shrink-0 items-center justify-center p-0 text-gray-600 hover:text-gray-900 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
