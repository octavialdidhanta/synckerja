import React, { useState, useMemo } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Search, Filter, Plus, Trash2, CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
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
              <CalendarIcon className="h-4 w-4 text-blue-500" />
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
        <Popover open={isMonthPickerOpen} onOpenChange={setIsMonthPickerOpen}>
          <PopoverTrigger asChild>
            <div className="hidden" aria-hidden />
          </PopoverTrigger>
          <PopoverContent 
            className="w-auto p-0 border border-gray-200 rounded-lg shadow-lg" 
            align="start"
            side="bottom"
            sideOffset={4}
          >
            <div className="p-2">
              <div className="text-sm font-medium text-gray-700 mb-2 px-2 flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-blue-500" />
                Select Month
              </div>
              <MonthPicker
                selected={selectedMonth}
                onSelect={handleCustomMonthSelect}
              />
            </div>
          </PopoverContent>
        </Popover>
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
