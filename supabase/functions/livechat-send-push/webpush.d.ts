/**
 * Type declarations for JSR @negrel/webpush (Deno runtime).
 * Supabase Edge Functions resolve this at runtime; this file is for IDE/TypeScript only.
 */
declare module "jsr:@negrel/webpush@0.5.0" {
  export function importVapidKeys(
    exported: { publicKey: JsonWebKey; privateKey: JsonWebKey },
    options?: { extractable?: boolean }
  ): Promise<CryptoKeyPair>;

  export const Urgency: { High: string; Normal: string; Low: string };

  export class ApplicationServer {
    static new(options: {
      contactInformation: string;
      vapidKeys: CryptoKeyPair;
    }): Promise<ApplicationServer>;
    subscribe(options: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    }): Subscriber;
  }

  export interface Subscriber {
    pushTextMessage(
      payload: string,
      options?: { urgency?: string }
    ): Promise<void>;
  }
}
