import React, { useState, useMemo } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Search, Filter, Plus, Trash2, CalendarIcon } from 'lucide-react';
import { Dialog, DialogContent } from '@/shared/components/ui/dialog';
import { MonthPicker } from '@/shared/calendar';
import { format, startOfMonth, addMonths, subMonths } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ReviewCommentNotificationBell } from './ReviewCommentNotificationBell';
import { SocialMediaProductionNotificationBell } from './SocialMediaProductionNotificationBell';

interface Service {
  id: string;
  name: string;
}

interface SocialMediaFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  serviceFilter: string;
  setServiceFilter: (service: string) => void;
  services: Service[];
  selectedItems: string[];
  onAddContent: () => void;
  onDeleteSelected: () => void;
  selectedMonth: Date;
  setSelectedMonth: (month: Date) => void;
  /** When user clicks a comment notification, open this plan in the preview modal (dashboard only) */
  onNotificationPreviewRequest?: (planId: string) => void;
}

export const SocialMediaFilters = React.memo<SocialMediaFiltersProps>(({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  serviceFilter,
  setServiceFilter,
  services,
  selectedItems,
  onAddContent,
  onDeleteSelected,
  selectedMonth,
  setSelectedMonth,
  onNotificationPreviewRequest
}) => {
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  
  // Determine current filter type based on selectedMonth
  const currentFilterType = useMemo(() => {
    const now = new Date();
    const currentMonth = startOfMonth(now);
    const nextMonth = startOfMonth(addMonths(now, 1));
    const lastMonth = startOfMonth(subMonths(now, 1));
    const selected = startOfMonth(selectedMonth);
    
    if (selected.getTime() === currentMonth.getTime()) {
      return 'this_month';
    } else if (selected.getTime() === nextMonth.getTime()) {
      return 'next_month';
    } else if (selected.getTime() === lastMonth.getTime()) {
      return 'last_month';
    } else {
      return 'custom';
    }
  }, [selectedMonth]);
  
  const handleMonthFilterChange = (value: string) => {
    const now = new Date();
    
    if (value === 'custom') {
      // Delay opening popover to ensure Select closes first
      setTimeout(() => {
        setIsMonthPickerOpen(true);
      }, 150);
    } else {
      let newMonth: Date;
      if (value === 'this_month') {
        newMonth = startOfMonth(now);
      } else if (value === 'next_month') {
        newMonth = startOfMonth(addMonths(now, 1));
      } else if (value === 'last_month') {
        newMonth = startOfMonth(subMonths(now, 1));
      } else {
        newMonth = startOfMonth(now);
      }
      setSelectedMonth(newMonth);
      setIsMonthPickerOpen(false);
    }
  };
  
  const handleCustomMonthSelect = (date: Date) => {
    setSelectedMonth(startOfMonth(date));
    setIsMonthPickerOpen(false);
  };
  
  const getMonthFilterDisplayText = () => {
    if (currentFilterType === 'custom') {
      return format(selectedMonth, 'MMMM yyyy', { locale: idLocale });
    }
    
    const labels: Record<string, string> = {
      'this_month': 'This Month',
      'next_month': 'Next Month',
      'last_month': 'Last Month'
    };
    return labels[currentFilterType] || 'This Month';
  };
  
  // Prevent any form submission or page reload
  const handleAddContent = (e: React.MouseEvent | React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onAddContent();
  };

  const handleDeleteSelected = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDeleteSelected();
  };

  return (
    <div className="space-y-4">
      {/* Filter Controls with Add Content Button */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input 
            placeholder="Search content, titles, briefs..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="pl-10" 
          />
        </div>
        <ReviewCommentNotificationBell onOpenPreview={onNotificationPreviewRequest} />
        <SocialMediaProductionNotificationBell onOpenPreview={onNotificationPreviewRequest} />
        <Select
          value={statusFilter && statusFilter !== '' ? statusFilter : 'all'}
          onValueChange={(value) => setStatusFilter(value || 'all')}
        >
          <SelectTrigger className="w-48 h-9">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Ready To Post">Ready To Post</SelectItem>
            <SelectItem value="Content Need Review">Content Need Review</SelectItem>
            <SelectItem value="Content Revision">Content Revision</SelectItem>
            <SelectItem value="Prod Revision">Prod Revision</SelectItem>
            <SelectItem value="Prod Need Review">Prod Need Review</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={serviceFilter} onValueChange={setServiceFilter}>
          <SelectTrigger className="w-48 h-9">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by service" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Services</SelectItem>
            {services && services.length > 0 && services.map((service) => (
              <SelectItem key={service.id} value={service.id}>
                {service.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* Month Filter Dropdown - Select outside Popover so dropdown closes immediately */}
        <Select 
          value={currentFilterType} 
          onValueChange={handleMonthFilterChange}
        >
          <SelectTrigger className="w-auto min-w-[160px] max-w-[220px] h-9 text-sm text-gray-700 text-left whitespace-nowrap overflow-hidden">
            <div className="flex items-center gap-2 whitespace-nowrap overflow-hidden">
              <CalendarIcon className="h-4 w-4 text-primary" />
              <SelectValue placeholder="This Month" className="truncate">
                {getMonthFilterDisplayText()}
              </SelectValue>
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="next_month">Next Month</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
            <SelectItem value="custom">Custom Month</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={isMonthPickerOpen} onOpenChange={setIsMonthPickerOpen}>
          <DialogContent className="w-auto max-w-[min(100vw-2rem,360px)] gap-0 overflow-hidden border border-primary/15 p-0 sm:rounded-lg [&>button]:right-1.5 [&>button]:top-1.5 [&>button]:h-8 [&>button]:w-8 sm:[&>button]:right-1.5 sm:[&>button]:top-1.5">
            <div className="border-b border-primary/10 bg-brand-blue-soft px-4 pb-3 pt-3">
              <div className="flex items-center gap-2 pr-8 text-sm font-medium text-brand-blue-on-soft">
                <CalendarIcon className="h-4 w-4 text-primary" />
                Select Month
              </div>
            </div>
            <div className="p-4 pt-3">
              <MonthPicker
                selected={selectedMonth}
                onSelect={handleCustomMonthSelect}
                className="mx-auto border-0 shadow-none"
              />
            </div>
          </DialogContent>
        </Dialog>
        <Button 
          type="button"
          size="sm" 
          onClick={handleAddContent}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Content
        </Button>
        {selectedItems.length > 0 && (
          <Button 
            type="button"
            size="sm" 
            variant="destructive" 
            onClick={handleDeleteSelected}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Selected ({selectedItems.length})
          </Button>
        )}
      </div>
    </div>
  );
});

SocialMediaFilters.displayName = 'SocialMediaFilters';
