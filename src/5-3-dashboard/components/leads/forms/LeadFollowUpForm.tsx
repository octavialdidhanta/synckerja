import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Badge } from "@/shared/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/components/ui/dropdown-menu";
import { X, User, Clock, MoreHorizontal, Edit, Trash2, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { computeFollowUpAndPriority } from '@/5-1-leads-management/utils/fuPriorityFromUpdates';
import { renderTemplateBodyPreview } from '@/5-3-dashboard/utils/renderTemplateBodyPreview';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

interface LeadFollowUpFormProps {
  open: boolean;
  onClose: () => void;
  leadId: string;
  leadTitle: string;
  onUpdateAdded: () => void;
}

type ManualFollowUpRow = {
  id: string;
  kind: 'manual';
  created_at: string;
  created_by_name: string;
  status?: string | null;
  update_details: string;
  beforeReset: boolean;
};

type TemplateFollowUpRow = {
  id: string;
  kind: 'template';
  created_at: string;
  created_by_name: string;
  template_name: string;
  preview: string;
};

type HistoryEntry = ManualFollowUpRow | TemplateFollowUpRow;

type CycleState = {
  template_followup_awaiting_reply: boolean;
  follow_up_cycle_reset_at: string | null;
  fu_priority: string | null;
};

export const LeadFollowUpForm = ({
  open,
  onClose,
  leadId,
  leadTitle,
  onUpdateAdded
}: LeadFollowUpFormProps) => {
  const { t } = useAppTranslation();
  const [updateDetails, setUpdateDetails] = useState('');
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [cycleState, setCycleState] = useState<CycleState | null>(null);
  const [resolvedRealLeadId, setResolvedRealLeadId] = useState<string | null>(null);
  const [isEditingUpdate, setIsEditingUpdate] = useState<string | null>(null);
  const [editUpdateDetails, setEditUpdateDetails] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();

  const isWhatsAppLead = leadId.startsWith('wa-');
  const conversationId = isWhatsAppLead ? leadId.replace(/^wa-/, '') : null;

  const loadCycleState = async (): Promise<CycleState | null> => {
    try {
      if (isWhatsAppLead && conversationId) {
        const { data, error } = await supabase
          .from('whatsapp_conversations')
          .select('template_followup_awaiting_reply, follow_up_cycle_reset_at, fu_priority')
          .eq('id', conversationId)
          .maybeSingle();
        if (error) throw error;
        return data
          ? {
              template_followup_awaiting_reply: Boolean(data.template_followup_awaiting_reply),
              follow_up_cycle_reset_at: data.follow_up_cycle_reset_at ?? null,
              fu_priority: data.fu_priority ?? null,
            }
          : null;
      }
      const { data, error } = await supabase
        .from('leads')
        .select('template_followup_awaiting_reply, follow_up_cycle_reset_at, fu_priority')
        .eq('id', leadId)
        .maybeSingle();
      if (error) throw error;
      return data
        ? {
            template_followup_awaiting_reply: Boolean(data.template_followup_awaiting_reply),
            follow_up_cycle_reset_at: data.follow_up_cycle_reset_at ?? null,
            fu_priority: data.fu_priority ?? null,
          }
        : null;
    } catch (e) {
      console.error('loadCycleState:', e);
      return null;
    }
  };

  const resolveRealLeadId = async (): Promise<string | null> => {
    if (!isWhatsAppLead) return leadId;
    if (!conversationId || !organizationId) return null;
    const { data: conv } = await supabase
      .from('whatsapp_conversations')
      .select('ticket_id')
      .eq('id', conversationId)
      .maybeSingle();
    const ticketId = conv?.ticket_id;
    if (!ticketId) return null;
    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .eq('ticket_id', ticketId)
      .eq('organization_id', organizationId)
      .maybeSingle();
    return lead?.id ?? null;
  };

  const fetchHistory = async (resetAt: string | null, realLeadId: string | null) => {
    const resetMs = resetAt ? new Date(resetAt).getTime() : NaN;

    let manualRows: ManualFollowUpRow[] = [];
    if (isWhatsAppLead && conversationId) {
      const { data, error } = await supabase
        .from('lead_follow_up_updates')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      manualRows = (data ?? []).map((r) => ({
        id: r.id,
        kind: 'manual' as const,
        created_at: r.created_at,
        created_by_name: r.created_by_name,
        status: r.status,
        update_details: r.update_details,
        beforeReset: !Number.isNaN(resetMs) && new Date(r.created_at).getTime() <= resetMs,
      }));
    } else {
      const { data, error } = await supabase
        .from('lead_follow_up_updates')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      manualRows = (data ?? []).map((r) => ({
        id: r.id,
        kind: 'manual' as const,
        created_at: r.created_at,
        created_by_name: r.created_by_name,
        status: r.status,
        update_details: r.update_details,
        beforeReset: !Number.isNaN(resetMs) && new Date(r.created_at).getTime() <= resetMs,
      }));
    }

    let templateQuery = supabase
      .from('whatsapp_template_followups')
      .select('id, created_at, template_name, parameter_values, template_components_json, sent_by')
      .eq('send_status', 'sent')
      .order('created_at', { ascending: false });

    if (conversationId) {
      templateQuery = templateQuery.eq('whatsapp_conversation_id', conversationId);
    } else if (realLeadId) {
      templateQuery = templateQuery.eq('lead_id', realLeadId);
    } else {
      templateQuery = templateQuery.eq('lead_id', leadId);
    }

    const { data: templateRows, error: templateErr } = await templateQuery;
    if (templateErr) throw templateErr;

    const senderIds = [...new Set((templateRows ?? []).map((r) => r.sent_by).filter(Boolean))] as string[];
    const senderNameMap = new Map<string, string>();
    if (senderIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', senderIds);
      (profiles ?? []).forEach((p) => {
        senderNameMap.set(p.user_id, p.full_name || p.email || 'Agent');
      });
    }

    const templateEntries: TemplateFollowUpRow[] = (templateRows ?? []).map((r) => ({
      id: r.id,
      kind: 'template' as const,
      created_at: r.created_at,
      created_by_name: senderNameMap.get(r.sent_by) ?? 'Agent',
      template_name: r.template_name,
      preview: renderTemplateBodyPreview(
        r.template_name,
        r.template_components_json as unknown[],
        r.parameter_values,
      ),
    }));

    const merged = [...manualRows, ...templateEntries].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    setHistory(merged);
  };

  const syncFollowUpCountAndPriority = async (cycle: CycleState | null) => {
    if (!cycle) return;
    if (cycle.template_followup_awaiting_reply) return;
    if (cycle.fu_priority === 'Set Status') {
      const resetAt = cycle.follow_up_cycle_reset_at;
      const statusQuery =
        isWhatsAppLead && conversationId
          ? supabase.from('lead_follow_up_updates').select('status, created_at').eq('conversation_id', conversationId)
          : supabase.from('lead_follow_up_updates').select('status, created_at').eq('lead_id', leadId);
      const { data: allUpdates } = await statusQuery;
      const scoped = computeFollowUpAndPriority(allUpdates ?? [], resetAt);
      if (scoped.followupCount === 0) return;
    }

    try {
      const statusQuery =
        isWhatsAppLead && conversationId
          ? supabase.from('lead_follow_up_updates').select('status, created_at').eq('conversation_id', conversationId)
          : supabase.from('lead_follow_up_updates').select('status, created_at').eq('lead_id', leadId);
      const { data: allUpdates, error: fetchError } = await statusQuery;
      if (fetchError) return;

      const { followupCount, fuPriority } = computeFollowUpAndPriority(
        allUpdates ?? [],
        cycle.follow_up_cycle_reset_at,
      );

      const updateData = {
        followup: followupCount,
        fu_priority: fuPriority ?? null,
        updated_at: new Date().toISOString(),
      };

      if (isWhatsAppLead && conversationId) {
        await supabase.from('whatsapp_conversations').update(updateData).eq('id', conversationId);
      } else {
        await supabase.from('leads').update(updateData).eq('id', leadId);
      }
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: ['leads', organizationId] });
      }
    } catch (error) {
      console.error('Error in syncFollowUpCountAndPriority:', error);
    }
  };

  useEffect(() => {
    if (!open || !leadId) return;
    const initializeData = async () => {
      const realId = await resolveRealLeadId();
      setResolvedRealLeadId(realId);
      const cycle = await loadCycleState();
      setCycleState(cycle);
      await fetchHistory(cycle?.follow_up_cycle_reset_at ?? null, realId);
      await syncFollowUpCountAndPriority(cycle);
    };
    void initializeData();
  }, [open, leadId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateDetails.trim()) return;
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      const { data: profile } = await supabase
        .from('profiles')
        .select('active_organization_id, full_name')
        .eq('user_id', user.id)
        .single();
      if (!profile?.active_organization_id) throw new Error('No active organization found');

      if (isWhatsAppLead && conversationId && organizationId) {
        const realLeadId = resolvedRealLeadId ?? (await resolveRealLeadId());
        if (!realLeadId) throw new Error('Lead not found for this conversation');
        const { error: insertError } = await supabase.from('lead_follow_up_updates').insert({
          lead_id: realLeadId,
          conversation_id: conversationId,
          update_details: updateDetails,
          status: status || null,
          created_by: user.id,
          created_by_name: profile.full_name || user.email || 'Unknown',
          organization_id: profile.active_organization_id,
        });
        if (insertError) throw insertError;
      } else {
        const { error: insertError } = await supabase.from('lead_follow_up_updates').insert({
          lead_id: leadId,
          update_details: updateDetails,
          status: status || null,
          created_by: user.id,
          created_by_name: profile.full_name || user.email || 'Unknown',
          organization_id: profile.active_organization_id,
        });
        if (insertError) throw insertError;
      }

      const cycle = await loadCycleState();
      setCycleState(cycle);
      await syncFollowUpCountAndPriority(cycle);
      await new Promise((resolve) => setTimeout(resolve, 100));

      toast({ title: 'Success', description: 'Follow-up update added successfully' });
      setUpdateDetails('');
      setStatus('');
      await fetchHistory(cycle?.follow_up_cycle_reset_at ?? null, resolvedRealLeadId);
      onUpdateAdded();
    } catch (error) {
      console.error('Error adding update:', error);
      toast({ title: 'Error', description: 'Failed to add follow-up update', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUpdate = (update: ManualFollowUpRow) => {
    setIsEditingUpdate(update.id);
    setEditUpdateDetails(update.update_details);
  };

  const handleSaveEdit = async (updateId: string) => {
    if (!editUpdateDetails.trim()) return;
    try {
      const { error } = await supabase
        .from('lead_follow_up_updates')
        .update({ update_details: editUpdateDetails })
        .eq('id', updateId);
      if (error) throw error;
      const cycle = await loadCycleState();
      await syncFollowUpCountAndPriority(cycle);
      toast({ title: 'Success', description: 'Update edited successfully' });
      setIsEditingUpdate(null);
      setEditUpdateDetails('');
      await fetchHistory(cycle?.follow_up_cycle_reset_at ?? null, resolvedRealLeadId);
      onUpdateAdded();
    } catch (error) {
      console.error('Error editing update:', error);
      toast({ title: 'Error', description: 'Failed to edit update', variant: 'destructive' });
    }
  };

  const handleDeleteUpdate = async (updateId: string) => {
    if (!confirm('Are you sure you want to delete this update?')) return;
    try {
      const { error } = await supabase.from('lead_follow_up_updates').delete().eq('id', updateId);
      if (error) throw error;
      const cycle = await loadCycleState();
      await syncFollowUpCountAndPriority(cycle);
      await new Promise((resolve) => setTimeout(resolve, 100));
      toast({ title: 'Success', description: 'Update deleted successfully' });
      await fetchHistory(cycle?.follow_up_cycle_reset_at ?? null, resolvedRealLeadId);
      onUpdateAdded();
    } catch (error) {
      console.error('Error deleting update:', error);
      toast({ title: 'Error', description: 'Failed to delete update', variant: 'destructive' });
    }
  };

  const historyCountLabel = useMemo(() => history.length, [history.length]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div>
            <DialogTitle className="text-lg font-semibold">Update Follow Up</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">{leadTitle}</p>
          </div>
        </DialogHeader>

        <div className="flex flex-col h-full">
          <div className="px-6 py-4 border-b bg-slate-50">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                <span className="text-white text-sm font-medium">+</span>
              </div>
              <span className="text-sm font-medium">Add Progress Update</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Update Details</label>
                <Textarea
                  value={updateDetails}
                  onChange={(e) => setUpdateDetails(e.target.value)}
                  placeholder="Describe the progress or changes made..."
                  className="min-h-[80px] resize-none"
                  required
                />
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

          <div className="flex-1 px-6 py-4">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">
                {t('leadsManagement.followUpHistory.title', 'Update History')} ({historyCountLabel})
              </span>
            </div>

            <ScrollArea className="h-[300px]">
              {history.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No updates yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {history.map((entry) =>
                    entry.kind === 'template' ? (
                      <div
                        key={entry.id}
                        className="flex gap-3 pb-4 border-b border-gray-100 last:border-b-0 opacity-95"
                      >
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <MessageSquare className="h-4 w-4 text-emerald-700" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-medium">{entry.created_by_name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {t('leadsManagement.followUpHistory.templateSend', 'Template follow-up')}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {format(new Date(entry.created_at), 'MMM dd, yyyy, HH:mm')}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-gray-600 mb-1">{entry.template_name}</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{entry.preview}</p>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={entry.id}
                        className={`flex gap-3 pb-4 border-b border-gray-100 last:border-b-0 ${entry.beforeReset ? 'opacity-60' : ''}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-gray-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{entry.created_by_name}</span>
                              {entry.status && (
                                <Badge variant="outline" className="text-xs">
                                  {entry.status}
                                </Badge>
                              )}
                              {entry.beforeReset && (
                                <Badge variant="outline" className="text-xs text-muted-foreground">
                                  {t('leadsManagement.followUpHistory.beforeReset', 'Before reset')}
                                </Badge>
                              )}
                              <span className="text-xs text-gray-500">
                                {format(new Date(entry.created_at), 'MMM dd, yyyy, HH:mm')}
                              </span>
                            </div>
                            {!entry.beforeReset && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    <MoreHorizontal className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-32">
                                  <DropdownMenuItem onClick={() => handleEditUpdate(entry)}>
                                    <Edit className="mr-2 h-3 w-3" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteUpdate(entry.id)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="mr-2 h-3 w-3" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                          {isEditingUpdate === entry.id ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editUpdateDetails}
                                onChange={(e) => setEditUpdateDetails(e.target.value)}
                                className="min-h-[60px] text-sm"
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveEdit(entry.id)}
                                  disabled={!editUpdateDetails.trim()}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setIsEditingUpdate(null);
                                    setEditUpdateDetails('');
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{entry.update_details}</p>
                          )}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
