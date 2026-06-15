import { COMMENT_REACTION_EMOJIS, reactionEmojiSymbol } from '../lib/emojiPresets';
import type { TaskStepComment, TaskStepCommentReactionEmoji } from '../types';

interface TaskStepCommentReactionsProps {
  comment: TaskStepComment;
  currentProfileId: string | null;
  onReact: (emoji: TaskStepCommentReactionEmoji) => void;
  onRemoveReaction: () => void;
  disabled?: boolean;
}

export function TaskStepCommentReactions({
  comment,
  currentProfileId,
  onReact,
  onRemoveReaction,
  disabled,
}: TaskStepCommentReactionsProps) {
  const reactions = comment.reactions ?? [];
  const grouped = COMMENT_REACTION_EMOJIS.map((preset) => {
    const rows = reactions.filter((r) => r.emoji === preset.key);
    return { preset, count: rows.length, mine: rows.some((r) => r.profile_id === currentProfileId) };
  }).filter((g) => g.count > 0);

  const myReaction = reactions.find((r) => r.profile_id === currentProfileId);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {grouped.map(({ preset, count, mine }) => (
        <button
          key={preset.key}
          type="button"
          disabled={disabled}
          className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] ${
            mine ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-muted/40 text-gray-600'
          }`}
          onClick={() => {
            if (mine) onRemoveReaction();
            else onReact(preset.key);
          }}
          title={preset.label}
        >
          <span>{preset.symbol}</span>
          <span>{count}</span>
        </button>
      ))}
      <div className="relative group">
        <button
          type="button"
          disabled={disabled}
          className="rounded px-1 py-0.5 text-[10px] text-gray-500 hover:bg-muted/60"
        >
          {myReaction ? reactionEmojiSymbol(myReaction.emoji) : '+'}
        </button>
        <div className="absolute bottom-full left-0 z-20 mb-1 hidden gap-0.5 rounded-md border border-border bg-white p-1 shadow-md group-hover:flex group-focus-within:flex">
          {COMMENT_REACTION_EMOJIS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              disabled={disabled}
              className="rounded p-1 text-sm hover:bg-muted/60"
              title={preset.label}
              onClick={() => {
                if (myReaction?.emoji === preset.key) onRemoveReaction();
                else onReact(preset.key);
              }}
            >
              {preset.symbol}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
