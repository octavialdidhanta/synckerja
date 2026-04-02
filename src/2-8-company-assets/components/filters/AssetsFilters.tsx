import { Search, RefreshCw, Plus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

interface AssetsFiltersProps {
  selectedCategory: string;
  selectedStatus: string;
  selectedCondition: string;
  selectedReceiptFilter?: string;
  onReceiptFilterChange?: (value: string) => void;
  onCategoryChange: (category: string) => void;
  onStatusChange: (status: string) => void;
  onConditionChange: (condition: string) => void;
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  onRefresh?: () => void;
  onAddAsset?: () => void;
}

export const AssetsFilters = ({
  selectedCategory,
  selectedStatus,
  selectedCondition,
  selectedReceiptFilter = 'all',
  onReceiptFilterChange,
  onCategoryChange,
  onStatusChange,
  onConditionChange,
  searchTerm = '',
  onSearchChange,
  onRefresh,
  onAddAsset,
}: AssetsFiltersProps) => {
  const { t } = useAppTranslation();
  const handleClearFilters = () => {
    onCategoryChange('All Types');
    onStatusChange('All Statuses');
    onConditionChange('All Conditions');
    if (onReceiptFilterChange) onReceiptFilterChange('all');
    if (onSearchChange) {
      onSearchChange('');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 items-center">
        {onSearchChange && (
          <div className="relative flex-1 min-w-[150px]">
            <Search className="absolute right-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-9 w-full pl-4 pr-10 text-sm"
            />
          </div>
        )}

        <Select value={selectedCategory} onValueChange={onCategoryChange}>
          <SelectTrigger className="h-9 w-full text-left text-sm text-foreground sm:w-36 lg:w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Types">All Types</SelectItem>
            <SelectItem value="Laptop">Laptop</SelectItem>
            <SelectItem value="Desktop">Desktop</SelectItem>
            <SelectItem value="Monitor">Monitor</SelectItem>
            <SelectItem value="Phone">Phone</SelectItem>
            <SelectItem value="Tablet">Tablet</SelectItem>
            <SelectItem value="Keyboard">Keyboard</SelectItem>
            <SelectItem value="Mouse">Mouse</SelectItem>
            <SelectItem value="Headset">Headset</SelectItem>
            <SelectItem value="Docking Station">Docking Station</SelectItem>
            <SelectItem value="Printer">Printer</SelectItem>
            <SelectItem value="Camera">Camera</SelectItem>
            <SelectItem value="Lainnya">Lainnya</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedStatus} onValueChange={onStatusChange}>
          <SelectTrigger className="h-9 w-full text-left text-sm text-foreground sm:w-36 lg:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Statuses">All Statuses</SelectItem>
            <SelectItem value="Available">Available</SelectItem>
            <SelectItem value="In Use">In Use</SelectItem>
            <SelectItem value="Maintenance">Maintenance</SelectItem>
            <SelectItem value="Lost">Lost</SelectItem>
            <SelectItem value="Retired">Retired</SelectItem>
            <SelectItem value="Lainnya">Lainnya</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedCondition} onValueChange={onConditionChange}>
          <SelectTrigger className="h-9 w-full text-left text-sm text-foreground sm:w-36 lg:w-40">
            <SelectValue placeholder="Condition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Conditions">All Conditions</SelectItem>
            <SelectItem value="Excellent">Excellent</SelectItem>
            <SelectItem value="Good">Good</SelectItem>
            <SelectItem value="Fair">Fair</SelectItem>
            <SelectItem value="Poor">Poor</SelectItem>
            <SelectItem value="Damaged">Damaged</SelectItem>
            <SelectItem value="Lainnya">Lainnya</SelectItem>
          </SelectContent>
        </Select>

        {onReceiptFilterChange && (
          <Select value={selectedReceiptFilter} onValueChange={onReceiptFilterChange}>
            <SelectTrigger className="h-9 w-full text-left text-sm text-foreground sm:w-36 lg:w-40">
              <SelectValue placeholder={t('companyAssets.filter.all', 'All')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('companyAssets.filter.all', 'All')}</SelectItem>
              <SelectItem value="pending">{t('companyAssets.filter.pendingReceipt', 'Pending receipt')}</SelectItem>
              <SelectItem value="received">{t('companyAssets.filter.received', 'Received')}</SelectItem>
            </SelectContent>
          </Select>
        )}

        {(onRefresh || handleClearFilters) && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => {
              handleClearFilters();
              if (onRefresh) onRefresh();
            }}
            title="Clear all filters"
          >
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}

        {onAddAsset && (
          <Button onClick={onAddAsset} className="h-9 gap-1.5 whitespace-nowrap text-sm" size="sm">
            <Plus className="h-4 w-4" />
            Add Asset
          </Button>
        )}
      </div>
    </div>
  );
};
