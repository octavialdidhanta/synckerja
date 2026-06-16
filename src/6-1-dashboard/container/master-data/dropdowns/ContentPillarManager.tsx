
import React, { useState, useEffect, useCallback } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Button } from '@/shared/components/ui/button';
import { EllipsisVertical, Plus, Edit, Trash2, Lock, Search } from 'lucide-react';
import { useMasterData } from '../../../hook/useMasterData';
import { ContentPillar } from '../../../types/social-media';
import { EnhancedContentPillarModal } from '../../../modal/EnhancedContentPillarModal';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/shared/components/ui/input';

interface ContentPillarManagerProps {
  onDataChange: () => void;
}

export const ContentPillarManager: React.FC<ContentPillarManagerProps> = React.memo(({ onDataChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalData, setModalData] = useState<{
    open: boolean;
    mode: 'add' | 'edit';
    item: ContentPillar | null;
  }>({
    open: false,
    mode: 'add',
    item: null
  });

  const [contentPillars, setContentPillars] = useState<ContentPillar[]>([]);
  const { loading, fetchData, addData, updateData, deleteData } = useMasterData('content_pillars');
  const queryClient = useQueryClient();
  const hasLoadedRef = React.useRef(false);

  // Stable load function - only load once on mount
  const loadContentPillars = useCallback(async () => {
    if (hasLoadedRef.current) return; // Prevent duplicate loads
    hasLoadedRef.current = true;
    try {
      const { logger } = await import('@/shared/lib/logger');
      logger.rateLimited('pillar-load', 3000, () => logger.debug('Loading content pillars...'));
    } catch {
      console.log('Loading content pillars...');
    }
    const data = await fetchData();
    try {
      const { logger } = await import('@/shared/lib/logger');
      logger.rateLimited('pillar-loaded', 3000, () => logger.debug('Content pillars loaded:', data));
    } catch {
      console.log('Content pillars loaded:', data);
    }
    setContentPillars(data as ContentPillar[]);
  }, [fetchData]);

  // Load when dropdown opens (not on page mount)
  useEffect(() => {
    if (!isOpen && !modalData.open) return;
    hasLoadedRef.current = false;
    void loadContentPillars();
  }, [isOpen, modalData.open, loadContentPillars]);

  const invalidateQueries = useCallback(() => {
    // Invalidate related queries to trigger auto-refresh
    queryClient.invalidateQueries({ queryKey: ['contentPillarData'] });
    queryClient.invalidateQueries({ queryKey: ['social-media-master'] });
    queryClient.invalidateQueries({ queryKey: ['contentPillars'] });
    queryClient.invalidateQueries({ queryKey: ['masterData'] });
  }, [queryClient]);

  const handleAdd = useCallback(() => {
    setModalData({
      open: true,
      mode: 'add',
      item: null
    });
    setIsOpen(false);
  }, []);

  const handleEdit = useCallback((item: ContentPillar) => {
    setModalData({
      open: true,
      mode: 'edit',
      item
    });
    setIsOpen(false);
  }, []);

  const handleDelete = useCallback(async (item: ContentPillar) => {
    if (window.confirm(`Are you sure you want to delete "${item.name}"?`)) {
      const success = await deleteData(item.id, item.name);
      if (success) {
        await loadContentPillars();
        onDataChange();
        invalidateQueries(); // Auto-refresh
      }
    }
    setIsOpen(false);
  }, [deleteData, loadContentPillars, onDataChange, invalidateQueries]);

  const handleSave = useCallback(async (pillarData: Partial<ContentPillar>) => {
    let success = false;
    
    if (modalData.mode === 'add') {
      success = await addData(pillarData.name!, pillarData);
    } else if (modalData.item) {
      success = await updateData(modalData.item.id, pillarData.name!, pillarData);
    }

    if (success) {
      await loadContentPillars();
      onDataChange();
      invalidateQueries(); // Auto-refresh
      setModalData({ open: false, mode: 'add', item: null });
    }
  }, [modalData, addData, updateData, loadContentPillars, onDataChange, invalidateQueries]);

  const handleCloseModal = useCallback(() => {
    setModalData({ open: false, mode: 'add', item: null });
  }, []);

  // Clear search when dropdown closes
  const handleDropdownChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setSearchQuery('');
    }
  }, []);

  // Separate default and custom content pillars, then filter by search query
  const defaultContentPillars = contentPillars
    .filter(item => !item.organization_id)
    .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
  const customContentPillars = contentPillars
    .filter(item => item.organization_id)
    .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={handleDropdownChange}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 w-6 p-0 hover:bg-gray-100"
          >
            <EllipsisVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 max-h-80 bg-white border shadow-lg z-[1000001] p-0 flex flex-col">
          {/* Sticky Header - Add Button */}
          <div className="sticky top-0 bg-white z-10 border-b">
            <DropdownMenuItem onClick={handleAdd} className="cursor-pointer">
              <Plus className="mr-2 h-4 w-4" />
              Add Content Pillar
            </DropdownMenuItem>
          </div>
          
          {/* Sticky Search */}
          <div className="sticky top-[41px] bg-white z-10 border-b">
            <div className="px-2 py-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search content pillars..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          </div>
          
          {/* Scrollable Content */}
          <div className="overflow-y-auto seamless-scroll max-h-[calc(20rem-82px)]">
          {(defaultContentPillars.length > 0 || customContentPillars.length > 0) && (
            <>
              <DropdownMenuSeparator />
              
              {/* Default Content Pillars */}
              {defaultContentPillars.length > 0 && (
                <>
                  <div className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-50">
                    Default Content Pillars (Read-only)
                  </div>
                  {defaultContentPillars.map((item) => (
                    <div key={item.id} className="flex items-center justify-between px-2 py-2 bg-gray-50/50">
                      <div className="flex items-center flex-1 min-w-0">
                        <Lock className="h-3 w-3 text-gray-400 mr-2 flex-shrink-0" />
                        <span className="text-sm text-gray-600 truncate">{item.name}</span>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Custom Content Pillars */}
              {customContentPillars.length > 0 && (
                <>
                  {defaultContentPillars.length > 0 && <DropdownMenuSeparator />}
                  <div className="px-2 py-1 text-xs font-medium text-gray-500">
                    Custom Content Pillars
                  </div>
                  {customContentPillars.map((item) => (
                    <div key={item.id} className="flex items-center justify-between px-2 py-1 hover:bg-gray-50">
                      <span className="text-sm truncate flex-1 mr-2">{item.name}</span>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-blue-100"
                          onClick={() => handleEdit(item)}
                          title="Edit"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-red-100"
                          onClick={() => handleDelete(item)}
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Show message if no custom content pillars */}
              {customContentPillars.length === 0 && defaultContentPillars.length > 0 && !searchQuery && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-2 text-xs text-gray-500 text-center italic">
                    No custom content pillars yet
                  </div>
                </>
              )}

              {/* Show message if no data at all */}
              {defaultContentPillars.length === 0 && customContentPillars.length === 0 && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-2 text-xs text-gray-500 text-center italic">
                    {searchQuery ? `No content pillars found for "${searchQuery}"` : 'No content pillars available'}
                  </div>
                </>
              )}
            </>
          )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <EnhancedContentPillarModal
        open={modalData.open}
        mode={modalData.mode}
        item={modalData.item}
        onClose={handleCloseModal}
        onSave={handleSave}
        saving={loading}
      />
    </>
  );
});

ContentPillarManager.displayName = 'ContentPillarManager';
