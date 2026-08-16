import { useMemo, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLeadMagnetMediaPosts } from '../hooks/useLeadMagnetCampaigns';
import type {
  LeadMagnetCampaignAccount,
  LeadMagnetCampaignPost,
  LeadMagnetMediaPost,
  LeadMagnetPlatform,
} from '../types/leadMagnet.types';
import { getAccountForPlatform } from '../types/leadMagnet.types';

function postNeedsEnrich(post: LeadMagnetCampaignPost): boolean {
  return !post.media_caption?.trim() || !post.media_thumbnail_url?.trim();
}

function enrichPostFromMedia(
  post: LeadMagnetCampaignPost,
  pool: LeadMagnetMediaPost[],
): LeadMagnetCampaignPost {
  const meta = pool.find((m) => m.media_id === post.media_id);
  const freshThumb = meta?.thumbnail_url?.trim() || meta?.media_url?.trim() || null;
  return {
    ...post,
    media_caption: post.media_caption?.trim() || meta?.caption || null,
    // Prefer live media thumbnails — stored Meta CDN URLs expire and break in <img>.
    media_thumbnail_url: freshThumb || post.media_thumbnail_url?.trim() || null,
    media_permalink: post.media_permalink || meta?.permalink || null,
  };
}

export function useEnrichedCampaignPosts(
  posts: LeadMagnetCampaignPost[],
  accounts: LeadMagnetCampaignAccount[] = [],
) {
  const needsIg = posts.some((p) => p.platform === "instagram");
  const needsFb = posts.some((p) => p.platform === "facebook");
  const igAccountId = getAccountForPlatform(accounts, "instagram");
  const fbAccountId = getAccountForPlatform(accounts, "facebook");

  const { data: igMedia = [], isLoading: loadingIg } = useLeadMagnetMediaPosts(
    "instagram",
    needsIg && igAccountId ? igAccountId : "",
  );
  const { data: fbMedia = [], isLoading: loadingFb } = useLeadMagnetMediaPosts(
    "facebook",
    needsFb && fbAccountId ? fbAccountId : "",
  );

  const mediaByPlatform: Record<LeadMagnetPlatform, LeadMagnetMediaPost[]> = {
    instagram: igMedia,
    facebook: fbMedia,
  };

  const displayPosts = useMemo(
    () => posts.map((post) => enrichPostFromMedia(post, mediaByPlatform[post.platform] ?? [])),
    [posts, igMedia, fbMedia],
  );

  const isEnriching =
    (needsIg && Boolean(igAccountId) && loadingIg) ||
    (needsFb && Boolean(fbAccountId) && loadingFb);

  return { displayPosts, isEnriching };
}

function PostThumb({
  url,
  alt,
  loading,
}: {
  url: string | null | undefined;
  alt: string;
  loading?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const src = url?.trim() || null;

  if (loading) {
    return <div className="h-11 w-11 shrink-0 animate-pulse rounded-md border bg-muted" aria-hidden />;
  }

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-11 w-11 shrink-0 rounded-md border object-cover bg-muted"
      />
    );
  }

  return (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground"
      aria-hidden
    >
      <ImageIcon className="h-5 w-5" />
    </div>
  );
}

function captionPreview(post: LeadMagnetCampaignPost): string {
  const caption = post.media_caption?.trim();
  if (caption) return caption;
  return `Post ${post.media_id.slice(-8)}`;
}

type Props = {
  posts: LeadMagnetCampaignPost[];
  accounts?: LeadMagnetCampaignAccount[];
};

export function CampaignPostsPreview({ posts, accounts = [] }: Props) {
  const { t } = useTranslation();
  const { displayPosts, isEnriching } = useEnrichedCampaignPosts(posts, accounts);

  if (!posts.length) {
    return <span className="text-xs text-muted-foreground">{t('leadMagnet.list.noPosts')}</span>;
  }

  return (
    <div className="flex max-w-sm flex-col gap-1.5">
      {displayPosts.map((post) => {
        const caption = captionPreview(post);
        const link = post.media_permalink?.trim() || null;
        const stillLoading = isEnriching && postNeedsEnrich(post);
        return (
          <div key={`${post.platform}-${post.media_id}`} className="flex min-w-0 items-start gap-2">
            <PostThumb
              url={post.media_thumbnail_url}
              alt={caption}
              loading={stillLoading && !post.media_thumbnail_url?.trim()}
            />
            <div className="min-w-0 flex-1">
              {stillLoading && !post.media_caption?.trim() ? (
                <div className="space-y-1.5">
                  <div className="h-4 w-[85%] animate-pulse rounded bg-muted" />
                  <div className="h-3 w-[65%] animate-pulse rounded bg-muted/80" />
                </div>
              ) : (
                <p
                  className="line-clamp-2 whitespace-pre-line text-xs font-normal leading-snug text-foreground"
                  title={caption}
                >
                  {caption}
                </p>
              )}
              <p className="mt-0.5 text-[10px] font-normal text-muted-foreground">
                {post.platform === 'instagram'
                  ? t('leadMagnet.platform.instagram')
                  : t('leadMagnet.platform.facebook')}
                {link ? (
                  <>
                    {' · '}
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {t('leadMagnet.list.viewPost')}
                    </a>
                  </>
                ) : null}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
