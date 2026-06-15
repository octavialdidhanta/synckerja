import { useMemo } from 'react';
import { cn } from '@/shared/lib/utils';
import { isSafeDescriptionHref, splitTextWithUrls } from '@/8-2-DailyTask/lib/taskStepDescription';

const linkClassName = 'text-primary underline break-all hover:text-primary/90';

type TextWithAutoLinksProps = {
  text: string;
  className?: string;
  as?: 'p' | 'span';
};

export function TextWithAutoLinks({ text, className, as: Tag = 'span' }: TextWithAutoLinksProps) {
  const segments = useMemo(() => splitTextWithUrls(text), [text]);

  return (
    <Tag className={className}>
      {segments.map((seg, index) =>
        seg.type === 'url' && isSafeDescriptionHref(seg.value) ? (
          <a
            key={index}
            href={seg.value}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(linkClassName)}
            onClick={(e) => e.stopPropagation()}
          >
            {seg.value}
          </a>
        ) : (
          <span key={index}>{seg.value}</span>
        ),
      )}
    </Tag>
  );
}
