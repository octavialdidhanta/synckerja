import { Search } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import type { CustomerVisitLookupKind } from '../lib/customerVisit.types';

type Props = {
  kind: CustomerVisitLookupKind;
  query: string;
  onKindChange: (kind: CustomerVisitLookupKind) => void;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  searching?: boolean;
  disabled?: boolean;
};

export function CustomerVisitCheckInCard({
  kind,
  query,
  onKindChange,
  onQueryChange,
  onSearch,
  searching,
  disabled,
}: Props) {
  const { t } = useAppTranslation();
  const hint = t(
    'customerVisits.checkIn.hint',
    'Enter a phone number or Instagram username. Matching is exact only.',
  );
  const queryPlaceholder =
    kind === 'phone'
      ? t('customerVisits.checkIn.phonePlaceholder', '0812… or 62812…')
      : t('customerVisits.checkIn.igPlaceholder', '@username');

  return (
    <div className="rounded-md border bg-white p-2" title={hint}>
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="min-w-[7.5rem] shrink-0">
          <h3 className="text-sm font-semibold leading-5 text-gray-900">
            {t('customerVisits.checkIn.title', 'Store check-in')}
          </h3>
          <p className="sr-only">{hint}</p>
        </div>
        <Select
          value={kind}
          onValueChange={(value) => onKindChange(value as CustomerVisitLookupKind)}
          disabled={disabled}
        >
          <SelectTrigger
            className="h-9 w-full text-left text-sm sm:w-36 lg:w-40"
            aria-label={t('customerVisits.checkIn.kind', 'Lookup')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="phone">{t('customerVisits.checkIn.kindPhone', 'Phone')}</SelectItem>
            <SelectItem value="instagram">
              {t('customerVisits.checkIn.kindInstagram', 'Instagram')}
            </SelectItem>
          </SelectContent>
        </Select>
        <Input
          className="h-9 min-w-[160px] flex-1 rounded-md border border-gray-300 text-sm"
          value={query}
          disabled={disabled}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !disabled) onSearch();
          }}
          placeholder={queryPlaceholder}
          aria-label={
            kind === 'phone'
              ? t('customerVisits.checkIn.phoneLabel', 'Phone number')
              : t('customerVisits.checkIn.igLabel', 'Instagram username')
          }
        />
        <Button type="button" className="h-9" onClick={onSearch} disabled={disabled || searching || !query.trim()}>
          <Search className="mr-1.5 h-4 w-4" />
          {t('customerVisits.checkIn.search', 'Search')}
        </Button>
      </div>
    </div>
  );
}
