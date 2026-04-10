import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/features/ui/dialog';
import { Button } from '@/features/ui/button';
import { Badge } from '@/features/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/features/ui/select';
import { X, User, Calendar, BarChart3, Activity, UserCheck, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { NewLead } from '@/types/leads';
import { getLeadStatusDisplayName } from '@/features/5-3-leads-management/leadStatusDisplay';
import { useAvailableEmployees } from '@/features/share/hooks/useAvailableEmployees';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';
import { useIsMobile } from '@/mobile/hooks/use-mobile';
import { cn } from '@/lib/utils';

type LeadWithAssigneeId = NewLead & { assignee_id?: string | null };

interface ViewLeadDialogMobileProps {
  open: boolean;
  onClose: () => void;
  lead: NewLead | null;
  onUpdateLead: (lead: NewLead) => void;
}

export function ViewLeadDialogMobile({
  open,
  onClose,
  lead,
  onUpdateLead,
}: ViewLeadDialogMobileProps) {
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: employees = [] } = useAvailableEmployees();

  if (!lead) return null;

  const ticketId = (lead.ticket_id ?? '').trim();
  const canOpenChat = /^(WA-|IG-|EMAIL-)/i.test(ticketId);

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd MMM yyyy, HH:mm');
    } catch {
      return dateString;
    }
  };

  const getFUPriorityColor = (priority?: string) => {
    const colors: Record<string, string> = {
      High: 'bg-red-100 text-red-700',
      Medium: 'bg-yellow-100 text-yellow-700',
      Low: 'bg-green-100 text-green-700',
    };
    return colors[priority ?? ''] ?? colors.Medium;
  };

  const getStatusColor = (status?: string) => {
    const colors: Record<string, string> = {
      Open: 'bg-red-100 text-red-700',
      'In Progress': 'bg-yellow-100 text-yellow-700',
      Closed: 'bg-green-100 text-green-700',
      Resolve: 'bg-green-100 text-green-700',
    };
    return colors[status ?? ''] ?? colors.Open;
  };

  const getSourceColor = (source?: string) => {
    const colors: Record<string, string> = {
      Email: 'bg-blue-100 text-blue-700',
      Phone: 'bg-purple-100 text-purple-700',
      Chat: 'bg-pink-100 text-pink-700',
      Website: 'bg-green-100 text-green-700',
      WhatsApp: 'bg-emerald-100 text-emerald-700',
      Instagram: 'bg-amber-100 text-amber-700',
    };
    return colors[source ?? ''] ?? colors.Website;
  };

  const currentAssigneeId =
    (lead as LeadWithAssigneeId).assignee_id ??
    employees.find((e) => (e.full_name || e.email) === lead.assignee)?.id ??
    '';

  const handleAssigneeChange = (value: string) => {
    const emp = employees.find((e) => e.id === value);
    const updated: NewLead & { assignee_id?: string | null } = {
      ...lead,
      assignee_id: value || null,
      assignee: emp ? emp.full_name || emp.email || '' : '',
    };
    onUpdateLead(updated);
  };

  const handleOpenChat = () => {
    if (!canOpenChat) return;
    onClose();
    navigate(`/operations/consultant/all/livechat?ticket_id=${encodeURIComponent(ticketId)}`);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          'w-full flex flex-col border bg-background shadow-xl focus:outline-none overflow-hidden',
          isMobile
            ? 'fixed left-0 right-0 top-0 modal-above-safe-area h-screen max-w-none m-0 rounded-none translate-x-0 translate-y-0 p-0 gap-0 border-none'
            : 'fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] max-w-md max-h-[90vh] rounded-lg p-6 gap-4'
        )}
        fullscreenAnimation={isMobile}
      >
        <DialogHeader
          className={cn(
            'flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left',
            isMobile ? 'safe-area-top px-4 pt-4 pb-3' : 'px-6 pt-6 pb-4'
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-semibold truncate">
                {lead.title}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {lead.ticket_id ? `Lead - ${lead.ticket_id}` : t('leadsManagement.page.title', 'Leads')}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className={cn(
          'space-y-2 py-3 flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll',
          isMobile ? 'px-4' : 'px-6'
        )}>
          {/* Section: Assignee / PIC */}
          <section className="rounded-lg border border-border bg-muted/15 overflow-hidden">
            <div className="p-2.5 space-y-1.5">
              <h3 className="text-sm font-medium flex items-center gap-2 text-foreground">
                <UserCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                {t('leadsManagement.filter.assignee', 'PIC')}
              </h3>
              <Select
                value={currentAssigneeId || 'unassigned'}
                onValueChange={(v) => handleAssigneeChange(v === 'unassigned' ? '' : v)}
              >
                <SelectTrigger className="w-full h-10 text-sm bg-background">
                  <SelectValue placeholder={t('leadsManagement.filter.allAssignees', 'Pilih PIC')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">
                    {t('leadsManagement.card.unassigned', 'Tidak ada PIC')}
                  </SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name || emp.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          {/* Section: Open Chat - only when lead has ticket_id from WA/IG/Email */}
          {canOpenChat && (
            <section className="rounded-lg border border-border bg-primary/10 overflow-hidden">
              <div className="p-2.5">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleOpenChat}
                  className="w-full min-w-0 flex items-center justify-center gap-2"
                >
                  <MessageCircle className="h-4 w-4 shrink-0" />
                  {t('leadsManagement.dialog.openChat', 'Buka Chat')}
                </Button>
              </div>
            </section>
          )}

          {/* Section: Basic Information */}
          <section className="rounded-lg border border-border bg-muted/15 overflow-hidden">
            <div className="p-2.5 space-y-2">
              <h3 className="text-sm font-medium flex items-center gap-2 text-foreground">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                {t('leadsManagement.card.basicInfo', 'Informasi dasar')}
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block">Client</label>
                  <p className="font-medium mt-0.5 truncate">{lead.client}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block">Category</label>
                  <p className="font-medium mt-0.5 truncate">{lead.category || '—'}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground block">Created By</label>
                  <p className="font-medium mt-0.5 truncate">{lead.created_by_name || '—'}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Section: Status & Priority */}
          <section className="rounded-lg border border-border bg-muted/15 overflow-hidden">
            <div className="p-2.5 space-y-2">
              <h3 className="text-sm font-medium flex items-center gap-2 text-foreground">
                <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
                Status & Priority
              </h3>
              <div className="flex flex-wrap gap-2">
                <Badge
                  className={`${getStatusColor(lead.lead_status?.name || 'Open')} text-xs font-medium`}
                >
                  {getLeadStatusDisplayName(lead.lead_status?.name || 'Open')}
                </Badge>
                <Badge className={`${getFUPriorityColor(lead.fu_priority ?? undefined)} text-xs font-medium`}>
                  {lead.fu_priority || 'Medium'}
                </Badge>
                <Badge className={`${getSourceColor(lead.source ?? undefined)} text-xs font-medium`}>
                  {lead.source || 'Website'}
                </Badge>
              </div>
            </div>
          </section>

          {/* Section: Follow-up */}
          <section className="rounded-lg border border-border bg-muted/15 overflow-hidden">
            <div className="p-2.5 space-y-1.5">
              <h3 className="text-sm font-medium flex items-center gap-2 text-foreground">
                <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
                Follow-up
              </h3>
              <p className="text-sm text-muted-foreground">{lead.followup ?? 0} follow-ups</p>
            </div>
          </section>

          {/* Section: Timeline */}
          <section className="rounded-lg border border-border bg-muted/15 overflow-hidden">
            <div className="p-2.5 space-y-2">
              <h3 className="text-sm font-medium flex items-center gap-2 text-foreground">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                Timeline
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block">Created</label>
                  <p className="font-medium mt-0.5">{formatDate(lead.created_at)}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block">Updated</label>
                  <p className="font-medium mt-0.5">{formatDate(lead.updated_at)}</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer - modal-android-fullscreen: only on mobile fullscreen */}
        {isMobile && (
          <div className="px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30">
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                {t('common.cancel', 'Batal')}
              </Button>
              <Button type="button" size="sm" onClick={onClose} className="min-w-[120px] flex items-center justify-center gap-1.5">
                {t('leadsManagement.dialog.close', 'Tutup')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
