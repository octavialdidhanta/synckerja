export type FeedbackSentiment = 'good' | 'bad';

export function classifyFeedbackSentiment(rating: number): FeedbackSentiment | null {
  if (!Number.isFinite(rating)) return null;
  if (rating >= 4) return 'good';
  if (rating <= 3) return 'bad';
  return null;
}
