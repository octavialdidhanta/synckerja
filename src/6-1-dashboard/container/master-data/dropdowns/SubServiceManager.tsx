
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Button } from '@/shared/components/ui/button';
import { EllipsisVertical, Plus, Edit, Trash2, Lock, Search, ImagePlus, X } from 'lucide-react';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

import { useMasterData } from '../../../hook/useMasterData';
import { SubService, Service } from '../../../types/social-media';
import {
  clipboardImageFile,
  removeSubServicePhoto,
  setSubServiceImagePath,
  signSubServicePhotos,
  subServicePhotoError,
  uploadSubServicePhoto,
} from '../../../lib/subServicePhoto';

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
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const [existingPreviewUrl, setExistingPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [listPhotoUrls, setListPhotoUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { organizationId } = useCurrentOrg();
  const { loading, fetchData, addData, updateData, deleteData } = useMasterData('sub_services');
  const pendingPreviewUrl = useMemo(
    () => (pendingFile ? URL.createObjectURL(pendingFile) : null),
    [pendingFile],
  );

  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

  const loadSubServices = useCallback(async () => {
    const data = await fetchData();
    setSubServices(data as SubService[]);
  }, [fetchData]);

  useEffect(() => {
    if (!isOpen) return;
    void loadSubServices();
  }, [isOpen, loadSubServices]);

  useEffect(() => {
    const paths = subServices.flatMap((item) => (item.image_path ? [item.image_path] : []));
    if (paths.length === 0) {
      setListPhotoUrls({});
      return;
    }
    let cancelled = false;
    void signSubServicePhotos(paths).then((urls) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const item of subServices) {
        const signed = item.image_path ? urls.get(item.image_path) : undefined;
        if (signed) next[item.id] = signed;
      }
      setListPhotoUrls(next);
    });
    return () => {
      cancelled = true;
    };
  }, [subServices]);

  const resetImageDraft = useCallback(() => {
    setPendingFile(null);
    setRemoveExisting(false);
    setExistingPreviewUrl(null);
  }, []);

  const acceptImage = useCallback((file: File) => {
    const message = subServicePhotoError(file);
    if (message) {
      toast.error(message);
      return;
    }
    setPendingFile(file);
    setRemoveExisting(false);
  }, []);

  const handleAdd = useCallback(() => {
    setDraftName('');
    resetImageDraft();
    setModalData({
      open: true,
      mode: 'add',
      item: null
    });
    setSelectedServiceId(defaultServiceId || '');
    setIsOpen(false);
  }, [defaultServiceId, resetImageDraft]);

  const handleEdit = useCallback((item: SubService) => {
    setDraftName(item.name);
    resetImageDraft();
    setModalData({
      open: true,
      mode: 'edit',
      item
    });
    setSelectedServiceId(item.service_id || '');
    setIsOpen(false);
  }, [resetImageDraft]);

  const handleDelete = useCallback(async (item: SubService) => {
    if (window.confirm(`Are you sure you want to delete "${item.name}"?`)) {
      const success = await deleteData(item.id, item.name);
      if (success) {
        if (item.image_path) {
          try {
            await removeSubServicePhoto(item.image_path);
          } catch (error) {
            console.error('Failed to remove sub category photo', error);
          }
        }
        await loadSubServices();
        onDataChange();
      }
    }
    setIsOpen(false);
  }, [deleteData, loadSubServices, onDataChange]);

  const handleSave = useCallback(async () => {
    const name = draftName.trim();
    if (!name || saving) return;

    if (!selectedServiceId && modalData.mode === 'add') {
      alert('Please select a service first');
      return;
    }

    if (pendingFile) {
      const imageError = subServicePhotoError(pendingFile);
      if (imageError) {
        toast.error(imageError);
        return;
      }
    }

    const persistImage = async (subServiceId: string, previousPath?: string | null) => {
      if (!pendingFile && !removeExisting) return;
      if (!organizationId) {
        toast.error('Organization not found');
        return;
      }
      if (pendingFile) {
        const path = await uploadSubServicePhoto({
          organizationId,
          subServiceId,
          file: pendingFile,
        });
        if (previousPath && previousPath !== path) {
          await removeSubServicePhoto(previousPath);
        }
        await setSubServiceImagePath(subServiceId, path);
        return;
      }
      if (removeExisting && previousPath) {
        await removeSubServicePhoto(previousPath);
        await setSubServiceImagePath(subServiceId, null);
      }
    };

    let savedId: string | null = null;
    setSaving(true);
    try {
      if (modalData.mode === 'add') {
        const createdId = await addData(name, { service_id: selectedServiceId });
        savedId = typeof createdId === 'string' ? createdId : null;
      } else if (modalData.item?.organization_id) {
        const updated = await updateData(modalData.item.id, name, { service_id: selectedServiceId });
        savedId = updated ? modalData.item.id : null;
      }

      if (!savedId) return;

      if (pendingFile || removeExisting) {
        try {
          await persistImage(savedId, modalData.item?.image_path);
        } catch (error) {
          toast.error((error as Error).message || 'Could not save the image.');
        }
      }

      await loadSubServices();
      onDataChange();
      if (modalData.mode === 'add') {
        onCreated?.(name);
      }
      setDraftName('');
      resetImageDraft();
      setModalData({ open: false, mode: 'add', item: null });
      setSelectedServiceId('');
    } finally {
      setSaving(false);
    }
  }, [
    modalData,
    draftName,
    selectedServiceId,
    pendingFile,
    removeExisting,
    organizationId,
    addData,
    updateData,
    loadSubServices,
    onDataChange,
    onCreated,
    resetImageDraft,
    saving,
  ]);

  const handleCloseModal = useCallback(() => {
    setDraftName('');
    resetImageDraft();
    setModalData({ open: false, mode: 'add', item: null });
    setSelectedServiceId('');
  }, [resetImageDraft]);

  useEffect(() => {
    const imagePath = modalData.item?.image_path;
    if (!modalData.open || !imagePath || removeExisting || pendingFile) {
      setExistingPreviewUrl(null);
      return;
    }
    let cancelled = false;
    void signSubServicePhotos([imagePath]).then((urls) => {
      if (!cancelled) setExistingPreviewUrl(urls.get(imagePath) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [modalData.open, modalData.item?.image_path, removeExisting, pendingFile]);

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
        <DropdownMenuContent align="end" className="w-72 max-h-80 bg-white border shadow-lg z-[1000001] p-0 flex flex-col overflow-hidden">
          {/* Sticky Header - Add Button */}
          <div className="sticky top-0 bg-white z-20 border-b shadow-sm">
            <DropdownMenuItem onClick={handleAdd} className="cursor-pointer rounded-none m-0">
              <Plus className="mr-2 h-4 w-4" />
              Add Sub Category
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
                    placeholder="Search sub categories..."
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
          <div className="overflow-x-hidden overflow-y-auto seamless-scroll flex-1" style={{ maxHeight: 'calc(20rem - 96px)' }}>
          {(defaultSubServices.length > 0 || customSubServices.length > 0) && (
            <>
              <DropdownMenuSeparator />
              
              {/* Default Sub Services */}
              {defaultSubServices.length > 0 && (
                <>
                  <div className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-50">
                    Default Sub Categories (Read-only)
                  </div>
                  {defaultSubServices.map((item) => (
                    <div key={item.id} className="flex items-center justify-between px-2 py-2 bg-gray-50/50">
                      <div className="flex items-center flex-1 min-w-0">
                        <Lock className="h-3 w-3 text-gray-400 mr-2 flex-shrink-0" />
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-sm text-gray-600 truncate">{item.name}</span>
                          <span className="text-xs text-gray-400 truncate">
                            {services.find(s => s.id === item.service_id)?.name || 'No Category'}
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
                    Custom Sub Categories
                  </div>
                  {customSubServices.map((item) => (
                    <div key={item.id} className="flex items-center justify-between px-2 py-1 hover:bg-gray-50">
                      <div className="flex min-w-0 flex-1 items-center mr-2">
                        {listPhotoUrls[item.id] ? (
                          <img
                            src={listPhotoUrls[item.id]}
                            alt=""
                            className="mr-2 h-8 w-8 shrink-0 rounded border border-gray-200 object-cover"
                          />
                        ) : null}
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm">{item.name}</span>
                          <span className="truncate text-xs text-gray-500">
                            {services.find(s => s.id === item.service_id)?.name || 'No Category'}
                          </span>
                        </div>
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
                    No custom sub categories yet
                  </div>
                </>
              )}

              {/* Show message if no data at all */}
              {defaultSubServices.length === 0 && customSubServices.length === 0 && !searchQuery && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-2 text-xs text-gray-500 text-center italic">
                    No sub categories available
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
            className="relative w-[28rem] rounded-lg bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
            onPaste={(event) => {
              const file = clipboardImageFile(event.clipboardData);
              if (!file) return;
              event.preventDefault();
              acceptImage(file);
            }}
          >
            <h2 className="mb-4 text-lg font-semibold">
              {modalData.mode === 'add' ? 'Add Sub Category' : 'Edit Sub Category'}
            </h2>

            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Category *
              </label>
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select a category...</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Sub Category Name *
              </label>
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter sub category name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleSave();
                  }
                }}
              />
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Product image
              </label>
              <div className="flex items-stretch gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="flex w-28 shrink-0 items-center justify-center self-stretch overflow-hidden rounded-md border border-gray-200 bg-white">
                  {pendingPreviewUrl || existingPreviewUrl ? (
                    <img
                      src={pendingPreviewUrl || existingPreviewUrl || ''}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImagePlus className="h-5 w-5 text-gray-400" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {pendingPreviewUrl || existingPreviewUrl ? 'Photo added' : 'No photo yet'}
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-gray-500">
                    Paste with Ctrl+V, or upload PNG, JPEG, WebP, or GIF. Max 5 MB.
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 bg-white px-3 text-xs"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {pendingPreviewUrl || existingPreviewUrl ? 'Replace' : 'Upload'}
                    </Button>
                    {pendingPreviewUrl || existingPreviewUrl ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 px-2 text-xs text-gray-600"
                        onClick={() => {
                          setPendingFile(null);
                          setRemoveExisting(true);
                          setExistingPreviewUrl(null);
                        }}
                      >
                        <X className="mr-1 h-3.5 w-3.5" />
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) acceptImage(file);
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
                disabled={loading || saving || !draftName.trim() || (modalData.mode === 'add' && !selectedServiceId)}
              >
                {loading || saving ? 'Saving...' : 'Save'}
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
