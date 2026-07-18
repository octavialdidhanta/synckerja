import type { LeadMagnetCampaignMetricTotals } from '../types/leadMagnet.types';

type CardDef = {
  key: keyof LeadMagnetCampaignMetricTotals;
  label: string;
};

type Props = {
  totals: LeadMagnetCampaignMetricTotals;
  cards: CardDef[];
  loading?: boolean;
};

export function LeadMagnetListMetricCards({ totals, cards, loading }: Props) {
  return (
    <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.key}
          className="rounded-md border border-border bg-card px-3 py-2.5 shadow-sm"
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {card.label}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">
            {loading ? '—' : totals[card.key].toLocaleString('id-ID')}
          </p>
        </div>
      ))}
    </div>
  );
}
