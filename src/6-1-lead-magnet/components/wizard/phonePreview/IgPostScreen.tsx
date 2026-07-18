import { Bookmark, Heart, MessageCircle, Send } from 'lucide-react';
import type { PhonePreviewModel } from './buildPhonePreviewModel';
import { IgStatusBar } from './IgStatusBar';

type IgPostScreenProps = {
  model: PhonePreviewModel;
  emptyMediaLabel: string;
};

function Avatar({ url, name, size = 'sm' }: { url: string | null; name: string; size?: 'xs' | 'sm' | 'md' }) {
  const dim = size === 'md' ? 'h-7 w-7' : size === 'xs' ? 'h-5 w-5' : 'h-6 w-6';
  const textSize = size === 'xs' ? 'text-[9px]' : 'text-[10px]';
  const initial = (name.trim()[0] || '?').toUpperCase();
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={`${dim} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <div
      className={`${dim} flex shrink-0 items-center justify-center rounded-full bg-neutral-700 ${textSize} font-semibold text-white`}
      aria-hidden
    >
      {initial}
    </div>
  );
}

export function IgPostScreen({ model, emptyMediaLabel }: IgPostScreenProps) {
  const { account, post } = model;

  return (
    <div className="flex h-full flex-col bg-black text-white">
      <IgStatusBar />
      <div className="flex shrink-0 items-center gap-2 px-2.5 pb-2 pt-0.5">
        <span className="text-lg leading-none text-white/90" aria-hidden>
          ‹
        </span>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-[9px] font-medium uppercase tracking-wide text-white/60">
            {account.displayName}
          </p>
          <p className="text-[11px] font-semibold">Posts</p>
        </div>
        <span className="w-4" aria-hidden />
      </div>

      <div className="flex items-center gap-2 px-2.5 py-2">
        <Avatar url={account.avatarUrl} name={account.username} />
        <p className="min-w-0 flex-1 truncate text-[11px] font-semibold">{account.username}</p>
        <span className="text-white/50" aria-hidden>
          ···
        </span>
      </div>

      <div className="relative aspect-square w-full bg-neutral-900">
        {post.thumbnailUrl ? (
          <img
            src={post.thumbnailUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-[10px] text-white/40">
            {emptyMediaLabel}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 px-2.5 py-2">
        <span className="inline-flex items-center gap-1 text-[10px]">
          <Heart className="h-3.5 w-3.5" />
          {post.likeCountLabel}
        </span>
        <span className="inline-flex items-center gap-1 text-[10px]">
          <MessageCircle className="h-3.5 w-3.5" />
          {post.commentCountLabel}
        </span>
        <Send className="h-3.5 w-3.5" />
        <Bookmark className="ml-auto h-3.5 w-3.5" />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-2.5 pb-4">
        {post.caption ? (
          <p className="line-clamp-3 text-[10px] leading-snug text-white/90">
            <span className="font-semibold">{account.username}</span>{' '}
            {post.caption}
          </p>
        ) : (
          <p className="text-[10px] text-white/40">
            <span className="font-semibold text-white/70">{account.username}</span>
          </p>
        )}
        <p className="mt-1 text-[9px] text-white/35">View all comments</p>
      </div>
    </div>
  );
}

export { Avatar as IgPreviewAvatar };
