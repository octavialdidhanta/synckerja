import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';
import {
  BLIBLI_ORDER_STATUS_TABS,
  type BlibliOrderStatusTab,
} from '@/blibli-orders/lib/blibliOrderStatusTabs';
import type { BlibliOrderStatusCounts } from '@/blibli-orders/hooks/useBlibliOrderStatusCountsQuery';

type Props = {
  value: BlibliOrderStatusTab;
  onChange: (tab: BlibliOrderStatusTab) => void;
  counts?: Partial<BlibliOrderStatusCounts> | null;
};

export function BlibliOrdersStatusTabs({ value, onChange, counts }: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-border" role="tablist">
      {BLIBLI_ORDER_STATUS_TABS.map((tab) => {
        const active = value === tab;
        const count = counts?.[tab];
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(
              'border-b-2 px-1 pb-2 text-sm font-medium transition-colors',
              active
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            onClick={() => onChange(tab)}
          >
            {t(`operations.blibliOrders.statusTabs.${tab}`)}
            {typeof count === 'number' ? (
              <span className="ml-1 text-xs font-normal text-muted-foreground">({count})</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
