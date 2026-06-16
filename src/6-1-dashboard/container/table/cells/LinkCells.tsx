
import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { SocialMediaLink } from '@/shared/types/social-media-links';

interface GoogleDriveLinkCellProps {
  googleDriveLink: string | null;
  isDisabled: boolean;
  onClick: () => void;
  isSelected?: boolean;
  contentType?: string;
  carouselImageCount?: number;
}

export const GoogleDriveLinkCell: React.FC<GoogleDriveLinkCellProps> = ({
  googleDriveLink,
  isDisabled,
  onClick,
  isSelected = false,
  contentType,
  carouselImageCount = 0
}) => {
  const isPostOrCarousel = contentType === 'Post' || contentType === 'Carousel';
  const hasContent = isPostOrCarousel
    ? carouselImageCount > 0
    : (googleDriveLink && googleDriveLink.trim().length > 0);
  const label = isPostOrCarousel
    ? (hasContent ? `Carousel (${carouselImageCount} images)` : 'Click to add carousel images...')
    : (hasContent ? 'Google Drive Link Added' : 'Click to add Google Drive link...');

  if (isDisabled) {
    return (
      <div
        className={cn(
          'flex h-8 cursor-not-allowed items-center justify-center rounded-[5px] border px-3 text-xs',
          isSelected ? 'border-white/50 bg-transparent text-white/70' : 'border-gray-200 bg-gray-100 text-gray-500'
        )}
      >
        Approve first to add link
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      className={cn(
        'h-8 w-full justify-center rounded-[5px] border px-2 text-xs',
        isSelected
          ? 'border-white bg-transparent text-white hover:bg-white/10 hover:text-white'
          : 'border-gray-200 hover:bg-gray-50'
      )}
      onClick={onClick}
    >
      <span className="truncate">{label}</span>
      {hasContent && !isPostOrCarousel && (
        <ExternalLink className={cn('ml-1 h-3 w-3 flex-shrink-0', isSelected ? 'text-white' : 'text-gray-600')} />
      )}
    </Button>
  );
};

interface PostLinkCellProps {
  planLinks: SocialMediaLink[];
  isDisabled: boolean;
  onSocialLinksClick: () => void;
  isSelected?: boolean;
  productionApproved?: boolean;
}

export const PostLinkCell: React.FC<PostLinkCellProps> = ({
  planLinks,
  isDisabled,
  onSocialLinksClick,
  isSelected = false,
  productionApproved = false
}) => {
  const links = planLinks;

  const getPostLinksDisplayText = (): string => {
    if (!links || links.length === 0) return 'Click to add social media links...';

    if (links.length === 1) {
      const link = links[0];
      return `${link.platform} link added`;
    }

    return `${links.length} social media links added`;
  };

  const isDone = links && links.length > 0;

  const getTextColorClass = (): string => {
    if (isSelected) {
      return 'text-white';
    }
    if (!productionApproved && !isDone) {
      return 'text-gray-600';
    }
    if (productionApproved && isDone) {
      return 'text-gray-900';
    }
    return 'text-gray-900';
  };

  const textColorClass = getTextColorClass();

  if (isDisabled) {
    return (
      <div
        className={cn(
          'flex h-8 cursor-not-allowed items-center justify-center rounded-[5px] border px-3 text-xs',
          isSelected ? 'border-white/50 bg-transparent text-white/70' : 'border-gray-200 bg-gray-100 text-gray-500'
        )}
      >
        Production approval required
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      className={cn(
        'h-8 w-full justify-center rounded-[5px] border px-2 text-xs',
        isSelected ? 'border-white bg-transparent hover:bg-white/10' : 'border-gray-200 hover:bg-gray-50'
      )}
      onClick={onSocialLinksClick}
    >
      <span className={cn('truncate text-center', textColorClass)}>
        {getPostLinksDisplayText()}
      </span>
    </Button>
  );
};
