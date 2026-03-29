/**
 * Type declarations for Supabase Edge Functions (Deno runtime).
 * This file silences IDE/TypeScript errors when editing functions locally.
 * Functions are executed in Deno; these are for editor support only.
 */
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export function createClient(
    url: string,
    key: string,
    options?: { global?: { headers?: Record<string, string> } }
  ): any;
}

declare module "jsr:@supabase/functions-js/edge-runtime.d.ts" {
  // Edge runtime types; no exports needed for global Deno
}

declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(
    handler: (req: Request) => Promise<Response> | Response,
    options?: { port?: number }
  ): void;
}

declare module "https://esm.sh/date-fns@2" {
  export function addMonths(date: Date | number, amount: number): Date;
  export function addYears(date: Date | number, amount: number): Date;
}

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
