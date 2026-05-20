
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Button } from '@/shared/components/ui/button';
import { EllipsisVertical, Plus, Edit, Trash2, Lock, Search } from 'lucide-react';

import { useMasterData } from '../../../hook/useMasterData';
import { SubService, Service } from '../../../types/social-media';

interface SubServiceManagerProps {
  onDataChange: () => void;
  services: Service[];
  /** Pre-select parent service when adding from a line that already has a service. */
  defaultServiceId?: string;
  /** Called after a new category (sub-service) is created. */
  onCreated?: (name: string) => void;
}

export const SubServiceManager: React.FC<SubServiceManagerProps> = React.memo(
  ({ onDataChange, services, defaultServiceId = '', onCreated }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftName, setDraftName] = useState('');
  const [modalData, setModalData] = useState<{
    open: boolean;
    mode: 'add' | 'edit';
    item: SubService | null;
  }>({
    open: false,
    mode: 'add',
    item: null
  });

  const [subServices, setSubServices] = useState<SubService[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const { loading, fetchData, addData, updateData, deleteData } = useMasterData('sub_services');

  const loadSubServices = useCallback(async () => {
    const data = await fetchData();
    setSubServices(data as SubService[]);
  }, [fetchData]);

  useEffect(() => {
    void loadSubServices();
  }, [loadSubServices]);

  const handleAdd = useCallback(() => {
    setDraftName('');
    setModalData({
      open: true,
      mode: 'add',
      item: null
    });
    setSelectedServiceId(defaultServiceId || '');
    setIsOpen(false);
  }, [defaultServiceId]);

  const handleEdit = useCallback((item: SubService) => {
    setDraftName(item.name);
    setModalData({
      open: true,
      mode: 'edit',
      item
    });
    setSelectedServiceId(item.service_id || '');
    setIsOpen(false);
  }, []);

  const handleDelete = useCallback(async (item: SubService) => {
    if (window.confirm(`Are you sure you want to delete "${item.name}"?`)) {
      const success = await deleteData(item.id, item.name);
      if (success) {
        await loadSubServices();
        onDataChange();
      }
    }
    setIsOpen(false);
  }, [deleteData, loadSubServices, onDataChange]);

  const handleSave = useCallback(async () => {
    const name = draftName.trim();
    if (!name) return;

    if (!selectedServiceId && modalData.mode === 'add') {
      alert('Please select a service first');
      return;
    }

    let success = false;

    if (modalData.mode === 'add') {
      const customData = { service_id: selectedServiceId };
      success = await addData(name, customData);
    } else if (modalData.item) {
      const customData = { service_id: selectedServiceId };
      success = await updateData(modalData.item.id, name, customData);
    }

    if (success) {
      await loadSubServices();
      onDataChange();
      if (modalData.mode === 'add') {
        onCreated?.(name);
      }
      setDraftName('');
      setModalData({ open: false, mode: 'add', item: null });
      setSelectedServiceId('');
    }
  }, [
    modalData,
    draftName,
    selectedServiceId,
    addData,
    updateData,
    loadSubServices,
    onDataChange,
    onCreated,
  ]);

  const handleCloseModal = useCallback(() => {
    setDraftName('');
    setModalData({ open: false, mode: 'add', item: null });
    setSelectedServiceId('');
  }, []);

  // Reset search when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Filter sub-services based on search query
  const filterSubServices = useCallback((items: SubService[]) => {
    if (!searchQuery.trim()) return items;
    
    const query = searchQuery.toLowerCase();
    return items.filter(item => {
      const serviceName = services.find(s => s.id === item.service_id)?.name || '';
      return item.name.toLowerCase().includes(query) || serviceName.toLowerCase().includes(query);
    });
  }, [searchQuery, services]);

  // Separate default and custom sub services
  const defaultSubServices = filterSubServices(subServices.filter(item => !item.organization_id));
  const customSubServices = filterSubServices(subServices.filter(item => item.organization_id));

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 w-6 p-0 hover:bg-gray-100"
          >
            <EllipsisVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 max-h-80 bg-white border shadow-lg z-[1000001] p-0 flex flex-col overflow-hidden">
          {/* Sticky Header - Add Button */}
          <div className="sticky top-0 bg-white z-20 border-b shadow-sm">
            <DropdownMenuItem onClick={handleAdd} className="cursor-pointer rounded-none m-0">
              <Plus className="mr-2 h-4 w-4" />
              Add Sub Service
            </DropdownMenuItem>
          </div>
          
          {/* Sticky Search */}
          {subServices.length > 0 && (
            <div className="sticky top-[40px] bg-white z-20 border-b shadow-sm">
              <div className="px-2 py-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search sub services..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Scrollable Content */}
          <div className="overflow-y-auto seamless-scroll flex-1" style={{ maxHeight: 'calc(20rem - 96px)' }}>
          {(defaultSubServices.length > 0 || customSubServices.length > 0) && (
            <>
              <DropdownMenuSeparator />
              
              {/* Default Sub Services */}
              {defaultSubServices.length > 0 && (
                <>
                  <div className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-50">
                    Default Sub Services (Read-only)
                  </div>
                  {defaultSubServices.map((item) => (
                    <div key={item.id} className="flex items-center justify-between px-2 py-2 bg-gray-50/50">
                      <div className="flex items-center flex-1 min-w-0">
                        <Lock className="h-3 w-3 text-gray-400 mr-2 flex-shrink-0" />
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-sm text-gray-600 truncate">{item.name}</span>
                          <span className="text-xs text-gray-400 truncate">
                            {services.find(s => s.id === item.service_id)?.name || 'No Service'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Custom Sub Services */}
              {customSubServices.length > 0 && (
                <>
                  {defaultSubServices.length > 0 && <DropdownMenuSeparator />}
                  <div className="px-2 py-1 text-xs font-medium text-gray-500">
                    Custom Sub Services
                  </div>
                  {customSubServices.map((item) => (
                    <div key={item.id} className="flex items-center justify-between px-2 py-1 hover:bg-gray-50">
                      <div className="flex flex-col flex-1 min-w-0 mr-2">
                        <span className="text-sm truncate">{item.name}</span>
                        <span className="text-xs text-gray-500 truncate">
                          {services.find(s => s.id === item.service_id)?.name || 'No Service'}
                        </span>
                      </div>
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

              {/* Show message if no custom sub services */}
              {customSubServices.length === 0 && defaultSubServices.length > 0 && !searchQuery && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-2 text-xs text-gray-500 text-center italic">
                    No custom sub services yet
                  </div>
                </>
              )}

              {/* Show message if no data at all */}
              {defaultSubServices.length === 0 && customSubServices.length === 0 && !searchQuery && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-2 text-xs text-gray-500 text-center italic">
                    No sub services available
                  </div>
                </>
              )}

              {/* Show message if search returns no results */}
              {defaultSubServices.length === 0 && customSubServices.length === 0 && searchQuery && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-2 text-xs text-gray-500 text-center italic">
                    No results found for "{searchQuery}"
                  </div>
                </>
              )}
            </>
          )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Enhanced Modal with Service Selection */}
      {modalData.open && createPortal(
        <div
          className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/50"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div
            className="relative w-96 rounded-lg bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-semibold">
              {modalData.mode === 'add' ? 'Add Sub Service' : 'Edit Sub Service'}
            </h2>

            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Service *
              </label>
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select a service...</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Sub Service Name *
              </label>
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter sub service name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleSave();
                  }
                }}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleCloseModal}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleSave()}
                disabled={loading || !draftName.trim() || (modalData.mode === 'add' && !selectedServiceId)}
              >
                {loading ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
});

SubServiceManager.displayName = 'SubServiceManager';
