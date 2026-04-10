import React from 'react';
import { Users } from 'lucide-react';
import { NewLead } from '@/types/leads';
import { LeadCard } from './components/LeadCard';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';

interface LeadsCardListProps {
  leads: NewLead[];
  onLeadPress: (lead: NewLead) => void;
  onUpdateLead: (lead: NewLead) => void;
  onDeleteLead: (leadId: string) => void;
}

export function LeadsCardList({ leads, onLeadPress }: LeadsCardListProps) {
  const { t } = useAppTranslation();

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <Users className="h-12 w-12 text-muted-foreground/50 mb-3" aria-hidden />
        <p className="text-sm font-medium text-foreground">
          {t('leadsManagement.emptyTitle', 'No leads')}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {t('leadsManagement.emptyDescription', 'Change filters or wait for new leads.')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {leads.map((lead) => (
        <LeadCard key={lead.id} lead={lead} onPress={onLeadPress} />
      ))}
    </div>
  );
}
