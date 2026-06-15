import { detectXenditKeyKind, normalizeXenditSecretKey } from "./xenditKeyUtils.ts";

export type XenditEnvConfig = {
  secretKey: string;
  publicKey: string | null;
  webhookToken: string | null;
  isSandbox: boolean;
  flatFeeAmount: number;
  skipWebhookVerify: boolean;
  /** Derived from key prefix — development vs production */
  keyKind: "development" | "production" | "public" | "unknown";
};

export function readXenditEnv(): XenditEnvConfig | null {
  const secretKey = normalizeXenditSecretKey(Deno.env.get("XENDIT_SECRET_KEY") ?? "");
  if (!secretKey) return null;
  const keyKind = detectXenditKeyKind(secretKey);
  if (keyKind === "public") {
    console.error("xendit: XENDIT_SECRET_KEY looks like a public key (xnd_public_). Use the secret key.");
    return null;
  }
  const flatRaw = Deno.env.get("XENDIT_PLATFORM_FLAT_FEE")?.trim();
  const flatFeeAmount = flatRaw && Number.isFinite(Number(flatRaw))
    ? Math.max(0, Math.floor(Number(flatRaw)))
    : 2500;
  const envFlagSandbox = (Deno.env.get("XENDIT_ENV")?.trim() ?? "sandbox") !== "production";
  const keySaysSandbox = keyKind === "development";
  const keySaysProduction = keyKind === "production";
  const isSandbox = keySaysSandbox || (keyKind === "unknown" && envFlagSandbox);
  if (keySaysProduction && envFlagSandbox) {
    console.warn("xendit: XENDIT_ENV=sandbox but secret key is xnd_production_. Use a test key or set XENDIT_ENV=production.");
  }
  if (keySaysSandbox && !envFlagSandbox) {
    console.warn("xendit: XENDIT_ENV=production but secret key is xnd_development_. Keys and env should match.");
  }

  return {
    secretKey,
    publicKey: Deno.env.get("XENDIT_PUBLIC_KEY")?.trim() || null,
    webhookToken: Deno.env.get("XENDIT_WEBHOOK_VERIFICATION_TOKEN")?.trim() || null,
    isSandbox,
    flatFeeAmount,
    skipWebhookVerify: Deno.env.get("XENDIT_WEBHOOK_SKIP_VERIFY") === "true",
    keyKind,
  };
}

export function readMinDisbursementAmount(): number {
  const raw = Deno.env.get("XENDIT_MIN_DISBURSEMENT_AMOUNT")?.trim();
  if (raw && Number.isFinite(Number(raw))) {
    return Math.max(1, Math.floor(Number(raw)));
  }
  return 10_000;
}

/** Platform fee deducted from gross gateway withdrawal (defaults to VA flat fee). */
export function readWithdrawalPlatformFee(flatFeeFallback: number): number {
  const raw = Deno.env.get("XENDIT_WITHDRAWAL_PLATFORM_FEE")?.trim();
  if (raw && Number.isFinite(Number(raw))) {
    return Math.max(0, Math.floor(Number(raw)));
  }
  return Math.max(0, Math.floor(flatFeeFallback));
}

export function xenditApiBase(): string {
  return "https://api.xendit.co";
}
