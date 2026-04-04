import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { CreateLeadData } from '@/shared/types/leads';
import { SourceManagementDialog } from "@/5-3-dashboard/components/leads/dialogs/SourceManagementDialog";
import { ServicesManagementDialog } from "@/5-3-dashboard/components/leads/dialogs/ServicesManagementDialog";
import { CategoriesManagementDialog } from "@/5-3-dashboard/components/leads/dialogs/CategoriesManagementDialog";
import { useLeadSources } from '@/shared/hooks/organized/salesources';
import { useAvailableEmployees } from '@/shared/hooks/useAvailableEmployees';
import { useToast } from '@/shared/components/ui/use-toast';
import { MoreVertical } from 'lucide-react';
import { supabase } from '@/shared/lib/supabaseClient';

interface NewLeadFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (leadData: CreateLeadData) => Promise<void>;
  isSubmitting?: boolean;
}

interface Service {
  id: string;
  name: string;
}

interface SubService {
  id: string;
  name: string;
  service_id: string;
}

interface LeadStatus {
  id: string;
  name: string;
  color: string;
}

export const NewLeadForm = ({ open, onClose, onSubmit, isSubmitting = false }: NewLeadFormProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<CreateLeadData>({
    client: '',
    title: '',
    services: '',
    category: '',
    assignee: '',
    fu_priority: 'Please Follow Up',
    status_id: '', // Initialize as empty string instead of undefined
    source: 'Website',
  });
  
  const [isSourceDialogOpen, setIsSourceDialogOpen] = useState(false);
  const [isServicesDialogOpen, setIsServicesDialogOpen] = useState(false);
  const [isCategoriesDialogOpen, setIsCategoriesDialogOpen] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [subServices, setSubServices] = useState<SubService[]>([]);
  const [leadStatuses, setLeadStatuses] = useState<LeadStatus[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const { sources, refetch } = useLeadSources();
  const { data: employees = [] } = useAvailableEmployees();

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (!error && data) {
        setServices(data);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const fetchSubServices = async () => {
    try {
      const { data, error } = await supabase
        .from('sub_services')
        .select('id, name, service_id')
        .eq('is_active', true)
        .order('name');

      if (!error && data) {
        setSubServices(data);
      }
    } catch (error) {
      console.error('Error fetching sub services:', error);
    }
  };

  const fetchLeadStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from('lead_statuses')
        .select('id, name, color')
        .eq('is_active', true)
        .order('sort_order');

      if (!error && data) {
        setLeadStatuses(data);
        // Set default status to first available status (usually "Open")
        if (data.length > 0) {
          const defaultStatus = data.find(status => status.name === 'Open') || data[0];
          setFormData(prev => ({ 
            ...prev, 
            status_id: prev.status_id || defaultStatus.id 
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching lead statuses:', error);
    }
  };

  const handleInputChange = (field: keyof CreateLeadData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // If services field changes, clear category and update selectedServiceId
    if (field === 'services') {
      const service = services.find(s => s.name === value);
      setSelectedServiceId(service?.id || '');
      setFormData(prev => ({ ...prev, category: '' }));
    }
  };

  const filteredSubServices = selectedServiceId 
    ? subServices.filter(sub => sub.service_id === selectedServiceId)
    : [];

  useEffect(() => {
    if (open) {
      fetchServices();
      fetchSubServices();
      fetchLeadStatuses();
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.assignee?.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validasi',
        description: 'Assignee wajib diisi.',
      });
      return;
    }
    try {
      await onSubmit(formData);
      // Reset form on successful submission
      const defaultStatus = leadStatuses.find(status => status.name === 'Open') || leadStatuses[0];
      setFormData({
        client: '',
        title: '',
        services: '',
        category: '',
        assignee: '',
        fu_priority: 'Please Follow Up',
        status_id: defaultStatus?.id || '',
        source: 'Website',
      });
      onClose();
    } catch (error) {
      // Error is handled in the hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">New Lead</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client */}
          <div className="space-y-1.5">
            <Label htmlFor="client" className="text-sm font-medium">Client *</Label>
            <Input
              id="client"
              value={formData.client}
              onChange={(e) => handleInputChange('client', e.target.value)}
              placeholder="Enter client name"
              required
              className="h-9"
            />
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-sm font-medium">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Enter lead title"
              required
              className="h-9"
            />
          </div>

          {/* Services */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="services" className="text-sm font-medium">Services</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsServicesDialogOpen(true)}
                className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </div>
            <Select value={formData.services} onValueChange={(value) => handleInputChange('services', value)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select services" />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.name}>
                    {service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="category" className="text-sm font-medium">Category *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsCategoriesDialogOpen(true)}
                className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
                disabled={!formData.services}
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </div>
            <Select 
              value={formData.category} 
              onValueChange={(value) => handleInputChange('category', value)}
              disabled={!formData.services}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder={formData.services ? "Select category" : "Select services first"} />
              </SelectTrigger>
              <SelectContent>
                {filteredSubServices.map((subService) => (
                  <SelectItem key={subService.id} value={subService.name}>
                    {subService.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assignee - from employees table */}
          <div className="space-y-1.5">
            <Label htmlFor="assignee" className="text-sm font-medium">Assignee *</Label>
            <Select value={formData.assignee || ''} onValueChange={(value) => handleInputChange('assignee', value)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select assignee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.full_name || emp.email}>
                    {emp.full_name || emp.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label htmlFor="status" className="text-sm font-medium">Status *</Label>
            <Select value={formData.status_id || ''} onValueChange={(value) => handleInputChange('status_id', value)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select status">
                  {leadStatuses.find(status => status.id === formData.status_id)?.name || 'Select status'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {leadStatuses.filter((s) => s.name?.trim().toLowerCase() !== 'lost').map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Source field only */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="source" className="text-xs text-muted-foreground">Source</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsSourceDialogOpen(true)}
                className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </div>
            <Select value={formData.source} onValueChange={(value: any) => handleInputChange('source', value)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sources.map((source) => (
                  <SelectItem key={source.id} value={source.name}>
                    {source.name}
                  </SelectItem>
                ))}
                {sources.length === 0 && (
                  <>
                    <SelectItem value="Email">Email</SelectItem>
                    <SelectItem value="Phone">Phone</SelectItem>
                    <SelectItem value="Chat">Chat</SelectItem>
                    <SelectItem value="Website">Website</SelectItem>
                    <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              disabled={isSubmitting}
              className="h-9 px-4"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="h-9 px-4"
            >
              {isSubmitting ? 'Creating...' : 'Create Lead'}
            </Button>
          </div>
        </form>
      </DialogContent>
      
      {/* Source Management Dialog */}
      <SourceManagementDialog
        open={isSourceDialogOpen}
        onClose={() => setIsSourceDialogOpen(false)}
        onSourceSelect={(source) => handleInputChange('source', source)}
        onSourceAdded={() => refetch()}
      />

      {/* Services Management Dialog */}
      <ServicesManagementDialog
        open={isServicesDialogOpen}
        onClose={() => setIsServicesDialogOpen(false)}
        onServiceSelect={(service) => handleInputChange('services', service)}
        onServicesChanged={() => {
          fetchServices();
          fetchSubServices();
        }}
      />

      {/* Categories Management Dialog */}
      <CategoriesManagementDialog
        open={isCategoriesDialogOpen}
        onClose={() => setIsCategoriesDialogOpen(false)}
        selectedServiceId={selectedServiceId}
        onCategorySelect={(category) => handleInputChange('category', category)}
        onCategoriesChanged={() => fetchSubServices()}
      />
    </Dialog>
  );
};