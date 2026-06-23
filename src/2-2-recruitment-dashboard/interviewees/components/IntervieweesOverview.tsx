import { Star, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';
import { getTopCandidatesByScore } from '../utils/topCandidatesByScore';

interface Interviewee {
  id: string;
  name: string;
  position?: string;
  average_score?: number;
  total_reviews?: number;
}

interface IntervieweesOverviewProps {
  interviewees?: Interviewee[];
}

function renderScoreStars(score: number) {
  const stars = [];
  const fullStars = Math.floor(score);
  const hasHalfStar = score % 1 >= 0.5;

  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars.push(<Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />);
    } else if (i === fullStars && hasHalfStar) {
      stars.push(<Star key={i} className="h-3 w-3 fill-yellow-400/50 text-yellow-400" />);
    } else {
      stars.push(<Star key={i} className="h-3 w-3 text-muted-foreground/30" />);
    }
  }
  return stars;
}

export const IntervieweesOverview = ({ interviewees = [] }: IntervieweesOverviewProps) => {
  const { t } = useAppTranslation();

  const topCandidates = useMemo(
    () =>
      getTopCandidatesByScore(
        interviewees.map((i) => ({
          id: i.id,
          name: i.name,
          position: i.position,
          average_score: i.average_score ?? 0,
          total_reviews: i.total_reviews ?? 0,
        })),
      ),
    [interviewees],
  );

  return (
    <div>
      <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
        <TrendingUp className="h-3 w-3" />
        {t('interviewees.overview.topCandidatesTitle', 'Top 10 Candidates')}
      </h4>

      {topCandidates.length === 0 ? (
        <div className="py-6 text-center">
          <Star className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground">
            {t(
              'interviewees.overview.topCandidatesEmpty',
              'No candidates with review scores yet',
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {topCandidates.map((candidate, index) => (
            <div
              key={candidate.id}
              className="rounded-lg border border-border bg-muted/40 p-2 transition-colors hover:bg-muted/60"
            >
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    index === 0
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">{candidate.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {candidate.position || '-'}
                  </p>
                  <div className="mt-1 flex items-center gap-1">
                    {renderScoreStars(candidate.average_score)}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {candidate.average_score.toFixed(1)} / 5.0 ({candidate.total_reviews})
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
