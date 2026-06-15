import type { TaskStepCommentReactionEmoji } from '../types';

export const COMMENT_REACTION_EMOJIS: {
  key: TaskStepCommentReactionEmoji;
  label: string;
  symbol: string;
}[] = [
  { key: 'like', label: 'Like', symbol: '👍' },
  { key: 'heart', label: 'Heart', symbol: '❤️' },
  { key: 'laugh', label: 'Laugh', symbol: '😂' },
  { key: 'celebrate', label: 'Celebrate', symbol: '🎉' },
  { key: 'question', label: 'Question', symbol: '❓' },
];

export function reactionEmojiSymbol(key: TaskStepCommentReactionEmoji): string {
  return COMMENT_REACTION_EMOJIS.find((e) => e.key === key)?.symbol ?? '👍';
}
