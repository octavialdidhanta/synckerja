export type ScoredInterviewee = {
  id: string;
  name: string;
  position?: string;
  average_score: number;
  total_reviews: number;
};

export function getTopCandidatesByScore(
  items: ScoredInterviewee[],
  limit = 10,
): ScoredInterviewee[] {
  return [...items]
    .filter((item) => item.total_reviews > 0 && item.average_score > 0)
    .sort((a, b) => {
      if (b.average_score !== a.average_score) {
        return b.average_score - a.average_score;
      }
      if (b.total_reviews !== a.total_reviews) {
        return b.total_reviews - a.total_reviews;
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}
