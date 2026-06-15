export type ParsedBrickDisbursementCallback = {
  eventId: string;
  status: string;
  amount: number;
  referenceId: string | null;
  disbursementId: string | null;
  feeAmount: number | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string | null;
  raw: Record<string, unknown>;
};

export function parseBrickDisbursementCallbackPayload(
  payload: Record<string, unknown>,
): ParsedBrickDisbursementCallback | null {
  const data = (payload.data as Record<string, unknown>) ?? payload;
  const type = data.type ? String(data.type).toLowerCase() : "";
  const attrs = (data.attributes as Record<string, unknown>) ?? data;
  const method = (attrs.disbursementMethod as Record<string, unknown>) ?? {};

  const isDisbursement = type === "disbursement" || Boolean(attrs.disbursementMethod) || Boolean(method.type);
  if (!isDisbursement) return null;

  const status = String(attrs.status ?? data.status ?? "").toLowerCase();
  const referenceId = attrs.referenceId
    ? String(attrs.referenceId)
    : data.referenceId
      ? String(data.referenceId)
      : null;
  const disbursementId = data.id ? String(data.id) : attrs.id ? String(attrs.id) : null;
  const amount = Number(attrs.amount ?? data.amount ?? 0);
  const feeRaw = attrs.feeAmount ?? attrs.fee ?? attrs.disbursementFee ?? null;

  if (!type && !status && !referenceId && !disbursementId) return null;

  const eventId = disbursementId ?? referenceId ?? `${status}-${amount}`;

  return {
    eventId,
    status,
    amount,
    referenceId,
    disbursementId,
    feeAmount: feeRaw != null ? Number(feeRaw) : null,
    failureCode: attrs.errorCode != null
      ? String(attrs.errorCode)
      : attrs.failureCode != null
        ? String(attrs.failureCode)
        : null,
    failureMessage: attrs.errorMessage != null
      ? String(attrs.errorMessage)
      : attrs.failureMessage != null
        ? String(attrs.failureMessage)
        : attrs.description != null
          ? String(attrs.description)
          : null,
    createdAt: attrs.createdAt ? String(attrs.createdAt) : null,
    raw: payload,
  };
}
