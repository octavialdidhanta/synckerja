import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import {
  useCrmSlaForConversation,
  type LivechatCrmSlaSnapshot,
} from '@/5-3-whatsapp/hooks/useCrmSlaForConversation';
import type { LiveChatConversation } from '../../types';

function formatRemainingMs(ms: number): { label: string; overdue: boolean } {
  if (ms <= 0) return { label: '', overdue: true };
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return {
      label: `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      overdue: false,
    };
  }
  return { label: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`, overdue: false };
}

function formatSlaStatusLabel(
  status: string | null | undefined,
  lateMinutes: number | null | undefined,
  t: ReturnType<typeof useAppTranslation>['t'],
): string {
  const s = (status ?? '').trim().toLowerCase();
  if (s === 'on_time') return t('whatsappInbox.slaStatusOnTime', 'On time');
  if (s === 'late') {
    const mins = lateMinutes != null && lateMinutes > 0 ? lateMinutes : null;
    return mins != null
      ? t('whatsappInbox.slaStatusLateMinutes', 'Late ({{minutes}} min)', { minutes: mins })
      : t('whatsappInbox.slaStatusLate', 'Late');
  }
  if (s === 'pending') return t('whatsappInbox.slaStatusPending', 'Pending');
  return '—';
}

function renderDueCountdown(
  phaseLabel: string,
  dueIso: string,
  nowMs: number,
  dateFnsLocale: Locale,
  t: ReturnType<typeof useAppTranslation>['t'],
) {
  const due = new Date(dueIso);
  const dueMs = due.getTime();
  if (Number.isNaN(dueMs)) return null;
  const dueStr = format(due, 'PPp', { locale: dateFnsLocale });
  const remaining = dueMs - nowMs;
  const { label, overdue } = formatRemainingMs(remaining);

  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-gray-700">{phaseLabel}</p>
      <p className="text-xs text-gray-500">{t('whatsappInbox.slaDueLine', 'Due {{datetime}}', { datetime: dueStr })}</p>
      {overdue ? (
        <p className="text-xs font-mono font-semibold tabular-nums text-red-600">
          {t('whatsappInbox.slaOverdue', 'Overdue')}
        </p>
      ) : (
        <p className="text-xs font-mono font-semibold tabular-nums text-gray-900">
          {t('whatsappInbox.slaRemainingLine', 'Remaining {{time}}', { time: label })}
        </p>
      )}
    </div>
  );
}

function renderResolvedSlaSummary(sla: LivechatCrmSlaSnapshot, t: ReturnType<typeof useAppTranslation>['t']) {
  const firstLabel = formatSlaStatusLabel(sla.sla_first_reply_status, sla.sla_first_reply_late_minutes, t);
  const resLabel = formatSlaStatusLabel(sla.sla_resolution_status, sla.sla_resolution_late_minutes, t);

  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-medium text-gray-700">
          {t('whatsappInbox.slaPhaseFirstReply', 'First reply')}
        </p>
        <p className="text-xs text-gray-600">{firstLabel}</p>
      </div>
      {sla.first_response_at ? (
        <div>
          <p className="text-xs font-medium text-gray-700">
            {t('whatsappInbox.slaPhaseResolution', 'Resolution')}
          </p>
          <p className="text-xs text-gray-600">{resLabel}</p>
        </div>
      ) : null}
    </div>
  );
}

type LivechatSlaTargetPanelProps = {
  organizationId: string | null | undefined;
  conversation: LiveChatConversation;
  /** True when lead status is Resolved/Closed — show summary, not live countdown. */
  leadResolved: boolean;
};

export function LivechatSlaTargetPanel({ organizationId, conversation, leadResolved }: LivechatSlaTargetPanelProps) {
  const { t, dateFnsLocale } = useAppTranslation();
  const { data: sla, isPending, isError } = useCrmSlaForConversation(
    organizationId,
    conversation.id,
    conversation.source,
  );

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [conversation.id, organizationId]);

  const nowMs = Date.now();

  const wrap = (inner: React.ReactNode) => (
    <div className="border-t border-gray-100 px-3 pb-2 pt-2">{inner}</div>
  );

  if (isPending) {
    return wrap(<p className="text-xs text-gray-400">…</p>);
  }

  if (isError) {
    return wrap(<p className="text-xs text-red-600">{t('whatsappInbox.slaLoadError', 'Could not load SLA.')}</p>);
  }

  if (!sla) {
    return wrap(
      <p className="text-xs text-gray-500">
        {t(
          'whatsappInbox.slaNoCycle',
          'No active conversation cycle for SLA tracking yet.',
        )}
      </p>,
    );
  }

  if (leadResolved) {
    return wrap(renderResolvedSlaSummary(sla, t));
  }

  const firstReplyPhase = t('whatsappInbox.slaPhaseFirstReply', 'First reply');
  const resolutionPhase = t('whatsappInbox.slaPhaseResolution', 'Resolution');

  if (sla.first_response_at && !sla.resolved_at && sla.resolution_due_at) {
    const block = renderDueCountdown(resolutionPhase, sla.resolution_due_at, nowMs, dateFnsLocale, t);
    if (block) return wrap(block);
  }

  if (!sla.first_response_at && sla.assignment_due_at) {
    const block = renderDueCountdown(firstReplyPhase, sla.assignment_due_at, nowMs, dateFnsLocale, t);
    if (block) return wrap(block);
  }

  if (!sla.first_response_at && !sla.assignment_due_at) {
    return wrap(
      <p className="text-xs text-gray-500">
        {t(
          'whatsappInbox.slaAwaitAssignee',
          'SLA first reply starts after an assignee is set for this conversation cycle.',
        )}
      </p>,
    );
  }

  if (sla.first_response_at && !sla.resolution_due_at) {
    return wrap(
      <p className="text-xs text-gray-500">
        {t('whatsappInbox.slaResolutionPending', 'Resolution SLA applies after the first agent reply.')}
      </p>,
    );
  }

  return wrap(
    <p className="text-xs text-gray-500">
      {formatSlaStatusLabel(sla.sla_first_reply_status, sla.sla_first_reply_late_minutes, t)}
    </p>,
  );
}
