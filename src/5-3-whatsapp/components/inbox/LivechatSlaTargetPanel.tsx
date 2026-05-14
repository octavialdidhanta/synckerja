import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useCrmSlaForConversation } from '@/5-3-whatsapp/hooks/useCrmSlaForConversation';
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

function renderDueCountdown(
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

type LivechatSlaTargetPanelProps = {
  organizationId: string | null | undefined;
  conversation: LiveChatConversation;
  chatResolved: boolean;
};

export function LivechatSlaTargetPanel({ organizationId, conversation, chatResolved }: LivechatSlaTargetPanelProps) {
  const { t, dateFnsLocale } = useAppTranslation();
  const { data: sla, isPending, isError } = useCrmSlaForConversation(organizationId, conversation.id, conversation.source);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [conversation.id, organizationId]);

  const nowMs = Date.now() + tick * 0;

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
    return wrap(<p className="text-xs text-gray-400">—</p>);
  }

  if (chatResolved) {
    return null;
  }

  // Prefer resolution countdown once first reply exists and room still open
  if (sla.first_response_at && !sla.resolved_at && sla.resolution_due_at) {
    const block = renderDueCountdown(sla.resolution_due_at, nowMs, dateFnsLocale, t);
    if (block) return wrap(block);
  }

  if (!sla.first_response_at && sla.assignment_due_at) {
    const block = renderDueCountdown(sla.assignment_due_at, nowMs, dateFnsLocale, t);
    if (block) return wrap(block);
  }

  return null;
}
