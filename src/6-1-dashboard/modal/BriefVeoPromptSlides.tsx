import type { BriefStoryboardImageWithUrl } from "@/6-1-dashboard/hook/useBriefStoryboardImages";
import type { BriefConceptDocument } from "@/6-1-dashboard/modal/briefConceptAssets";
import { promptSlideForImage } from "@/6-1-dashboard/lib/seedanceVideo";
import { BriefMentionField, BriefMentionText } from "@/6-1-dashboard/modal/BriefMentionField";
import { BriefVersionPager } from "@/6-1-dashboard/modal/BriefVersionPager";

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
      <BriefVersionPager count={images.length} activeIndex={activeIndex} onSelect={move} />
    </div>
  );
}
