-- Fix Security Advisor: Function Search Path Mutable
-- Applies immutable search_path to existing public functions flagged by advisor.
DO $$
DECLARE
  fn_record record;
BEGIN
  FOR fn_record IN
    SELECT p.oid::pg_catalog.regprocedure AS function_signature
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (
        ARRAY[
          'handle_updated_at',
          'update_meeting_point_issues_updated_at',
          'update_meeting_point_solutions_updated_at',
          'update_bank_account_balances_updated_at',
          'update_bank_accounts_updated_at',
          'update_expenses_updated_at',
          'validate_expense_insert_debt',
          'handle_expense_insert',
          'validate_expense_update_debt',
          'handle_expense_update',
          'handle_expense_delete',
          'handle_expense_soft_delete_debt',
          'update_company_assets_updated_at',
          'get_employee_task_ids',
          'sync_task_steps_has_substeps',
          'habit_set_updated_at'
        ]::text[]
      )
  LOOP
    EXECUTE pg_catalog.format(
      'ALTER FUNCTION %s SET search_path TO %L',
      fn_record.function_signature,
      ''
    );
  END LOOP;
END;
$$;
