import { describe, expect, it } from 'vitest';
import {
  filledCommentReplyTexts,
  hasDuplicateCommentReplies,
  normalizeCommentReplyTexts,
  pickRandomCommentReply,
  toCommentReplySlots,
} from './commentReplyVariants';

describe('commentReplyVariants', () => {
  it('normalizes array and legacy fallback', () => {
    expect(normalizeCommentReplyTexts([' A ', '', 'B'])).toEqual(['A', 'B']);
    expect(normalizeCommentReplyTexts([], 'legacy')).toEqual(['legacy']);
    expect(normalizeCommentReplyTexts(null, null)).toEqual([]);
  });

  it('pads to three slots', () => {
    expect(toCommentReplySlots(['only one'], null)).toEqual(['only one', '', '']);
  });

  it('detects duplicates among filled slots', () => {
    expect(hasDuplicateCommentReplies(['same', 'other', 'same'])).toBe(true);
    expect(hasDuplicateCommentReplies(['a', 'b', ''])).toBe(false);
  });

  it('picks only from filled slots', () => {
    const pool = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const picked = pickRandomCommentReply(['A', '', 'B']);
      expect(picked === 'A' || picked === 'B').toBe(true);
      if (picked) pool.add(picked);
    }
    expect(pool.size).toBeGreaterThan(0);
    expect(filledCommentReplyTexts(['', '', ''])).toEqual([]);
    expect(pickRandomCommentReply(['', '', ''])).toBeNull();
  });
});
