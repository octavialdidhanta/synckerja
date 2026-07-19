import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  onSearchSubmit: () => void;
  dateStart: string;
  dateEnd: string;
  onDateStartChange: (v: string) => void;
  onDateEndChange: (v: string) => void;
  sortBy: string;
  sortDirection: 'ASC' | 'DESC';
  onSortByChange: (v: string) => void;
  onSortDirectionChange: (v: 'ASC' | 'DESC') => void;
};

export function BlibliOrdersFiltersBar({
  search,
  onSearchChange,
  onSearchSubmit,
  dateStart,
  dateEnd,
  onDateStartChange,
  onDateEndChange,
  sortBy,
  sortDirection,
  onSortByChange,
  onSortDirectionChange,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-end">
      <div className="flex min-w-0 flex-1 gap-2">
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('operations.blibliOrders.searchPlaceholder')}
          className="h-9 bg-background"
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSearchSubmit();
          }}
        />
        <Button type="button" size="sm" className="h-9 shrink-0" onClick={onSearchSubmit}>
          <Search className="h-4 w-4" aria-hidden />
          <span className="sr-only">{t('operations.blibliOrders.search')}</span>
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">
            {t('operations.blibliOrders.dateFrom')}
          </span>
          <Input
            type="date"
            value={dateStart}
            onChange={(e) => onDateStartChange(e.target.value)}
            className="h-9 w-[150px] bg-background"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">
            {t('operations.blibliOrders.dateTo')}
          </span>
          <Input
            type="date"
            value={dateEnd}
            onChange={(e) => onDateEndChange(e.target.value)}
            className="h-9 w-[150px] bg-background"
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">
            {t('operations.blibliOrders.sortBy')}
          </span>
          <Select value={sortBy} onValueChange={onSortByChange}>
            <SelectTrigger className="h-9 w-[200px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="statusFPUpdatedTimestamp">
                {t('operations.blibliOrders.sort.statusFP')}
              </SelectItem>
              <SelectItem value="autoCancelTimestamp">
                {t('operations.blibliOrders.sort.autoCancel')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">
            {t('operations.blibliOrders.sortDirection')}
          </span>
          <Select
            value={sortDirection}
            onValueChange={(v) => onSortDirectionChange(v as 'ASC' | 'DESC')}
          >
            <SelectTrigger className="h-9 w-[120px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DESC">{t('operations.blibliOrders.sort.desc')}</SelectItem>
              <SelectItem value="ASC">{t('operations.blibliOrders.sort.asc')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
