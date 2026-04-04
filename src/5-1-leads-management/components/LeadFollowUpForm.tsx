import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Badge } from "@/shared/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/components/ui/dropdown-menu";
import { X, User, Clock, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';
import { LeadFollowUpUpdate } from '@/shared/types/leads';
import { computeFollowUpAndPriority } from '../utils/fuPriorityFromUpdates';
interface LeadFollowUpFormProps {
  open: boolean;
  onClose: () => void;
  leadId: string;
  leadTitle: string;
  onUpdateAdded: () => void;
}
export const LeadFollowUpForm = ({
  open,
  onClose,
  leadId,
  leadTitle,
  onUpdateAdded
}: LeadFollowUpFormProps) => {
  const [updateDetails, setUpdateDetails] = useState('');
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updates, setUpdates] = useState<LeadFollowUpUpdate[]>([]);
  const [isEditingUpdate, setIsEditingUpdate] = useState<string | null>(null);
  const [editUpdateDetails, setEditUpdateDetails] = useState('');
  const {
    toast
  } = useToast();

  // WhatsApp/Instagram row: id is 'wa-{conversation_id}' (case-insensitive); follow-ups are stored by conversation_id
  const isWhatsAppLead = leadId.toLowerCase().startsWith('wa-');
  const conversationId = isWhatsAppLead ? leadId.replace(/^wa-/i, '') : null;

  // Fetch updates when dialog opens and re-sync fu_priority from lead_follow_up_updates (fixes stale FU Priority display)
  useEffect(() => {
    if (open && leadId) {
      fetchUpdates();
      syncFollowUpCountAndPriority().then(() => onUpdateAdded());
    }
  }, [open, leadId]);

  const fetchUpdates = async () => {
    try {
      const query = isWhatsAppLead && conversationId
        ? supabase.from('lead_follow_up_updates').select('*').eq('conversation_id', conversationId)
        : supabase.from('lead_follow_up_updates').select('*').eq('lead_id', leadId);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      setUpdates((data || []).map((r: any) => ({ ...r, lead_id: r.lead_id ?? leadId })));
    } catch (error) {
      console.error('Error fetching updates:', error);
    }
  };

  /** Sync followup count and fu_priority from lead_follow_up_updates (percentage-based). For wa- rows update whatsapp_conversations. DB trigger also auto-syncs on insert/update/delete. */
  const syncFollowUpCountAndPriority = async (): Promise<boolean> => {
    try {
      const query = isWhatsAppLead && conversationId
        ? supabase.from('lead_follow_up_updates').select('status').eq('conversation_id', conversationId)
        : supabase.from('lead_follow_up_updates').select('status').eq('lead_id', leadId);
      const { data: allUpdates, error: fetchError } = await query;

      if (fetchError) return false;

      const { followupCount, fuPriority } = computeFollowUpAndPriority(allUpdates ?? []);

      const payload = {
        followup: followupCount,
        fu_priority: fuPriority,
        updated_at: new Date().toISOString(),
      };

      let updateErr: Error | null = null;
      if (isWhatsAppLead && conversationId) {
        const res = await supabase.from('whatsapp_conversations').update(payload).eq('id', conversationId);
        updateErr = res.error ?? null;
      } else {
        const res = await supabase.from('leads').update(payload).eq('id', leadId);
        updateErr = res.error ?? null;
      }
      if (updateErr) {
        console.error('Sync update failed:', updateErr);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Error syncing followup count/priority:', err);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateDetails.trim()) return;
    setIsSubmitting(true);
    try {
      // Get user profile
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      const {
        data: profile
      } = await supabase.from('profiles').select('active_organization_id, full_name').eq('user_id', user.id).single();
      if (!profile?.active_organization_id) {
        throw new Error('No active organization found');
      }
      if (isWhatsAppLead && conversationId) {
        const { data: conv } = await supabase.from('whatsapp_conversations').select('ticket_id').eq('id', conversationId).single();
        const ticketId = conv?.ticket_id;
        let realLeadId: string | null = null;
        if (ticketId) {
          const { data: lead } = await supabase.from('leads').select('id').eq('ticket_id', ticketId).eq('organization_id', profile.active_organization_id).maybeSingle();
          realLeadId = lead?.id ?? null;
        }
        const { error: insertErr } = await supabase.from('lead_follow_up_updates').insert({
          lead_id: realLeadId,
          conversation_id: conversationId,
          update_details: updateDetails,
          status: status || null,
          created_by: user.id,
          created_by_name: profile.full_name || user.email || 'Unknown',
          organization_id: profile.active_organization_id,
        });
        if (insertErr) throw insertErr;
      } else {
        const { error: insertErr } = await supabase.from('lead_follow_up_updates').insert({
          lead_id: leadId,
          update_details: updateDetails,
          status: status || null,
          created_by: user.id,
          created_by_name: profile.full_name || user.email || 'Unknown',
          organization_id: profile.active_organization_id,
        });
        if (insertErr) throw insertErr;
      }
      await syncFollowUpCountAndPriority();
      toast({
        title: "Success",
        description: "Follow-up update added successfully"
      });
      setUpdateDetails('');
      setStatus('');
      fetchUpdates();
      onUpdateAdded();
    } catch (error) {
      console.error('Error adding update:', error);
      toast({
        title: "Error",
        description: "Failed to add follow-up update",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleEditUpdate = (update: LeadFollowUpUpdate) => {
    setIsEditingUpdate(update.id);
    setEditUpdateDetails(update.update_details);
  };
  const handleSaveEdit = async (updateId: string) => {
    if (!editUpdateDetails.trim()) return;
    try {
      const {
        error
      } = await supabase.from('lead_follow_up_updates').update({
        update_details: editUpdateDetails
      }).eq('id', updateId);
      if (error) throw error;
      await syncFollowUpCountAndPriority();
      toast({
        title: "Success",
        description: "Update edited successfully"
      });
      setIsEditingUpdate(null);
      setEditUpdateDetails('');
      fetchUpdates();
      onUpdateAdded();
    } catch (error) {
      console.error('Error editing update:', error);
      toast({
        title: "Error",
        description: "Failed to edit update",
        variant: "destructive"
      });
    }
  };
  const handleDeleteUpdate = async (updateId: string) => {
    if (!confirm('Are you sure you want to delete this update?')) return;
    try {
      const {
        error
      } = await supabase.from('lead_follow_up_updates').delete().eq('id', updateId);
      if (error) throw error;
      await syncFollowUpCountAndPriority();
      toast({
        title: "Success",
        description: "Update deleted successfully"
      });
      fetchUpdates();
      onUpdateAdded();
    } catch (error) {
      console.error('Error deleting update:', error);
      toast({
        title: "Error",
        description: "Failed to delete update",
        variant: "destructive"
      });
    }
  };
  return <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-semibold">Update Follow Up</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{leadTitle}</p>
            </div>
            
          </div>
        </DialogHeader>

        <div className="flex flex-col h-full">
          {/* Add Update Form */}
          <div className="px-6 py-4 border-b bg-slate-50">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                <span className="text-white text-sm font-medium">+</span>
              </div>
              <span className="text-sm font-medium">Add Progress Update</span>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Update Details
                </label>
                <Textarea value={updateDetails} onChange={e => setUpdateDetails(e.target.value)} placeholder="Describe the progress or changes made..." className="min-h-[80px] resize-none" required />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Prospect Status <span className="text-red-500">*</span>
                  </label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select prospect status..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Hot Prospect">Hot Prospect</SelectItem>
                      <SelectItem value="Warm Prospect">Warm Prospect</SelectItem>
                      <SelectItem value="Cold Prospect">Cold Prospect</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button type="submit" disabled={isSubmitting || !updateDetails.trim() || !status} className="mt-6">
                  {isSubmitting ? 'Adding...' : 'Add Update'}
                </Button>
              </div>
            </form>
          </div>

          {/* Update History */}
          <div className="flex-1 px-6 py-4">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">Update History ({updates.length})</span>
            </div>

            <ScrollArea className="h-[300px]">
              {updates.length === 0 ? <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No updates yet.</p>
                  <p className="text-xs mt-1">Initial discussion point created</p>
                </div> : <div className="space-y-4">
                  {updates.map(update => <div key={update.id} className="flex gap-3 pb-4 border-b border-gray-100 last:border-b-0">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-gray-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{update.created_by_name}</span>
                            {update.status && <Badge variant="outline" className="text-xs">
                                {update.status}
                              </Badge>}
                            <span className="text-xs text-gray-500">
                              {format(new Date(update.created_at), 'MMM dd, yyyy, HH:mm')}
                            </span>
                          </div>
                          
                          {/* Three dots dropdown for each update */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <MoreHorizontal className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-32">
                              <DropdownMenuItem onClick={() => handleEditUpdate(update)}>
                                <Edit className="mr-2 h-3 w-3" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteUpdate(update.id)} className="text-red-600 hover:text-red-700">
                                <Trash2 className="mr-2 h-3 w-3" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        
                        {/* Update content - editable if in edit mode */}
                        {isEditingUpdate === update.id ? <div className="space-y-2">
                            <Textarea value={editUpdateDetails} onChange={e => setEditUpdateDetails(e.target.value)} className="min-h-[60px] text-sm" />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleSaveEdit(update.id)} disabled={!editUpdateDetails.trim()}>
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => {
                        setIsEditingUpdate(null);
                        setEditUpdateDetails('');
                      }}>
                                Cancel
                              </Button>
                            </div>
                          </div> : <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {update.update_details}
                          </p>}
                      </div>
                    </div>)}
                </div>}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>;
};
