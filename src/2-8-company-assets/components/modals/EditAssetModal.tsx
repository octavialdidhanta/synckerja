import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { CustomDatePicker } from '@/shared/calendar';
import { useShowToast } from '@/shared/hooks/useShowToast';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { supabase } from '@/shared/lib/supabaseClient';
import { Separator } from '@/shared/components/ui/separator';
import { Package, Tag, Calendar, Image as ImageIcon, AlertCircle, Upload, X } from 'lucide-react';
import { format } from 'date-fns';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

interface Asset {
  id: string;
  name: string;
  type: string;
  serial_number: string;
  asset_tag: string;
  brand: string;
  model: string;
  status: string;
  condition: string;
  purchase_date: string;
  purchase_price: number;
  notes: string;
  image_url: string;
  created_at: string;
}

interface EditAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  asset: Asset | null;
}

export const EditAssetModal = ({ isOpen, onClose, onSave, asset }: EditAssetModalProps) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [assetTag, setAssetTag] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [status, setStatus] = useState('available');
  const [condition, setCondition] = useState('new');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { t } = useAppTranslation();
  const { organizationId } = useCurrentOrg();
  const showToast = useShowToast();

  // Load asset data when modal opens
  useEffect(() => {
    if (asset && isOpen) {
      setName(asset.name || '');
      setType(asset.type || '');
      setSerialNumber(asset.serial_number || '');
      setAssetTag(asset.asset_tag || '');
      setBrand(asset.brand || '');
      setModel(asset.model || '');
      setStatus(asset.status || 'available');
      setCondition(asset.condition || 'new');
      setPurchaseDate(asset.purchase_date || '');
      setPurchasePrice(asset.purchase_price ? asset.purchase_price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '');
      setNotes(asset.notes || '');
      setImageUrl(asset.image_url || '');
      setImagePreview(asset.image_url || null);
      setErrors({});
    }
  }, [asset, isOpen]);

  // Upload image to Supabase storage
  const uploadImage = async (file: File): Promise<string | null> => {
    if (!organizationId) {
      throw new Error('Organization ID not found');
    }

    setIsUploadingImage(true);
    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file');
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error('File size must be less than 5MB');
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const fileName = `company-assets/${organizationId}/${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      // Try to upload to 'employee-documents' bucket with folder structure
      const bucketName = 'employee-documents';
      
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, {
          cacheControl: '31536000',
          upsert: false
        });

      if (error) {
        if (error.message.includes('Bucket not found') || error.message.includes('not found')) {
          throw new Error('Storage bucket not found. Please ensure storage buckets are configured in Supabase.');
        }
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (error: any) {
      console.error('Error uploading image:', error);
      showToast({
        title: 'Error',
        description: error.message || 'Failed to upload image',
        variant: 'destructive'
      });
      return null;
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    const uploadedUrl = await uploadImage(file);
    if (uploadedUrl) {
      setImageUrl(uploadedUrl);
    } else {
      setImageFile(null);
      setImagePreview(null);
    }
  };

  // Handle remove image
  const handleRemoveImage = async () => {
    if (imageUrl) {
      // Extract path from URL and delete from storage
      try {
        const urlParts = imageUrl.split('/employee-documents/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          await supabase.storage
            .from('employee-documents')
            .remove([filePath]);
        } else {
          const companyAssetsParts = imageUrl.split('/company-assets/');
          if (companyAssetsParts.length > 1) {
            const filePath = companyAssetsParts[1];
            await supabase.storage
              .from('company-assets')
              .remove([filePath]);
          }
        }
      } catch (error) {
        console.error('Error deleting image:', error);
      }
    }
    setImageUrl('');
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!name.trim()) {
      newErrors.name = 'Asset name is required';
    }
    if (!type.trim()) {
      newErrors.type = 'Asset type is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const formatPrice = (value: string): string => {
    // Remove all non-numeric characters
    const numericValue = value.replace(/\D/g, '');
    
    if (!numericValue) return '';
    
    // Format with thousand separator (.)
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const parsePrice = (value: string): number => {
    // Remove all non-numeric characters (including thousand separators)
    const numericValue = parseFloat(value.replace(/\D/g, '')) || 0;
    return numericValue;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      showToast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    if (!organizationId || !asset) {
      showToast({
        title: t('common.error', 'Error'),
        description: t('companyAssets.editAssetFailed', 'Failed to update asset'),
        variant: 'destructive'
      });
      return;
    }

    setIsSaving(true);
    try {
      const priceValue = parsePrice(purchasePrice);
      const wasInUse = asset.status === 'in-use';
      const changingToNonCustody = (status === 'maintenance' || status === 'disposed');

      const updatePayload: Record<string, unknown> = {
        name: name.trim(),
        type: type.trim(),
        serial_number: serialNumber.trim() || null,
        asset_tag: assetTag.trim() || null,
        brand: brand.trim() || null,
        model: model.trim() || null,
        status: status,
        condition: condition,
        purchase_date: purchaseDate || null,
        purchase_price: priceValue || null,
        notes: notes.trim() || null,
        image_url: imageUrl.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (wasInUse && changingToNonCustody) {
        updatePayload.assigned_to_employee_id = null;
        updatePayload.assigned_at = null;
      }

      const { error } = await supabase
        .from('company_assets')
        .update(updatePayload)
        .eq('id', asset.id);

      if (error) {
        throw error;
      }

      if (wasInUse && changingToNonCustody) {
        const { data: currentRows } = await supabase
          .from('asset_assignments')
          .select('id')
          .eq('asset_id', asset.id)
          .is('ended_at', null);
        if (currentRows?.length) {
          await supabase
            .from('asset_assignments')
            .update({ ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .in('id', currentRows.map((r) => r.id));
        }
      }

      showToast({
        title: t('common.success', 'Success'),
        description: t('companyAssets.editAssetSuccess', 'Asset updated successfully.'),
        variant: 'default'
      });

      onSave();
      onClose();
    } catch (error: any) {
      showToast({
        title: t('common.error', 'Error'),
        description: error.message || t('companyAssets.editAssetFailed', 'Failed to update asset'),
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[600px] h-[600px] max-w-[90vw] max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="flex-shrink-0 border-b border-border bg-gradient-to-r from-accent/80 to-primary/5 px-6 pb-4 pt-6 dark:from-accent/20 dark:to-primary/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">{t('companyAssets.editAssetTitle', 'Edit asset')}</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                {t('companyAssets.editAssetDescription', 'Update asset details in your inventory')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div 
          className="flex-1 overflow-y-auto px-6 py-6" 
          style={{ 
            scrollbarWidth: 'thin',
            scrollBehavior: 'smooth',
            scrollbarColor: '#d1d5db transparent'
          }}
        >
          <div className="space-y-6">
            {/* Basic Information Section */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium text-foreground">
                    Asset Name <span className="text-destructive">*</span>
                  </label>
                  <Input 
                    id="name" 
                    value={name} 
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors({ ...errors, name: '' });
                    }}
                    placeholder="Enter asset name"
                    className={errors.name ? 'border-destructive' : ''}
                  />
                  {errors.name && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.name}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label htmlFor="type" className="text-sm font-medium text-foreground">
                    Asset Type <span className="text-destructive">*</span>
                  </label>
                  <Select 
                    value={type} 
                    onValueChange={(value) => {
                      setType(value);
                      if (errors.type) setErrors({ ...errors, type: '' });
                    }}
                  >
                    <SelectTrigger id="type" className={errors.type ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Select asset type" />
                    </SelectTrigger>
                    <SelectContent>
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
                  {errors.type && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.type}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Identification Section */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="assetTag" className="text-sm font-medium text-foreground">
                    Asset Tag
                  </label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="assetTag"
                      value={assetTag}
                      onChange={(e) => setAssetTag(e.target.value)}
                      placeholder="Enter asset tag"
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="serialNumber" className="text-sm font-medium text-foreground">
                    Serial Number
                  </label>
                  <Input
                    id="serialNumber"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="Enter serial number"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Brand & Model Section */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="brand" className="text-sm font-medium text-foreground">
                    Brand
                  </label>
                  <Input 
                    id="brand" 
                    value={brand} 
                    onChange={(e) => setBrand(e.target.value)} 
                    placeholder="Enter brand"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="model" className="text-sm font-medium text-foreground">
                    Model
                  </label>
                  <Input 
                    id="model" 
                    value={model} 
                    onChange={(e) => setModel(e.target.value)} 
                    placeholder="Enter model"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Status & Condition Section */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="status" className="text-sm font-medium text-foreground">
                    Status
                  </label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {status !== 'in-use' && <SelectItem value="available">Available</SelectItem>}
                      {status === 'in-use' && <SelectItem value="in-use">In Use</SelectItem>}
                      {status !== 'in-use' && (
                        <SelectItem value="in-use" disabled className="opacity-60">
                          {t('companyAssets.inUseUseAssignAction', 'In Use (use Assign action)')}
                        </SelectItem>
                      )}
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="disposed">Disposed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="condition" className="text-sm font-medium text-foreground">
                    Condition
                  </label>
                  <Select value={condition} onValueChange={setCondition}>
                    <SelectTrigger id="condition">
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="used">Used</SelectItem>
                      <SelectItem value="damaged">Damaged</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Purchase Information Section */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="purchaseDate" className="text-sm font-medium text-foreground">
                    Purchase Date
                  </label>
                  <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal h-10 border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                      >
                        <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                        {purchaseDate ? (
                          <span className="text-foreground">{format(new Date(purchaseDate), 'MMM dd, yyyy')}</span>
                        ) : (
                          <span className="text-muted-foreground">Select purchase date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-md shadow-lg" style={{ border: '1px solid hsl(var(--border))', borderTopWidth: '1px', borderRightWidth: '1px', borderBottomWidth: '1px', borderLeftWidth: '1px' }} align="start">
                      <div className="p-2">
                        <CustomDatePicker
                          selected={purchaseDate ? new Date(purchaseDate) : undefined}
                          onSelect={(date: Date) => {
                            setPurchaseDate(format(date, 'yyyy-MM-dd'));
                            setIsDatePickerOpen(false);
                          }}
                          className="border-0 shadow-none"
                        />
                        {purchaseDate && (
                          <div className="flex justify-center gap-2 pt-2 border-t mt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setPurchaseDate('');
                                setIsDatePickerOpen(false);
                              }}
                              className="text-primary hover:bg-accent hover:text-primary"
                            >
                              Clear
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setPurchaseDate(format(new Date(), 'yyyy-MM-dd'));
                                setIsDatePickerOpen(false);
                              }}
                              className="text-primary hover:bg-accent hover:text-primary"
                            >
                              Today
                            </Button>
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <label htmlFor="purchasePrice" className="text-sm font-medium text-foreground">
                    Purchase Price
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm font-medium text-muted-foreground pointer-events-none">Rp</span>
                    <Input
                      type="text"
                      id="purchasePrice"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(formatPrice(e.target.value))}
                      placeholder="Enter purchase price"
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Additional Information Section */}
            <div className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="imageUrl" className="text-sm font-medium text-foreground">
                    Asset Image
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    id="imageUrl"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={isUploadingImage}
                  />
                  {!imagePreview && !imageUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="w-full h-24 border-2 border-dashed border-input hover:border-primary/50 transition-colors"
                    >
                      <div className="flex flex-col items-center gap-2">
                        {isUploadingImage ? (
                          <>
                            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm text-muted-foreground">Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-6 h-6 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              Click to upload image or drag and drop
                            </span>
                            <span className="text-xs text-muted-foreground">
                              PNG, JPG, GIF up to 5MB
                            </span>
                          </>
                        )}
                      </div>
                    </Button>
                  ) : (
                    <div className="relative w-full">
                      <div className="relative aspect-video w-full rounded-md overflow-hidden border border-input bg-muted">
                        <img
                          src={imagePreview || imageUrl}
                          alt="Asset preview"
                          className="w-full h-full object-cover"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={handleRemoveImage}
                          className="absolute top-2 right-2 h-8 w-8 p-0"
                          disabled={isUploadingImage}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {isUploadingImage && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-md">
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm text-muted-foreground">Uploading...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label htmlFor="notes" className="text-sm font-medium text-foreground">
                    Notes <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                  </label>
                  <Textarea 
                    id="notes" 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)} 
                    placeholder="Enter additional notes"
                    className="min-h-[100px] resize-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-4 flex-shrink-0 border-t bg-muted/30">
          <div className="flex items-center justify-end gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              onClick={handleSave} 
              disabled={isSaving}
              className="min-w-[120px]"
            >
              {isSaving ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Updating...
                </>
              ) : (
                'Update Asset'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
