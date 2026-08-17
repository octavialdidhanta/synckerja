import type { LeadMagnetCampaignMetricTotals } from '../types/leadMagnet.types';
import { formatLeadMagnetMetricValue, type LeadMagnetMetricFormat } from '../lib/formatLeadMagnetMetricValue';

export type LeadMagnetMetricCardDef = {
  key: keyof LeadMagnetCampaignMetricTotals;
  label: string;
  format?: LeadMagnetMetricFormat;
};

type Props = {
  totals: LeadMagnetCampaignMetricTotals;
  cards: LeadMagnetMetricCardDef[];
  commerceCards?: LeadMagnetMetricCardDef[];
  loading?: boolean;
};

function MetricCard({
  card,
  totals,
  loading,
}: {
  card: LeadMagnetMetricCardDef;
  totals: LeadMagnetCampaignMetricTotals;
  loading?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2.5 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {card.label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">
        {loading ? '—' : formatLeadMagnetMetricValue(totals[card.key] ?? 0, card.format)}
      </p>
    </div>
  );
}

export function LeadMagnetListMetricCards({ totals, cards, commerceCards, loading }: Props) {
  return (
    <div className="flex shrink-0 flex-col gap-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <MetricCard key={card.key} card={card} totals={totals} loading={loading} />
        ))}
      </div>
      {commerceCards && commerceCards.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {commerceCards.map((card) => (
            <MetricCard key={card.key} card={card} totals={totals} loading={loading} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
