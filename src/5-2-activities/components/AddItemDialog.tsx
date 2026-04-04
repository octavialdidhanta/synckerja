import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { useSalesActivityMasterData } from '@/shared/hooks/organized/sales';
import { CreateSalesActivityItemData } from '@/shared/hooks/organized/sales';
import { useToast } from '@/shared/components/ui/use-toast';
import { devLog } from '@/shared/lib/logger';

const formSchema = z.object({
  service_id: z.string().optional(),
  sub_service_id: z.string().optional(),
  service_name: z.string().min(1, 'Service name is required'),
  sub_service_name: z.string().optional(),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  unit_price: z.number().min(0, 'Unit price must be positive'),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateSalesActivityItemData) => Promise<void>;
  editingItem?: any;
}

export const AddItemDialog = ({ open, onOpenChange, onSubmit, editingItem }: AddItemDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [selectedService, setSelectedService] = useState<string>('');
  const { toast } = useToast();
  
  const {
    services,
    parentServices,
    getSubServicesByService,
  } = useSalesActivityMasterData();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: editingItem ? {
      service_id: editingItem.service_id || '',
      sub_service_id: editingItem.sub_service_id || '',
      service_name: editingItem.service_name || '',
      sub_service_name: editingItem.sub_service_name || '',
      quantity: editingItem.quantity || 1,
      unit_price: editingItem.unit_price || 0,
      notes: editingItem.notes || '',
    } : {
      quantity: 1,
      unit_price: 0,
    },
  });

  // When dialog opens, reset form so Edit shows saved values (unit_price, sub_service, etc.)
  React.useEffect(() => {
    if (!open) return;
    if (editingItem) {
      reset({
        service_id: editingItem.service_id || '',
        sub_service_id: editingItem.sub_service_id || '',
        service_name: editingItem.service_name || '',
        sub_service_name: editingItem.sub_service_name || '',
        quantity: editingItem.quantity ?? 1,
        unit_price: (() => { const u = Number(editingItem.unit_price); return Number.isNaN(u) ? 0 : u; })(),
        notes: editingItem.notes || '',
      });
      setSelectedService(editingItem.service_id || '');
    } else {
      reset({
        service_id: '',
        sub_service_id: '',
        service_name: '',
        sub_service_name: '',
        quantity: 1,
        unit_price: 0,
        notes: '',
      });
      setSelectedService('');
    }
  }, [open, editingItem, reset]);

  // Auto-populate service name when service is selected (add mode only; edit mode already has names from reset)
  React.useEffect(() => {
    if (selectedService && !editingItem) {
      const service = parentServices?.find(s => s.id === selectedService);
      if (service) {
        setValue('service_name', service.name);
      }
    }
  }, [selectedService, parentServices, setValue, editingItem]);

  const handleServiceChange = (serviceId: string) => {
    setSelectedService(serviceId);
    setValue('service_id', serviceId);
    setValue('sub_service_id', ''); // Reset sub service
    setValue('sub_service_name', ''); // Reset sub service name
  };

  const handleSubServiceChange = (subServiceId: string) => {
    setValue('sub_service_id', subServiceId);
    const subServices = getSubServicesByService(selectedService);
    const subService = subServices.find(s => s.id === subServiceId);
    if (subService) {
      setValue('sub_service_name', subService.name);
    }
  };

  const onFormSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      // Ensure service_name is not empty
      const submitData: CreateSalesActivityItemData = {
        ...data,
        service_name: data.service_name || 'Unnamed Service',
        sub_service_name: data.sub_service_name ?? undefined,
        quantity: data.quantity || 1,
        unit_price: data.unit_price || 0,
      };
      await onSubmit(submitData);
      reset();
      setSelectedService('');
      // Close dialog after successful item addition
      onOpenChange(false);
    } catch (error) {
      devLog.error('Error submitting item:', error);
      toast({
        title: "Error",
        description: "Failed to add item.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    reset();
    setSelectedService('');
    onOpenChange(false);
  };

  const filteredSubServices = getSubServicesByService(selectedService);
  const quantity = watch('quantity');
  const unitPrice = watch('unit_price');
  const totalPrice = (quantity || 0) * (unitPrice || 0);

  // Debug: Log services data when dialog opens
  React.useEffect(() => {
    if (open) {
      devLog.debug('🔍 AddItemDialog - Services data:', {
        allServicesCount: services.length,
        parentServicesCount: parentServices?.length || 0,
        parentServices: parentServices
      });
    }
  }, [open, services, parentServices]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4" onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Service Selection */}
            <div>
              <Label htmlFor="service">Service</Label>
              <Select onValueChange={handleServiceChange} value={selectedService}>
                <SelectTrigger>
                  <SelectValue placeholder="Select service" />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  {parentServices && parentServices.length > 0 ? (
                    parentServices.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-services" disabled>
                      No services available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Sub Service Selection */}
            <div>
              <Label htmlFor="sub_service">Sub Service</Label>
              <Select 
                onValueChange={handleSubServiceChange} 
                value={watch('sub_service_id') || ''}
                disabled={!selectedService}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select sub service" />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  {filteredSubServices.map((subService) => (
                    <SelectItem key={subService.id} value={subService.id}>
                      {subService.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Manual Service Name Input */}
          <div>
            <Label htmlFor="service_name">Service Name *</Label>
            <Input
              id="service_name"
              {...register('service_name')}
              placeholder="Enter service name"
            />
            {errors.service_name && (
              <p className="text-sm text-destructive">{errors.service_name.message}</p>
            )}
          </div>

          {/* Manual Sub Service Name Input */}
          <div>
            <Label htmlFor="sub_service_name">Sub Service Name</Label>
            <Input
              id="sub_service_name"
              {...register('sub_service_name')}
              placeholder="Enter sub service name (optional)"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Quantity */}
            <div>
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                step="1"
                min="1"
                {...register('quantity', { valueAsNumber: true })}
                placeholder="1"
              />
              {errors.quantity && (
                <p className="text-sm text-destructive">{errors.quantity.message}</p>
              )}
            </div>

            {/* Unit Price */}
            <div>
              <Label htmlFor="unit_price">Unit Price *</Label>
              <Input
                id="unit_price"
                type="number"
                step="0.01"
                min="0"
                {...register('unit_price', { valueAsNumber: true })}
                placeholder="0.00"
              />
              {errors.unit_price && (
                <p className="text-sm text-destructive">{errors.unit_price.message}</p>
              )}
            </div>

            {/* Total Price (Read-only) */}
            <div>
              <Label>Total Price</Label>
              <Input
                value={`Rp ${totalPrice.toLocaleString('id-ID')}`}
                readOnly
                className="bg-muted"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Additional notes (optional)"
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit(onFormSubmit)} disabled={loading}>
              {loading ? 'Saving...' : editingItem ? 'Update Item' : 'Add Item'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
