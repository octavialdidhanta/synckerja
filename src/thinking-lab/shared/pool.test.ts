import { describe, expect, it } from "vitest";
import { startLimited } from "@/thinking-lab/shared/pool";

describe("startLimited", () => {
  it("runs at most the limit at once, keeps every result by key", async () => {
    let active = 0;
    let peak = 0;
    const jobs = startLimited([1, 2, 3, 4, 5], (n) => `k${n}`, 2, async (n) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return n * 10;
    });
    const results = await Promise.all([...jobs.values()]);
    expect(results.join(",")).toBe("10,20,30,40,50");
    expect(peak).toBe(2);
    expect(await jobs.get("k3")).toBe(30);
  });

  it("passes a failure to the caller that awaits it", async () => {
    const jobs = startLimited(["a", "b"], (s) => s, 1, async (s) => {
      if (s === "a") throw new Error("boom");
      return s;
    });
    let message = "";
    try {
      await jobs.get("a");
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toBe("boom");
    expect(await jobs.get("b")).toBe("b");
  });
});
