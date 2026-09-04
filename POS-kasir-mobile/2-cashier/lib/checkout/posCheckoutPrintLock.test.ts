import { describe, expect, it } from "vitest";
import {
  createPosCheckoutPrintLock,
  posCheckoutReceiptKey,
} from "./posCheckoutPrintLock";

describe("posCheckoutReceiptKey", () => {
  it("scopes a receipt to outlet + activity", () => {
    expect(posCheckoutReceiptKey({ outletId: "out-1", activityId: "act-9" })).toBe(
      "out-1:act-9",
    );
    expect(posCheckoutReceiptKey({ outletId: "out-1", activityId: null })).toBe(
      "out-1:none",
    );
  });
});

describe("createPosCheckoutPrintLock", () => {
  it("runs enqueued jobs one after another", async () => {
    const lock = createPosCheckoutPrintLock();
    const order: string[] = [];
    let releaseFirst!: () => void;
    const firstHold = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = lock.enqueue(async () => {
      order.push("first-start");
      await firstHold;
      order.push("first-end");
    });
    const second = lock.enqueue(async () => {
      order.push("second");
    });

    await Promise.resolve();
    expect(order).toEqual(["first-start"]);
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(["first-start", "first-end", "second"]);
  });

  it("tracks printing with a depth counter so overlapping jobs stay busy", async () => {
    const lock = createPosCheckoutPrintLock();
    const seen: boolean[] = [];
    lock.subscribe((printing) => seen.push(printing));

    let release!: () => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const job = lock.enqueue(async () => {
      await hold;
    });
    await Promise.resolve();
    expect(lock.isPrinting()).toBe(true);
    release();
    await job;
    expect(lock.isPrinting()).toBe(false);
    expect(seen[0]).toBe(false);
    expect(seen).toContain(true);
    expect(seen[seen.length - 1]).toBe(false);
  });

  it("remembers a successful receipt so a later job can no-op", () => {
    const lock = createPosCheckoutPrintLock();
    expect(lock.alreadyPrinted("out-1:act-1")).toBe(false);
    lock.markReceipt("out-1:act-1", true);
    expect(lock.alreadyPrinted("out-1:act-1")).toBe(true);
    lock.markReceipt("out-1:act-1", false);
    expect(lock.alreadyPrinted("out-1:act-1")).toBe(false);
  });

  it("does not treat a failed mark as already printed", () => {
    const lock = createPosCheckoutPrintLock();
    lock.markReceipt("out-1:act-1", false);
    expect(lock.alreadyPrinted("out-1:act-1")).toBe(false);
  });
});
