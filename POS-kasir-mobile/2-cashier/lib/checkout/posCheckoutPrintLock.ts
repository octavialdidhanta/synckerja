export type PosCheckoutPrintLock = {
  subscribe: (listener: (printing: boolean) => void) => () => void;
  isPrinting: () => boolean;
  alreadyPrinted: (receiptKey: string) => boolean;
  markReceipt: (receiptKey: string, ok: boolean) => void;
  enqueue: <T>(fn: () => Promise<T>) => Promise<T>;
};

export function posCheckoutReceiptKey(args: {
  outletId: string;
  activityId: string | null | undefined;
}): string {
  return `${args.outletId}:${args.activityId ?? "none"}`;
}

/**
 * Serializes Bluetooth jobs (kitchen tickets then receipt, plus manual Print)
 * so two connects cannot race on one adapter.
 */
export function createPosCheckoutPrintLock(): PosCheckoutPrintLock {
  let chain: Promise<void> = Promise.resolve();
  let depth = 0;
  let lastReceiptKey: string | null = null;
  let lastReceiptOk = false;
  const listeners = new Set<(printing: boolean) => void>();

  const notify = () => {
    const printing = depth > 0;
    listeners.forEach((listener) => listener(printing));
  };

  const begin = () => {
    depth += 1;
    if (depth === 1) notify();
  };

  const end = () => {
    depth = Math.max(0, depth - 1);
    if (depth === 0) notify();
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      listener(depth > 0);
      return () => {
        listeners.delete(listener);
      };
    },
    isPrinting: () => depth > 0,
    alreadyPrinted: (receiptKey) => lastReceiptKey === receiptKey && lastReceiptOk,
    markReceipt(receiptKey, ok) {
      lastReceiptKey = receiptKey;
      lastReceiptOk = ok;
    },
    enqueue<T>(fn: () => Promise<T>): Promise<T> {
      const run = chain.then(async () => {
        begin();
        try {
          return await fn();
        } finally {
          end();
        }
      });
      chain = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };
}
