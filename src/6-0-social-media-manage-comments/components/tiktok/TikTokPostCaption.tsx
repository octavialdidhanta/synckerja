import { useMemo } from "react";
import { cn } from "@/shared/lib/utils";
import { splitTikTokCaptionParagraphs } from "@/6-0-social-media-manage-comments/lib/formatTikTokCaption";

type TikTokPostCaptionProps = {
  text: string;
  className?: string;
};

export function TikTokPostCaption({ text, className }: TikTokPostCaptionProps) {
  const paragraphs = useMemo(() => splitTikTokCaptionParagraphs(text), [text]);
  if (paragraphs.length === 0) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {paragraphs.map((paragraph, index) => (
        <p
          key={index}
          className="whitespace-pre-wrap text-sm leading-snug text-gray-900"
        >
          {paragraph}
        </p>
      ))}
    </div>
  );
}

TikTokPostCaption.displayName = "TikTokPostCaption";
