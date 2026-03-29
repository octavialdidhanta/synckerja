import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDailyTask } from './DailyTaskContext';

/**
 * When user lands on /tools/daily-task (or view=jobdesc/summary) with state.pendingApprovalFocus
 * (e.g. from notification tap), apply it to context so the task/step list focuses accordingly.
 */
export function ApplyPendingApprovalFocusFromState() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setPendingApprovalFocus } = useDailyTask();

  useEffect(() => {
    const state = location.state as { pendingApprovalFocus?: { taskId: string; stepId?: string; openSubStepModalForStepId?: string } } | null;
    if (state?.pendingApprovalFocus?.taskId) {
      setPendingApprovalFocus(state.pendingApprovalFocus);
      navigate(location.pathname + location.search, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, location.search, navigate, setPendingApprovalFocus]);

  return null;
}
