import { useTranslation } from 'react-i18next';
import {
  buildLeadMagnetFunnelView,
  type FunnelEventCounts,
} from '../lib/buildLeadMagnetFunnelView';

type Props = {
  funnel: FunnelEventCounts;
  loading?: boolean;
};

export function LeadMagnetFunnelPanel({ funnel, loading }: Props) {
  const { t } = useTranslation();
  const view = buildLeadMagnetFunnelView(funnel);
  const maxBar = Math.max(...view.steps.map((s) => s.count), 1);

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t('leadMagnet.analytics.loading')}</p>;
  }

  if (view.topCount === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t('leadMagnet.analytics.funnelEmpty')}</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">{t('leadMagnet.analytics.funnelHint')}</p>

      <ol className="space-y-3">
        {view.steps.map((step, index) => {
          const widthPct = Math.max(4, Math.round((step.count / maxBar) * 100));
          return (
            <li key={step.id} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    <span className="mr-1.5 text-xs tabular-nums text-muted-foreground">
                      {index + 1}.
                    </span>
                    {t(`leadMagnet.analytics.funnel.${step.labelKey}`)}
                  </p>
                  {step.pctFromPrev != null ? (
                    <p className="pl-5 text-[11px] text-muted-foreground">
                      {t('leadMagnet.analytics.funnel.fromPrev', { pct: step.pctFromPrev })}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums">{step.count.toLocaleString('id-ID')}</p>
                  <p className="text-[11px] tabular-nums text-muted-foreground">
                    {t('leadMagnet.analytics.funnel.ofTop', { pct: step.pctOfTop })}
                  </p>
                </div>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${widthPct}%` }}
                  aria-hidden
                />
              </div>
            </li>
          );
        })}
      </ol>

      {view.sideStats.length > 0 ? (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('leadMagnet.analytics.funnel.sideTitle')}
          </p>
          <ul className="space-y-1">
            {view.sideStats.map((s) => (
              <li key={s.id} className="flex justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  {t(`leadMagnet.analytics.funnel.${s.labelKey}`)}
                </span>
                <span className="font-medium tabular-nums">{s.count.toLocaleString('id-ID')}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
