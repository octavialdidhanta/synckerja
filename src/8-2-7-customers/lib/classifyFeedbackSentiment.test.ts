import { describe, expect, it } from 'vitest';
import { classifyFeedbackSentiment } from './classifyFeedbackSentiment';

describe('classifyFeedbackSentiment', () => {
  it('returns good for ratings 4 and 5', () => {
    expect(classifyFeedbackSentiment(4)).toBe('good');
    expect(classifyFeedbackSentiment(5)).toBe('good');
  });

  it('returns bad for ratings 1 to 3', () => {
    expect(classifyFeedbackSentiment(1)).toBe('bad');
    expect(classifyFeedbackSentiment(3)).toBe('bad');
  });

  it('returns null for invalid ratings', () => {
    expect(classifyFeedbackSentiment(Number.NaN)).toBeNull();
  });
});
