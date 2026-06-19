import { xenditRequest } from "../xenditClient.ts";
import type { XenditEnvConfig } from "../xenditEnv.ts";

export type XenditTransferResponse = {
  id?: string;
  transfer_id?: string;
  reference?: string;
  status?: string;
  amount?: number;
  source_user_id?: string;
  destination_user_id?: string;
  error_code?: string;
  message?: string;
};

function mapTransferStatus(status: string | undefined): "completed" | "failed" | "pending" {
  const normalized = String(status ?? "").trim().toUpperCase();
  if (normalized === "SUCCESSFUL" || normalized === "COMPLETED" || normalized === "SUCCEEDED") {
    return "completed";
  }
  if (normalized === "FAILED" || normalized === "FAILURE") return "failed";
  return "pending";
}

export async function createXenditTransfer(
  env: XenditEnvConfig,
  params: {
    reference: string;
    amount: number;
    sourceUserId: string;
    destinationUserId: string;
  },
): Promise<{ ok: boolean; status: "completed" | "failed" | "pending"; transferId: string | null; raw: XenditTransferResponse }> {
  const amount = Math.floor(params.amount);
  if (amount <= 0) {
    throw new Error("Transfer amount must be positive");
  }

  const raw = await xenditRequest<XenditTransferResponse>(env.secretKey, {
    method: "POST",
    path: "/transfers",
    body: {
      reference: params.reference,
      amount,
      source_user_id: params.sourceUserId,
      destination_user_id: params.destinationUserId,
    },
    idempotencyKey: params.reference,
  });

  const transferId = raw.transfer_id != null
    ? String(raw.transfer_id)
    : raw.id != null
    ? String(raw.id)
    : null;

  return {
    ok: mapTransferStatus(raw.status) !== "failed",
    status: mapTransferStatus(raw.status),
    transferId,
    raw,
  };
}

export { mapTransferStatus };
