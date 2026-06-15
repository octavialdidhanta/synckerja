import { useState } from 'react';
import { Search, Filter, FilterX, ChevronDown, Check, X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/shared/components/ui/drawer';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import type { PiutangFilterMode, PiutangVerificationFilterMode } from '@/4-1-transaction/piutang/types/piutang.types';
import {
  PIUTANG_STATUS_FILTER_OPTIONS,
  PIUTANG_VERIFICATION_FILTER_OPTIONS,
} from '@/4-1-transaction/piutang/shared/piutangFilterConfig';
import { translatePiutangFilterOption } from '@/4-1-transaction/piutang/shared/piutangI18n';

type MobilePiutangFiltersProps = {
  search: string;
  status: PiutangFilterMode;
  verification: PiutangVerificationFilterMode;
  onSearchChange: (v: string) => void;
  onStatusChange: (v: PiutangFilterMode) => void;
  onVerificationChange: (v: PiutangVerificationFilterMode) => void;
  onClearFilters: () => void;
};

const drawerOverlay = 'z-[100]';
const drawerContentClass = 'z-[100] max-h-[85dvh] flex flex-col';

/** Toolbar filter mobile — selaras `MobileIncomeTransactionSection` (search expand + Filter drawer). */
export function MobilePiutangFilters({
  search,
  status,
  verification,
  onSearchChange,
  onStatusChange,
  onVerificationChange,
  onClearFilters,
}: MobilePiutangFiltersProps) {
  const { t } = useAppTranslation();
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);

  return (
    <div className="flex w-full min-w-0 flex-nowrap items-center gap-1">
      <div
        className={cn(
          'relative flex min-w-0 flex-1 items-center gap-1 transition-[flex-basis,max-width] duration-300 ease-in-out',
          searchExpanded ? 'max-w-full basis-full' : 'min-w-0 basis-0',
        )}
      >
        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder={t('incomes.piutang.searchPlaceholder', 'Cari klien / layanan…')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setSearchExpanded(true)}
          onBlur={() => setSearchExpanded(false)}
          className="h-9 w-full min-w-0 pl-8 pr-8 text-xs placeholder:text-xs"
        />
        {searchExpanded ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 h-7 w-7 flex-shrink-0"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setSearchExpanded(false)}
            aria-label={t('common.close', 'Close')}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div
        className={cn(
          'flex shrink-0 flex-row-reverse flex-nowrap items-center gap-1 overflow-hidden transition-[max-width,opacity] duration-300 ease-in-out',
          searchExpanded ? 'pointer-events-none max-w-0 basis-0 opacity-0' : 'opacity-100',
        )}
      >
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 flex-shrink-0"
          onClick={onClearFilters}
          title={t('incomes.resetFilters', 'Reset filters')}
          aria-label={t('incomes.resetFilters', 'Reset filters')}
        >
          <FilterX className="h-4 w-4" />
        </Button>

        <Drawer open={filtersDrawerOpen} onOpenChange={setFiltersDrawerOpen}>
          <DrawerTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 min-w-[88px] shrink-0 gap-1 px-2">
              <Filter className="h-4 w-4 shrink-0" />
              <span className="truncate">{t('common.filter', 'Filter')}</span>
              <ChevronDown className="h-4 w-4 shrink-0" />
            </Button>
          </DrawerTrigger>
          <DrawerContent overlayClassName={drawerOverlay} className={drawerContentClass}>
            <DrawerHeader className="safe-area-top px-4 pb-2 pt-4 text-left">
              <DrawerTitle className="text-lg font-semibold">
                {t('incomes.piutang.filterTitle', 'Filter piutang')}
              </DrawerTitle>
              <DrawerDescription className="sr-only">
                {t('incomes.piutang.filterTitle', 'Filter piutang')}
              </DrawerDescription>
            </DrawerHeader>
            <div className="seamless-scroll scrollbar-hide min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <FilterGroup
                title={t('incomes.piutang.statusFilter', 'Status piutang')}
                current={status}
                options={PIUTANG_STATUS_FILTER_OPTIONS.map((o) => ({
                  value: o.value,
                  label: translatePiutangFilterOption(t, o),
                }))}
                onSelect={(v) => onStatusChange(v as PiutangFilterMode)}
              />
              <FilterGroup
                title={t('incomes.piutang.verificationFilter', 'Verifikasi')}
                current={verification}
                options={PIUTANG_VERIFICATION_FILTER_OPTIONS.map((o) => ({
                  value: o.value,
                  label: translatePiutangFilterOption(t, o),
                }))}
                onSelect={(v) => onVerificationChange(v as PiutangVerificationFilterMode)}
              />
            </div>
            <div className="flex flex-shrink-0 items-center justify-between gap-2 border-t bg-muted/30 px-4 pb-3 pt-3">
              <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
                {t('common.reset', 'Reset')}
              </Button>
              <DrawerClose asChild>
                <Button type="button" size="sm" className="min-w-[100px]">
                  {t('common.done', 'Done')}
                </Button>
              </DrawerClose>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </div>
  );
}

function FilterGroup({
  title,
  current,
  options,
  onSelect,
}: {
  title: string;
  current: string;
  options: { value: string; label: string }[];
  onSelect: (value: string) => void;
}) {
  return (
    <div className="mb-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{title}</p>
      <div className="flex flex-col gap-0 rounded-md border bg-card">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            className={cn(
              'flex w-full items-center justify-between border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0',
              current === opt.value ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-muted/50',
            )}
          >
            <span className="truncate">{opt.label}</span>
            {current === opt.value ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
