import React from 'react';
import { format } from 'date-fns';
import { Globe, User, Calendar, Briefcase, Flag } from 'lucide-react';
import { NewLead } from '@/types/leads';
import { getLeadStatusDisplayName } from '@/features/5-3-leads-management/leadStatusDisplay';
import { isResolvedStatus } from '@/features/5-3-whatsapp/constants/leadStatus';
import { Badge } from '@/features/ui/badge';
import { Card, CardContent } from '@/features/ui/card';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';

interface LeadCardProps {
  lead: NewLead;
  onPress: (lead: NewLead) => void;
}

const ICON_CLASS = 'h-3.5 w-3.5 text-muted-foreground shrink-0';

export function LeadCard({ lead, onPress }: LeadCardProps) {
  const { t } = useAppTranslation();
  const statusName = lead.lead_status?.name ?? 'Open';
  const displayStatus = getLeadStatusDisplayName(statusName);
  // Resolve/Closed always green; otherwise use color from API
  const statusColor = isResolvedStatus(statusName) ? undefined : (lead.lead_status?.color ?? undefined);
  const resolvedGreenClass = isResolvedStatus(statusName) ? 'bg-green-100 text-green-700 border-green-200' : '';

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd MMM yyyy');
    } catch {
      return dateString;
    }
  };

  const hasService = lead.services && lead.services.trim() !== '';
  const hasSource = lead.source && lead.source.trim() !== '';
  const hasAssignee = lead.assignee && lead.assignee.trim() !== '';
  const displayFuPriority = lead.followup === 0 ? 'Please Follow Up' : (lead.fu_priority || 'Medium');

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-muted/50 active:bg-muted border-border shadow-sm"
      onClick={() => onPress(lead)}
    >
      <CardContent className="p-3">
        {/* Baris 1: Client + Status */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground truncate flex-1 min-w-0">
            {lead.client || t('leadsManagement.unknownClient', 'Unknown client')}
          </h3>
          <Badge
            className={`shrink-0 text-xs font-medium ${resolvedGreenClass}`}
            style={statusColor ? { backgroundColor: `${statusColor}20`, color: statusColor, borderColor: statusColor } : undefined}
            variant={statusColor || resolvedGreenClass ? undefined : 'secondary'}
          >
            {displayStatus}
          </Badge>
        </div>

        {/* Baris 2: Judul lead */}
        {(lead.title ?? '').trim() !== '' && (
          <p className="text-xs text-muted-foreground truncate mt-1" title={lead.title ?? undefined}>
            {lead.title}
          </p>
        )}

        {/* Baris 3: Layanan (jika ada) */}
        {hasService && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <Briefcase className={ICON_CLASS} aria-hidden />
            <span className="font-medium text-foreground/80">{t('leadsManagement.filter.service', 'Layanan')}:</span>
            <span className="truncate" title={lead.services ?? undefined}>{lead.services}</span>
          </div>
        )}

        {/* Baris 4: Sumber, PIC, FU Priority, Tanggal — dengan label jelas */}
        <div className="mt-2 space-y-1.5">
          {hasSource && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
              <Globe className={ICON_CLASS} aria-hidden />
              <span className="shrink-0 font-medium text-foreground/70">{t('leadsManagement.filter.source', 'Sumber')}:</span>
              <span className="truncate" title={lead.source ?? undefined}>{lead.source}</span>
            </div>
          )}
          {hasAssignee && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
              <User className={ICON_CLASS} aria-hidden />
              <span className="shrink-0 font-medium text-foreground/70">{t('leadsManagement.filter.assignee', 'PIC')}:</span>
              <span className="truncate" title={lead.assignee}>{lead.assignee}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Flag className={ICON_CLASS} aria-hidden />
            <span className="shrink-0 font-medium text-foreground/70">{t('leadsManagement.card.fuPriority', 'FU Priority')}:</span>
            <span>{displayFuPriority}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className={ICON_CLASS} aria-hidden />
            <span className="shrink-0 font-medium text-foreground/70">{t('leadsManagement.card.date', 'Tanggal')}:</span>
            <span>{formatDate(lead.created_at)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
