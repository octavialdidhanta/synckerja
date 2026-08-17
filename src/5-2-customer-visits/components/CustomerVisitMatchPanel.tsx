import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import type { CustomerVisitLeadCandidate, CustomerVisitMatchResult } from '../lib/matchCustomerVisitParty';

type Props = {
  searched: boolean;
  invalidQuery: boolean;
  loading?: boolean;
  result: CustomerVisitMatchResult | null;
  selectedLeadId: string | null;
  alreadyCheckedInLeadIds?: Set<string>;
  onSelectLead: (leadId: string) => void;
  onConfirmMatched: (lead: CustomerVisitLeadCandidate, notes: string) => void;
  onSaveUnmatched: (notes: string) => void;
  recording?: boolean;
};

function LeadCard({
  lead,
  selected,
  onSelect,
}: {
  lead: CustomerVisitLeadCandidate;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const body = (
    <>
      <p className="text-sm font-medium text-gray-900">{lead.client || '—'}</p>
      <p className="mt-0.5 text-xs text-gray-500">{lead.ticket_id}</p>
      <p className="mt-0.5 text-xs text-gray-500">
        {lead.source || '—'}
        {lead.phone_number ? ` · ${lead.phone_number}` : ''}
      </p>
    </>
  );

  if (!onSelect) {
    return (
      <div className="w-full rounded-md border border-brand-blue bg-brand-blue-soft/60 p-3 text-left">
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-md border p-3 text-left ${
        selected ? 'border-brand-blue bg-brand-blue-soft/60' : 'border-gray-200 bg-white'
      }`}
    >
      {body}
    </button>
  );
}

export function CustomerVisitMatchPanel({
  searched,
  invalidQuery,
  loading,
  result,
  selectedLeadId,
  alreadyCheckedInLeadIds,
  onSelectLead,
  onConfirmMatched,
  onSaveUnmatched,
  recording,
}: Props) {
  const { t } = useAppTranslation();
  const [notes, setNotes] = useState('');

  const confirmLead =
    result?.status === 'unique'
      ? result.lead
      : result?.status === 'many'
        ? result.leads.find((lead) => lead.id === selectedLeadId) ?? null
        : null;
  const confirmAlreadyCheckedIn = confirmLead
    ? alreadyCheckedInLeadIds?.has(confirmLead.id) === true
    : false;

  const confirmButtonLabel = confirmAlreadyCheckedIn
    ? t('customerVisits.match.continueCheckout', 'Continue to checkout')
    : t('customerVisits.match.confirm', 'Confirm visit');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-shrink-0 border-b px-4 py-1.5">
        <h3 className="text-sm font-semibold text-gray-900">
          {t('customerVisits.match.title', 'Match result')}
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          {t('customerVisits.match.subtitle', 'Confirm before saving a visit')}
        </p>
      </div>
      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {!searched ? (
          <p className="text-sm text-gray-500">
            {t('customerVisits.match.idle', 'Search a phone number or Instagram username to match a lead.')}
          </p>
        ) : loading ? (
          <p className="text-sm text-gray-500">{t('customerVisits.match.loading', 'Searching leads…')}</p>
        ) : invalidQuery ? (
          <p className="text-sm text-gray-600">
            {t('customerVisits.match.invalid', 'Enter a valid phone number or Instagram username.')}
          </p>
        ) : result?.status === 'none' ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              {t('customerVisits.match.none', 'No matching lead in Leads Management.')}
            </p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('customerVisits.match.notesPlaceholder', 'Optional notes')}
              className="min-h-[72px] text-sm"
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={recording}
              onClick={() => onSaveUnmatched(notes)}
            >
              {t('customerVisits.match.saveUnmatched', 'Save without lead')}
            </Button>
          </div>
        ) : result?.status === 'unique' ? (
          <div className="space-y-3">
            <LeadCard lead={result.lead} selected />
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('customerVisits.match.notesPlaceholder', 'Optional notes')}
              className="min-h-[72px] text-sm"
            />
            <Button
              type="button"
              className="w-full"
              disabled={recording}
              onClick={() => onConfirmMatched(result.lead, notes)}
            >
              {alreadyCheckedInLeadIds?.has(result.lead.id)
                ? t('customerVisits.match.continueCheckout', 'Continue to checkout')
                : t('customerVisits.match.confirm', 'Confirm visit')}
            </Button>
          </div>
        ) : result?.status === 'many' ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              {t('customerVisits.match.many', 'Several leads match. Select one, then confirm.')}
            </p>
            <div className="space-y-2">
              {result.leads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  selected={selectedLeadId === lead.id}
                  onSelect={() => onSelectLead(lead.id)}
                />
              ))}
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('customerVisits.match.notesPlaceholder', 'Optional notes')}
              className="min-h-[72px] text-sm"
            />
            <Button
              type="button"
              className="w-full"
              disabled={recording || !confirmLead}
              onClick={() => confirmLead && onConfirmMatched(confirmLead, notes)}
            >
              {confirmButtonLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
