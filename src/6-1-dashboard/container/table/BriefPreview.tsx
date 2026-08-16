
import React from 'react';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { stripBriefSequencesComment } from '@/6-1-dashboard/modal/briefSequences';
import { stripBriefSceneMetaComment } from '@/6-1-dashboard/modal/briefSceneMeta';

interface BriefPreviewProps {
  brief: string | null;
  onClick: () => void;
  isSelected?: boolean;
}

export const BriefPreview: React.FC<BriefPreviewProps> = ({ brief, onClick, isSelected = false }) => {
  const briefTrimmed = stripBriefSceneMetaComment(stripBriefSequencesComment(brief?.trim() ?? ''));
  if (!briefTrimmed) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'h-8 w-full cursor-pointer rounded-[5px] border px-2 text-left text-xs',
          isSelected
            ? 'border-white bg-transparent text-white hover:bg-white/10 hover:text-white'
            : 'border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700'
        )}
      >
        Click to add brief...
      </button>
    );
  }
  
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const hasLink = urlRegex.test(briefTrimmed);
  
  if (hasLink) {
    const links = briefTrimmed.match(urlRegex) || [];
    const firstLink = links[0];
    let linkType = '';
    if (firstLink.includes('docs.google.com')) {
      linkType = 'Google Docs';
    } else if (firstLink.includes('drive.google.com')) {
      linkType = 'Google Drive';
    } else if (firstLink.includes('youtube.com') || firstLink.includes('youtu.be')) {
      linkType = 'YouTube';
    } else {
      linkType = 'Link';
    }
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex h-8 w-full cursor-pointer items-center gap-1 rounded-[5px] border px-2 text-left text-xs',
          isSelected
            ? 'border-white bg-transparent text-white hover:bg-white/10 hover:text-white [&_svg]:text-white'
            : 'border-gray-200 text-primary hover:bg-gray-50 hover:text-primary/90'
        )}
      >
        <ExternalLink className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">{linkType} detected</span>
      </button>
    );
  }
  
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-8 w-full cursor-pointer rounded-[5px] border px-2 text-left text-xs',
        isSelected
          ? 'border-white bg-transparent text-white hover:bg-white/10 hover:text-white'
          : 'border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-800'
      )}
    >
      <span className="truncate block">
        {briefTrimmed.length > 30 ? `${briefTrimmed.substring(0, 30)}...` : briefTrimmed}
      </span>
    </button>
  );
};
