import { Facebook, Instagram, Linkedin, Youtube } from 'lucide-react';
import { TikTokTabIcon } from '@/6-0-traffic/container/TikTokTabIcon';
import { ThreadsTabIcon } from '@/6-0-social-media-performance/components/ThreadsTabIcon';
import { cn } from '@/shared/lib/utils';

export type ManageCommentsPlatformBadgeId = 'tiktok' | 'youtube' | 'facebook' | 'instagram' | 'linkedin' | 'threads';

const badgeShell = 'absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white';

type Props = {
  platform: ManageCommentsPlatformBadgeId;
};

export function ManageCommentsPlatformBadge({ platform }: Props) {
  switch (platform) {
    case 'youtube':
      return (
        <span className={cn(badgeShell, 'bg-red-600')}>
          <Youtube className="h-2.5 w-2.5 text-white" aria-hidden />
        </span>
      );
    case 'facebook':
      return (
        <span className={cn(badgeShell, 'bg-[#1877F2]')}>
          <Facebook className="h-2.5 w-2.5 text-white" aria-hidden />
        </span>
      );
    case 'instagram':
      return (
        <span
          className={cn(
            badgeShell,
            'bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af]',
          )}
        >
          <Instagram className="h-2.5 w-2.5 text-white" aria-hidden />
        </span>
      );
    case 'linkedin':
      return (
        <span className={cn(badgeShell, 'bg-[#0A66C2]')}>
          <Linkedin className="h-2.5 w-2.5 text-white" aria-hidden />
        </span>
      );
    case 'threads':
      return (
        <span className={cn(badgeShell, 'bg-black')}>
          <ThreadsTabIcon className="h-2.5 w-2.5 text-white" />
        </span>
      );
    case 'tiktok':
    default:
      return (
        <span className={cn(badgeShell, 'bg-black')}>
          <TikTokTabIcon className="h-2.5 w-2.5 text-white" />
        </span>
      );
  }
}
