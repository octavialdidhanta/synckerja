import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { X } from "lucide-react";
import { NewLead } from '@/shared/types/leads';
import { getLeadStatusDisplayName } from '../utils/leadStatusDisplay';
import { supabase } from '@/shared/lib/supabaseClient';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

interface LeadStatus {
  id: string;
  name: string;
  color?: string;
}

interface EditLeadDialogProps {
  open: boolean;
  onClose: () => void;
  lead: NewLead | null;
  onUpdateLead: (lead: NewLead) => void;
}

export const EditLeadDialog = ({
  open,
  onClose,
  lead,
  onUpdateLead
}: EditLeadDialogProps) => {
  const { t } = useAppTranslation();
  const [formData, setFormData] = useState<Partial<NewLead>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leadStatuses, setLeadStatuses] = useState<LeadStatus[]>([]);

  // Fetch lead statuses from database
  useEffect(() => {
    const fetchLeadStatuses = async () => {
      try {
        console.log('🔄 Fetching lead statuses...');
        
        // Get user profile to get organization_id
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('❌ No authenticated user');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('active_organization_id')
          .eq('user_id', user.id)
          .single();

        if (!profile?.active_organization_id) {
          console.error('❌ No active organization found');
          return;
        }

        console.log('👤 User organization:', profile.active_organization_id);

        const { data, error } = await supabase
          .from('lead_statuses')
          .select('id, name, color')
          .eq('is_active', true)
          .eq('organization_id', profile.active_organization_id)
          .order('sort_order');

        if (error) {
          console.error('❌ Error fetching lead statuses:', error);
        } else {
          console.log('✅ Lead statuses fetched:', data);
          setLeadStatuses(data || []);
        }
      } catch (err) {
        console.error('❌ Exception in fetchLeadStatuses:', err);
      }
    };

    if (open) {
      fetchLeadStatuses();
    }
  }, [open]);

  useEffect(() => {
    if (lead) {
      setFormData({
        client: lead.client,
        title: lead.title,
        category: lead.category,
        assignee: lead.assignee,
        fu_priority: lead.fu_priority,
        status_id: lead.status_id || undefined, // Use status_id instead of status
        source: lead.source
      });
    }
  }, [lead]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;

    const newStatus = leadStatuses.find((s) => s.id === formData.status_id);
    if (newStatus?.name?.trim().toLowerCase() === 'closed') {
      const confirmed = window.confirm(t('leadsManagement.confirmResolve', 'Yakin ingin mengubah status menjadi Resolve? Chat outbound akan diblokir sampai ada pesan masuk baru dari customer.'));
      if (!confirmed) return;
    }
    
    setIsSubmitting(true);
    try {
      const updatedLead = {
        ...lead,
        ...formData
      } as NewLead;
      
      await onUpdateLead(updatedLead);
      onClose();
    } catch (error) {
      console.error('Error updating lead:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({ 
      ...prev, 
      [field]: value,
      // If updating status_id, also update the lead_status for display
      ...(field === 'status_id' && {
        lead_status: leadStatuses.find(s => s.id === value) || prev.lead_status
      })
    }));
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader className="flex items-center justify-between">
          <DialogTitle className="text-lg font-semibold">Edit Lead</DialogTitle>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Client Name
            </label>
            <Input
              value={formData.client || ''}
              onChange={(e) => handleFieldChange('client', e.target.value)}
              placeholder="Enter client name"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Title
            </label>
            <Input
              value={formData.title || ''}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              placeholder="Enter title"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Category
            </label>
            <Input
              value={formData.category || ''}
              onChange={(e) => handleFieldChange('category', e.target.value)}
              placeholder="Enter category"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Assignee
            </label>
            <Select
              value={formData.assignee || ''}
              onValueChange={(value) => handleFieldChange('assignee', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADEL">ADEL</SelectItem>
                <SelectItem value="INDRI">INDRI</SelectItem>
                <SelectItem value="NADA">NADA</SelectItem>
                <SelectItem value="RYAN">RYAN</SelectItem>
                <SelectItem value="SINTA">SINTA</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              FU Priority
            </label>
            <Select
              value={formData.fu_priority || ''}
              onValueChange={(value) => handleFieldChange('fu_priority', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Status
            </label>
            <Select
              value={formData.status_id || ''}
              onValueChange={(value) => handleFieldChange('status_id', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {leadStatuses.map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {getLeadStatusDisplayName(status.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Source
            </label>
            <Select
              value={formData.source || ''}
              onValueChange={(value) => handleFieldChange('source', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Email">Email</SelectItem>
                <SelectItem value="Phone">Phone</SelectItem>
                <SelectItem value="Chat">Chat</SelectItem>
                <SelectItem value="Website">Website</SelectItem>
                <SelectItem value="WhatsApp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? 'Updating...' : 'Update Lead'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
