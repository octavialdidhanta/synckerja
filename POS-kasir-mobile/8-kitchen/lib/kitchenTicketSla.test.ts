import { describe, expect, it } from "vitest";
import {
  formatKitchenWaitDuration,
  kitchenSlaBucket,
  kitchenSlaRingProgress,
  KITCHEN_SLA_CRITICAL_MINUTES,
  KITCHEN_SLA_WARN_MINUTES,
} from "./kitchenTicketSla";
import { kitchenTicketElapsedMs, kitchenTicketReadiness } from "./kitchenTicketMeta";

const t = (_key: string, fallback: string, vars?: Record<string, string | number>) => {
  let out = fallback;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replace(`{{${k}}}`, String(v));
    }
  }
  return out;
};

describe("kitchenSlaBucket", () => {
  it("thresholds", () => {
    expect(kitchenSlaBucket((KITCHEN_SLA_WARN_MINUTES - 1) * 60_000)).toBe("ok");
    expect(kitchenSlaBucket(KITCHEN_SLA_WARN_MINUTES * 60_000)).toBe("warn");
    expect(kitchenSlaBucket(KITCHEN_SLA_CRITICAL_MINUTES * 60_000)).toBe("critical");
  });
});

describe("formatKitchenWaitDuration", () => {
  it("uses Sec / Min labels", () => {
    expect(formatKitchenWaitDuration(7_000, t)).toBe("7 Sec");
    expect(formatKitchenWaitDuration(5 * 60_000, t)).toBe("5 Min");
    expect(formatKitchenWaitDuration(72 * 60_000, t)).toBe("1h 12m");
  });
});

describe("kitchenSlaRingProgress", () => {
  it("caps at 1", () => {
    expect(kitchenSlaRingProgress(0)).toBe(0);
    expect(kitchenSlaRingProgress(KITCHEN_SLA_CRITICAL_MINUTES * 60_000)).toBe(1);
  });
});

describe("kitchenTicketElapsedMs", () => {
  it("freezes while held", () => {
    const created = Date.parse("2026-08-29T10:00:00.000Z");
    const held = Date.parse("2026-08-29T10:05:00.000Z");
    const now = Date.parse("2026-08-29T10:20:00.000Z");
    expect(
      kitchenTicketElapsedMs(
        {
          created_at: new Date(created).toISOString(),
          is_held: true,
          held_at: new Date(held).toISOString(),
          pause_ms: 0,
        },
        now,
      ),
    ).toBe(5 * 60_000);
  });
});

describe("kitchenTicketReadiness", () => {
  it("computes percent", () => {
    expect(kitchenTicketReadiness([{ is_done: true }, { is_done: false }]).percent).toBe(50);
    expect(kitchenTicketReadiness([]).percent).toBe(0);
  });
});
