/** Thrown when send-whatsapp-template-followup returns a non-OK response. */
export class FollowUpSendError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'FollowUpSendError';
    this.code = code;
  }
}

export function getFollowUpSendErrorMessage(
  err: unknown,
  t: (key: string, fallback: string) => string,
): string {
  const code = err instanceof FollowUpSendError ? err.code : undefined;
  if (code === 'NOT_ON_OMNICHANNEL_ROSTER') {
    return t(
      'whatsappInbox.followUp.notOnRoster',
      'You must be on the omnichannel staff roster to send follow-up. Contact your omnichannel admin.',
    );
  }
  if (code === 'NO_EMPLOYEE_FOR_USER') {
    return t(
      'whatsappInbox.followUp.noEmployee',
      'Your account is not linked to an active employee record in this organization.',
    );
  }
  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }
  return t('whatsappInbox.followUp.sendFailed', 'Failed to send follow-up.');
}
