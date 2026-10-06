import { describe, expect, it } from 'vitest';
import { stepBelongsInTodayQueue, taskMatchesTodayWorkQueue } from './todayWorkQueue';

const now = new Date(2026, 9, 6, 15, 0, 0);
const today = new Date(2026, 9, 6, 9, 0, 0).toISOString();
const yesterday = new Date(2026, 9, 5, 9, 0, 0).toISOString();
const tomorrow = new Date(2026, 9, 7, 9, 0, 0).toISOString();

describe('taskMatchesTodayWorkQueue', () => {
  it('includes a task due today even when it is already completed', () => {
    expect(taskMatchesTodayWorkQueue({ status: 'completed', due_date: today }, now)).toBe(true);
  });

  it('includes an unfinished task whose due date already passed', () => {
    expect(taskMatchesTodayWorkQueue({ status: 'pending', due_date: yesterday }, now)).toBe(true);
  });

  it('leaves out a finished task that was due before today', () => {
    expect(taskMatchesTodayWorkQueue({ status: 'completed', due_date: yesterday }, now)).toBe(false);
    expect(taskMatchesTodayWorkQueue({ status: 'cancelled', due_date: yesterday }, now)).toBe(false);
  });

  it('includes a task when a step or sub-step is due today or still overdue', () => {
    expect(
      taskMatchesTodayWorkQueue(
        {
          status: 'pending',
          due_date: tomorrow,
          steps: [{ is_completed: false, assigned_due_date: today }],
        },
        now,
      ),
    ).toBe(true);

    expect(
      taskMatchesTodayWorkQueue(
        {
          status: 'pending',
          due_date: null,
          steps: [
            {
              is_completed: false,
              assigned_due_date: tomorrow,
              sub_steps: [{ is_completed: false, assigned_due_date: yesterday }],
            },
          ],
        },
        now,
      ),
    ).toBe(true);
  });

  it('hides a step that has no due date and no sub-step due today or overdue', () => {
    expect(stepBelongsInTodayQueue({ is_completed: false, assigned_due_date: null }, now)).toBe(false);
    expect(
      stepBelongsInTodayQueue(
        {
          is_completed: false,
          assigned_due_date: null,
          sub_steps: [{ is_completed: false, assigned_due_date: today }],
        },
        now,
      ),
    ).toBe(true);
  });

  it('leaves out a task with no due date today and no unfinished overdue work', () => {
    expect(
      taskMatchesTodayWorkQueue(
        {
          status: 'pending',
          due_date: tomorrow,
          steps: [
            {
              is_completed: true,
              assigned_due_date: yesterday,
              sub_steps: [{ is_completed: true, assigned_due_date: yesterday }],
            },
          ],
        },
        now,
      ),
    ).toBe(false);
  });
});
