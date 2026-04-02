-- Trigger functions to automatically update debt when expense is created/updated/deleted
-- This ensures debt used_amount, available_limit, and debt_amount are always in sync

-- ============================================
-- Function: Handle INSERT expense
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_expense_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_debt_record RECORD;
    v_available_limit NUMERIC(15, 2);
BEGIN
    -- Only process if withdrawal_from_balance is set
    IF NEW.withdrawal_from_balance IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get debt record with row-level lock to prevent race conditions
    SELECT 
        id,
        limit_amount,
        used_amount,
        available_limit,
        debt_amount,
        status
    INTO v_debt_record
    FROM debts
    WHERE id = NEW.withdrawal_from_balance
    FOR UPDATE; -- Lock row to prevent concurrent updates

    -- Check if debt exists
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Debt with id % not found', NEW.withdrawal_from_balance;
    END IF;

    -- Check if debt is active
    IF v_debt_record.status != 'active' THEN
        RAISE EXCEPTION 'Cannot use debt with status %. Only active debts can be used.', v_debt_record.status;
    END IF;

    -- Calculate available_limit if NULL
    v_available_limit := COALESCE(
        v_debt_record.available_limit,
        v_debt_record.limit_amount - v_debt_record.used_amount
    );

    -- Validate available_limit >= expense amount
    IF v_available_limit < NEW.amount THEN
        RAISE EXCEPTION 'Insufficient available limit. Available: %, Required: %', 
            v_available_limit, NEW.amount;
    END IF;

    -- Update debt: increase used_amount, decrease available_limit, update debt_amount
    UPDATE debts
    SET
        used_amount = used_amount + NEW.amount,
        available_limit = available_limit - NEW.amount,
        debt_amount = used_amount + NEW.amount,
        updated_at = NOW()
    WHERE id = NEW.withdrawal_from_balance;

    RETURN NEW;
END;
$$;

-- ============================================
-- Function: Handle UPDATE expense
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_expense_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_old_debt_record RECORD;
    v_new_debt_record RECORD;
    v_old_available_limit NUMERIC(15, 2);
    v_new_available_limit NUMERIC(15, 2);
    v_amount_diff NUMERIC(15, 2);
BEGIN
    -- Calculate amount difference
    v_amount_diff := NEW.amount - OLD.amount;

    -- Case 1: withdrawal_from_balance changed
    IF (OLD.withdrawal_from_balance IS DISTINCT FROM NEW.withdrawal_from_balance) THEN
        -- Return limit to old debt (if exists)
        IF OLD.withdrawal_from_balance IS NOT NULL THEN
            UPDATE debts
            SET
                used_amount = used_amount - OLD.amount,
                available_limit = available_limit + OLD.amount,
                debt_amount = used_amount - OLD.amount,
                updated_at = NOW()
            WHERE id = OLD.withdrawal_from_balance;
        END IF;

        -- Deduct limit from new debt (if exists)
        IF NEW.withdrawal_from_balance IS NOT NULL THEN
            -- Get new debt record with lock
            SELECT 
                id,
                limit_amount,
                used_amount,
                available_limit,
                debt_amount,
                status
            INTO v_new_debt_record
            FROM debts
            WHERE id = NEW.withdrawal_from_balance
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Debt with id % not found', NEW.withdrawal_from_balance;
            END IF;

            IF v_new_debt_record.status != 'active' THEN
                RAISE EXCEPTION 'Cannot use debt with status %. Only active debts can be used.', v_new_debt_record.status;
            END IF;

            v_new_available_limit := COALESCE(
                v_new_debt_record.available_limit,
                v_new_debt_record.limit_amount - v_new_debt_record.used_amount
            );

            IF v_new_available_limit < NEW.amount THEN
                RAISE EXCEPTION 'Insufficient available limit. Available: %, Required: %', 
                    v_new_available_limit, NEW.amount;
            END IF;

            UPDATE debts
            SET
                used_amount = used_amount + NEW.amount,
                available_limit = available_limit - NEW.amount,
                debt_amount = used_amount + NEW.amount,
                updated_at = NOW()
            WHERE id = NEW.withdrawal_from_balance;
        END IF;

        RETURN NEW;
    END IF;

    -- Case 2: Only amount changed (withdrawal_from_balance unchanged)
    IF OLD.withdrawal_from_balance IS NOT NULL AND v_amount_diff != 0 THEN
        -- Get debt record with lock
        SELECT 
            id,
            limit_amount,
            used_amount,
            available_limit,
            debt_amount,
            status
        INTO v_old_debt_record
        FROM debts
        WHERE id = OLD.withdrawal_from_balance
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Debt with id % not found', OLD.withdrawal_from_balance;
        END IF;

        v_old_available_limit := COALESCE(
            v_old_debt_record.available_limit,
            v_old_debt_record.limit_amount - v_old_debt_record.used_amount
        );

        -- If amount increased, check if enough limit available
        IF v_amount_diff > 0 THEN
            IF v_old_available_limit < v_amount_diff THEN
                RAISE EXCEPTION 'Insufficient available limit. Available: %, Required additional: %', 
                    v_old_available_limit, v_amount_diff;
            END IF;
        END IF;

        -- Update debt based on amount difference
        UPDATE debts
        SET
            used_amount = used_amount + v_amount_diff,
            available_limit = available_limit - v_amount_diff,
            debt_amount = used_amount + v_amount_diff,
            updated_at = NOW()
        WHERE id = OLD.withdrawal_from_balance;
    END IF;

    RETURN NEW;
END;
$$;

-- ============================================
-- Function: Handle DELETE expense
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_expense_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only process if withdrawal_from_balance is set
    IF OLD.withdrawal_from_balance IS NULL THEN
        RETURN OLD;
    END IF;

    -- Return limit back to debt
    UPDATE debts
    SET
        used_amount = used_amount - OLD.amount,
        available_limit = available_limit + OLD.amount,
        debt_amount = used_amount - OLD.amount,
        updated_at = NOW()
    WHERE id = OLD.withdrawal_from_balance;

    RETURN OLD;
END;
$$;

-- ============================================
-- Create Triggers
-- ============================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_expense_insert_debt_update ON expenses;
DROP TRIGGER IF EXISTS trigger_expense_update_debt_update ON expenses;
DROP TRIGGER IF EXISTS trigger_expense_delete_debt_update ON expenses;

-- Create trigger for INSERT
CREATE TRIGGER trigger_expense_insert_debt_update
    BEFORE INSERT ON expenses
    FOR EACH ROW
    EXECUTE FUNCTION handle_expense_insert();

-- Create trigger for UPDATE
CREATE TRIGGER trigger_expense_update_debt_update
    BEFORE UPDATE ON expenses
    FOR EACH ROW
    WHEN (
        OLD.withdrawal_from_balance IS DISTINCT FROM NEW.withdrawal_from_balance
        OR OLD.amount IS DISTINCT FROM NEW.amount
    )
    EXECUTE FUNCTION handle_expense_update();

-- Create trigger for DELETE
CREATE TRIGGER trigger_expense_delete_debt_update
    AFTER DELETE ON expenses
    FOR EACH ROW
    EXECUTE FUNCTION handle_expense_delete();

-- Comments
COMMENT ON FUNCTION public.handle_expense_insert() IS 'Validates available_limit and updates debt when expense is created';
COMMENT ON FUNCTION public.handle_expense_update() IS 'Handles debt updates when expense amount or withdrawal_from_balance changes';
COMMENT ON FUNCTION public.handle_expense_delete() IS 'Returns limit back to debt when expense is deleted';
