import { describe, expect, it } from 'vitest';
import {
  belongsInSelectedPlanMonth,
  isOpenOverdueInJakarta,
  jakartaOverdueCutoffIso,
  mergeTasksById,
} from './overdueCarryOver';

const now = new Date('2026-11-01T08:00:00+07:00');
const november = '2026-11-01';

describe('overdue carry-over into the selected plan month', () => {
  it('uses the start of today in Asia/Jakarta as the overdue cutoff', () => {
    expect(jakartaOverdueCutoffIso(now)).toBe('2026-10-31T17:00:00.000Z');
  });

  it('keeps a June pending task visible in November and labels it overdue', () => {
    const task = {
      id: 'june-pending',
      plan_date: '2026-06-01T00:00:00+00:00',
      due_date: '2026-08-17T10:00:00+00:00',
      status: 'pending',
    };
    expect(belongsInSelectedPlanMonth(task, november, now)).toBe(true);
    expect(isOpenOverdueInJakarta(task.due_date, task.status, now)).toBe(true);
    expect(task.plan_date).toBe('2026-06-01T00:00:00+00:00');
    expect(task.due_date).toBe('2026-08-17T10:00:00+00:00');
  });

  it('keeps a June in-progress task visible in November', () => {
    const task = {
      plan_date: '2026-06-01T00:00:00+00:00',
      due_date: '2026-08-17T10:00:00+00:00',
      status: 'in_progress',
    };
    expect(belongsInSelectedPlanMonth(task, november, now)).toBe(true);
    expect(isOpenOverdueInJakarta(task.due_date, task.status, now)).toBe(true);
  });

  it('does not carry a completed or cancelled June task into November', () => {
    const completed = {
      plan_date: '2026-06-01T00:00:00+00:00',
      due_date: '2026-08-17T10:00:00+00:00',
      status: 'completed',
    };
    const cancelled = { ...completed, status: 'cancelled' };
    expect(belongsInSelectedPlanMonth(completed, november, now)).toBe(false);
    expect(belongsInSelectedPlanMonth(cancelled, november, now)).toBe(false);
    expect(isOpenOverdueInJakarta(completed.due_date, 'completed', now)).toBe(false);
    expect(isOpenOverdueInJakarta(cancelled.due_date, 'cancelled', now)).toBe(false);
  });

  it('keeps a November task whose deadline is in December', () => {
    const task = {
      plan_date: '2026-11-01T00:00:00+00:00',
      due_date: '2026-12-05T10:00:00+00:00',
      status: 'pending',
    };
    expect(belongsInSelectedPlanMonth(task, november, now)).toBe(true);
    expect(isOpenOverdueInJakarta(task.due_date, task.status, now)).toBe(false);
  });

  it('does not carry a June task whose deadline is still in the future', () => {
    const task = {
      plan_date: '2026-06-01T00:00:00+00:00',
      due_date: '2026-12-05T10:00:00+00:00',
      status: 'pending',
    };
    expect(belongsInSelectedPlanMonth(task, november, now)).toBe(false);
    expect(isOpenOverdueInJakarta(task.due_date, task.status, now)).toBe(false);
  });

  it('does not treat a task with no due date as overdue', () => {
    const task = {
      plan_date: '2026-06-01T00:00:00+00:00',
      due_date: null,
      status: 'pending',
    };
    expect(belongsInSelectedPlanMonth(task, november, now)).toBe(false);
    expect(isOpenOverdueInJakarta(null, 'pending', now)).toBe(false);
    expect(isOpenOverdueInJakarta('   ', 'in_progress', now)).toBe(false);
  });

  it('does not duplicate a task that is both in the month and overdue', () => {
    const row = { id: 'same', plan_date: '2026-11-01T00:00:00+00:00', due_date: '2026-08-17T10:00:00+00:00' };
    expect(mergeTasksById([row], [row, { id: 'older', plan_date: '2026-06-01' }])).toEqual([
      row,
      { id: 'older', plan_date: '2026-06-01' },
    ]);
  });
});
