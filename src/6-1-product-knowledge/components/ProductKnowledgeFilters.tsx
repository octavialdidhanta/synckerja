import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Search, Plus, Trash2 } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { Service } from '../hooks/useServices';

interface ProductKnowledgeFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedServiceId: string;
  setSelectedServiceId: (serviceId: string) => void;
  selectedItems: string[];
  services: Service[];
  onAdd: () => void;
  onDeleteSelected: () => void;
}

export const ProductKnowledgeFilters: React.FC<ProductKnowledgeFiltersProps> = ({
  searchTerm,
  setSearchTerm,
  selectedServiceId,
  setSelectedServiceId,
  selectedItems,
  services = [],
  onAdd,
  onDeleteSelected,
}) => {
  const { t } = useAppTranslation();

  const handleAdd = (e: React.MouseEvent | React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onAdd();
  };

  const handleDeleteSelected = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDeleteSelected();
  };

  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-3">
      <div className="relative min-w-[12rem] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
        <Input
          placeholder={t('productKnowledge.filters.searchPlaceholder', 'Search product knowledge...')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-9 pl-10 text-sm"
        />
      </div>
      <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
        <SelectTrigger className="h-9 w-[200px] shrink-0 text-sm">
          <SelectValue placeholder={t('productKnowledge.filters.servicePlaceholder', 'All Services')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            {t('productKnowledge.filters.allServices', 'All Services')}
          </SelectItem>
          {services.map((service) => (
            <SelectItem key={service.id} value={service.id}>
              {service.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" className="h-9 shrink-0 px-3 text-sm" onClick={handleAdd}>
        <Plus className="mr-2 h-4 w-4" />
        {t('productKnowledge.filters.addButton', 'Add Product Knowledge')}
      </Button>
      {selectedItems.length > 0 && (
        <Button type="button" className="h-9 shrink-0 px-3 text-sm" variant="destructive" onClick={handleDeleteSelected}>
          <Trash2 className="mr-2 h-4 w-4" />
          {t('productKnowledge.filters.deleteSelected', 'Delete Selected ({{count}})', { count: selectedItems.length })}
        </Button>
      )}
    </div>
  );
};

