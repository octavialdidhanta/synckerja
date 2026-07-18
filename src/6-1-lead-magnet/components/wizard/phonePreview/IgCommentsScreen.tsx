import { Heart, Send } from 'lucide-react';
import type { PhonePreviewModel } from './buildPhonePreviewModel';
import { IgPreviewAvatar } from './IgPostScreen';
import { IgStatusBar } from './IgStatusBar';

type IgCommentsScreenProps = {
  model: PhonePreviewModel;
  emptyMediaLabel: string;
  nowLabel: string;
  replyLabel: string;
  addCommentPlaceholder: string;
};

export function IgCommentsScreen({
  model,
  emptyMediaLabel,
  nowLabel,
  replyLabel,
  addCommentPlaceholder,
}: IgCommentsScreenProps) {
  const { account, post, comments } = model;

  return (
    <div className="relative flex h-full flex-col bg-black text-white">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <IgStatusBar />
        <div className="flex items-center gap-2 px-2.5 py-2">
          <IgPreviewAvatar url={account.avatarUrl} name={account.username} />
          <p className="text-[11px] font-semibold">{account.username}</p>
        </div>
        <div className="aspect-[4/3] w-full bg-neutral-900">
          {post.thumbnailUrl ? (
            <img src={post.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[9px] text-white/30">
              {emptyMediaLabel}
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 mt-auto flex max-h-[72%] min-h-[58%] flex-col rounded-t-2xl bg-[#1c1c1e] shadow-[0_-8px_24px_rgba(0,0,0,0.45)]">
        <div className="mx-auto mt-1.5 h-1 w-8 rounded-full bg-white/25" aria-hidden />
        <div className="relative flex items-center justify-center px-3 py-2">
          <p className="text-[12px] font-semibold">Comments</p>
          <Send className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/70" />
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3.5 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <CommentRow
            avatarUrl={null}
            username="Username"
            text={comments.userComment}
            nowLabel={nowLabel}
            replyLabel={replyLabel}
          />
          {comments.accountReply ? (
            <div className="ml-8 pl-1">
              <CommentRow
                avatarUrl={account.avatarUrl}
                username={account.username}
                text={comments.accountReply}
                nowLabel={nowLabel}
                replyLabel={replyLabel}
                compact
              />
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-white/10 px-3.5 pb-4 pt-1.5">
          <div className="mb-1.5 flex w-full items-center justify-between px-0.5 text-[13px] leading-none">
            <span>❤️</span>
            <span>🙌</span>
            <span>🔥</span>
            <span>👏</span>
            <span>😢</span>
            <span>😍</span>
            <span>😮</span>
            <span>😂</span>
          </div>
          <div className="flex items-center gap-2">
            <IgPreviewAvatar url={account.avatarUrl} name={account.username} />
            <div className="flex-1 rounded-full border border-white/15 px-2.5 py-1.5 text-[10px] text-white/40">
              {addCommentPlaceholder}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommentRow({
  avatarUrl,
  username,
  text,
  nowLabel,
  replyLabel,
  compact = false,
}: {
  avatarUrl: string | null;
  username: string;
  text: string;
  nowLabel: string;
  replyLabel: string;
  compact?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <IgPreviewAvatar url={avatarUrl} name={username} size={compact ? 'xs' : 'md'} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] leading-snug">
          <span className="font-semibold">{username}</span>{' '}
          <span className="text-white/45">{nowLabel}</span>
        </p>
        <p className="mt-0.5 break-words text-[11px] leading-snug text-white/90">{text}</p>
        <p className="mt-0.5 text-[9px] text-white/40">{replyLabel}</p>
      </div>
      <Heart className="mt-1 h-3 w-3 shrink-0 text-white/35" />
    </div>
  );
}
