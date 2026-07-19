import { describe, expect, it } from 'vitest';
import {
  orderItemStatusesForTab,
  statusBadgeVariant,
} from './blibliOrderStatusTabs';
import {
  clampBlibliOrderDateRange,
  defaultBlibliOrderDateRange,
  BLIBLI_ORDERS_DEFAULT_PAGE_SIZE,
  BLIBLI_ORDERS_MAX_PAGE_SIZE,
} from './clampBlibliOrderDateRange';
import { BLIBLI_ORDERS_SETTINGS_PATH, isBlibliOrdersSettingsPath } from './blibliOrdersPaths';

describe('blibliOrderStatusTabs', () => {
  it('maps tabs to Blibli orderItemStatuses', () => {
    expect(orderItemStatusesForTab('all')).toBeUndefined();
    expect(orderItemStatusesForTab('new')).toEqual(['FP']);
    expect(orderItemStatusesForTab('in_process')).toEqual(['PU', 'CX', 'BP']);
    expect(orderItemStatusesForTab('delivered')).toEqual(['D']);
    expect(orderItemStatusesForTab('cancel')).toEqual(['X', 'OS', 'CR']);
  });

  it('picks badge variants', () => {
    expect(statusBadgeVariant('FP')).toBe('destructive');
    expect(statusBadgeVariant('D')).toBe('default');
    expect(statusBadgeVariant('X')).toBe('outline');
  });
});

describe('clampBlibliOrderDateRange', () => {
  it('defaults to ~7 days', () => {
    const now = Date.parse('2026-07-19T12:00:00.000Z');
    const range = defaultBlibliOrderDateRange(now);
    expect(range.end).toBe(now);
    expect(range.end - range.start).toBeGreaterThanOrEqual(6.9 * 24 * 60 * 60 * 1000);
  });

  it('clamps to max 1 year', () => {
    const now = Date.parse('2026-07-19T12:00:00.000Z');
    const range = clampBlibliOrderDateRange(
      { start: now - 800 * 24 * 60 * 60 * 1000, end: now },
      now,
    );
    expect(range.end - range.start).toBeLessThanOrEqual(365 * 24 * 60 * 60 * 1000 + 1000);
  });

  it('exposes paging defaults', () => {
    expect(BLIBLI_ORDERS_DEFAULT_PAGE_SIZE).toBe(20);
    expect(BLIBLI_ORDERS_MAX_PAGE_SIZE).toBe(50);
  });
});

describe('blibliOrdersPaths', () => {
  it('detects settings path', () => {
    expect(isBlibliOrdersSettingsPath(BLIBLI_ORDERS_SETTINGS_PATH)).toBe(true);
    expect(isBlibliOrdersSettingsPath('/operations/sales/blibli-orders')).toBe(false);
  });
});
