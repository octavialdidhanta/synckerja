import { useTranslation } from 'react-i18next';
import { Download, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import type { OmnichannelContactFilters as ContactFilters } from '@/5-3-whatsapp/hooks/useOmnichannelContacts';

type Props = {
  filters: ContactFilters;
  onFiltersChange: (patch: Partial<ContactFilters>) => void;
  campaignOptions: string[];
  targetMarketOptions: string[];
  filteredCount: number;
  totalCount: number;
  onExportCsv: () => void;
  onExportXls: () => void;
  exportDisabled: boolean;
};

export function OmnichannelContactFilters({
  filters,
  onFiltersChange,
  campaignOptions,
  targetMarketOptions,
  filteredCount,
  totalCount,
  onExportCsv,
  onExportXls,
  exportDisabled,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {t('omnichannel.contact.pageTitle')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('omnichannel.contact.summary', { filtered: filteredCount, total: totalCount })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={exportDisabled}
            onClick={onExportCsv}
          >
            <Download className="mr-1.5 h-4 w-4" />
            {t('omnichannel.contact.exportCsv')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={exportDisabled}
            onClick={onExportXls}
          >
            <FileSpreadsheet className="mr-1.5 h-4 w-4" />
            {t('omnichannel.contact.exportXls')}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="contact-filter-campaign">{t('omnichannel.contact.filterCampaign')}</Label>
          <Select
            value={filters.campaignName || '__all__'}
            onValueChange={(v) => onFiltersChange({ campaignName: v === '__all__' ? '' : v })}
          >
            <SelectTrigger id="contact-filter-campaign">
              <SelectValue placeholder={t('omnichannel.contact.filterAll')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('omnichannel.contact.filterAll')}</SelectItem>
              {campaignOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contact-filter-market">{t('omnichannel.contact.filterTargetMarket')}</Label>
          <Select
            value={filters.targetMarket || '__all__'}
            onValueChange={(v) => onFiltersChange({ targetMarket: v === '__all__' ? '' : v })}
          >
            <SelectTrigger id="contact-filter-market">
              <SelectValue placeholder={t('omnichannel.contact.filterAll')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('omnichannel.contact.filterAll')}</SelectItem>
              {targetMarketOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contact-filter-from">{t('omnichannel.contact.filterDateFrom')}</Label>
          <Input
            id="contact-filter-from"
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(e) => onFiltersChange({ dateFrom: e.target.value || null })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contact-filter-to">{t('omnichannel.contact.filterDateTo')}</Label>
          <Input
            id="contact-filter-to"
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(e) => onFiltersChange({ dateTo: e.target.value || null })}
          />
        </div>
      </div>
    </div>
  );
}
