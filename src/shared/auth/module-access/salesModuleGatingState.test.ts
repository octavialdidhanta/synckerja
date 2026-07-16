import { describe, expect, it } from "vitest";
import {
  createDefaultSalesModuleAccess,
  createFullModuleAccess,
  isSalesModulePathBlocked,
} from "@/shared/auth/module-access/moduleCatalog";
import { resolveSalesModuleGatingState } from "@/shared/auth/module-access/salesModuleGatingState";

describe("resolveSalesModuleGatingState", () => {
  it("returns inactive gating for non-sales tenants", () => {
    const state = resolveSalesModuleGatingState(false, true, undefined);
    expect(state.isModuleGatingActive).toBe(false);
    expect(state.moduleAccess).toBeNull();
    expect(state.moduleAccessPending).toBe(false);
  });

  it("fail-opens while sales module access is loading", () => {
    const state = resolveSalesModuleGatingState(true, true, undefined);
    expect(state.isModuleGatingActive).toBe(false);
    expect(state.moduleAccessPending).toBe(true);
    expect(state.moduleAccess).toEqual(createFullModuleAccess());
    expect(
      isSalesModulePathBlocked(
        "/digital-marketing/lead-magnet",
        state.isModuleGatingActive,
        state.moduleAccess,
      ),
    ).toBe(false);
  });

  it("enforces gating after fetch with disabled modules", () => {
    const access = createDefaultSalesModuleAccess();
    access.digitalMarketing = false;
    const state = resolveSalesModuleGatingState(true, false, access);
    expect(state.isModuleGatingActive).toBe(true);
    expect(state.moduleAccessPending).toBe(false);
    expect(
      isSalesModulePathBlocked(
        "/digital-marketing/lead-magnet",
        state.isModuleGatingActive,
        state.moduleAccess,
      ),
    ).toBe(true);
  });

  it("allows enabled modules after fetch", () => {
    const access = createDefaultSalesModuleAccess();
    access.digitalMarketing = true;
    const state = resolveSalesModuleGatingState(true, false, access);
    expect(
      isSalesModulePathBlocked(
        "/digital-marketing/lead-magnet",
        state.isModuleGatingActive,
        state.moduleAccess,
      ),
    ).toBe(false);
  });

  it("does not pend when refetching with cached data", () => {
    const access = createDefaultSalesModuleAccess();
    access.digitalMarketing = true;
    const state = resolveSalesModuleGatingState(true, true, access);
    expect(state.moduleAccessPending).toBe(false);
    expect(state.isModuleGatingActive).toBe(true);
  });
});
