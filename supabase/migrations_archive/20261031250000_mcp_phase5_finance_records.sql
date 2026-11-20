-- Phase 5 MCP finance records. Membership is checked here; EXECUTE is service_role only.
-- Records stay unpaid: income is pending, expenses stay active, and bank, wallet, and debt columns are left untouched.

CREATE OR REPLACE FUNCTION public.mcp_create_income_transaction(
  p_user_id uuid,
  p_organization_id uuid,
  p_transaction_date text,
  p_amount numeric,
  p_customer_name text,
  p_payment_method text,
  p_description text
)
RETURNS TABLE (
  id uuid,
  transaction_date date,
  amount double precision,
  customer_name text,
  payment_method text,
  status text,
  description text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
DECLARE
  v_day date;
  v_customer text;
  v_method text;
  v_description text;
  v_row public.income_transactions%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(btrim(COALESCE(p_transaction_date, '')), '') IS NULL
    OR btrim(p_transaction_date) !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' THEN
    RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_day := btrim(p_transaction_date)::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
  END;
  IF to_char(v_day, 'YYYY-MM-DD') <> btrim(p_transaction_date) THEN
    RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 9999999999999.99 OR scale(p_amount) > 2 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_customer := NULLIF(btrim(COALESCE(p_customer_name, '')), '');
  IF p_customer_name IS NOT NULL AND (v_customer IS NULL OR char_length(v_customer) > 200) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_method := NULLIF(lower(btrim(COALESCE(p_payment_method, ''))), '');
  IF p_payment_method IS NOT NULL AND (
    v_method IS NULL
    OR v_method NOT IN ('cash', 'credit_card', 'debit_card', 'check', 'digital_wallet', 'other')
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_description := NULLIF(btrim(COALESCE(p_description, '')), '');
  IF p_description IS NOT NULL AND (v_description IS NULL OR char_length(v_description) > 2000) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.income_transactions (
    organization_id,
    user_id,
    created_by,
    transaction_date,
    amount,
    customer_name,
    payment_method,
    description,
    status,
    is_recurring
  )
  VALUES (
    p_organization_id,
    p_user_id,
    p_user_id,
    v_day,
    p_amount,
    v_customer,
    v_method,
    v_description,
    'pending',
    false
  )
  RETURNING * INTO v_row;

  id := v_row.id;
  transaction_date := v_row.transaction_date;
  amount := v_row.amount::double precision;
  customer_name := v_row.customer_name;
  payment_method := v_row.payment_method;
  status := v_row.status;
  description := v_row.description;
  RETURN NEXT;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_update_income_transaction(
  p_user_id uuid,
  p_organization_id uuid,
  p_id uuid,
  p_transaction_date text,
  p_amount numeric,
  p_customer_name text,
  p_payment_method text,
  p_description text
)
RETURNS TABLE (
  id uuid,
  transaction_date date,
  amount double precision,
  customer_name text,
  payment_method text,
  status text,
  description text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
DECLARE
  v_day date;
  v_customer text;
  v_method text;
  v_description text;
  v_current public.income_transactions%ROWTYPE;
  v_row public.income_transactions%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  v_day := NULL;
  IF p_transaction_date IS NOT NULL THEN
    IF btrim(p_transaction_date) !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' THEN
      RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_day := btrim(p_transaction_date)::date;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
    END;
    IF to_char(v_day, 'YYYY-MM-DD') <> btrim(p_transaction_date) THEN
      RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_amount IS NOT NULL AND (p_amount <= 0 OR p_amount > 9999999999999.99 OR scale(p_amount) > 2) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_customer := NULL;
  IF p_customer_name IS NOT NULL THEN
    v_customer := NULLIF(btrim(p_customer_name), '');
    IF v_customer IS NULL OR char_length(v_customer) > 200 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
  END IF;

  v_method := NULL;
  IF p_payment_method IS NOT NULL THEN
    v_method := NULLIF(lower(btrim(p_payment_method)), '');
    IF v_method IS NULL
      OR v_method NOT IN ('cash', 'credit_card', 'debit_card', 'check', 'digital_wallet', 'other') THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
  END IF;

  v_description := NULL;
  IF p_description IS NOT NULL THEN
    v_description := NULLIF(btrim(p_description), '');
    IF v_description IS NULL OR char_length(v_description) > 2000 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_day IS NULL AND p_amount IS NULL AND v_customer IS NULL AND v_method IS NULL AND v_description IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT tx.*
  INTO v_current
  FROM public.income_transactions tx
  WHERE tx.id = p_id
    AND tx.organization_id = p_organization_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_current.status IS DISTINCT FROM 'pending'
    OR v_current.bank_account_id IS NOT NULL
    OR v_current.deposit_confirmed_at IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM public.income_allocations ia
      WHERE ia.income_transaction_id = v_current.id
    ) THEN
    RAISE EXCEPTION 'not_editable' USING ERRCODE = '22023';
  END IF;

  UPDATE public.income_transactions AS tx
  SET
    transaction_date = COALESCE(v_day, tx.transaction_date),
    amount = COALESCE(p_amount, tx.amount),
    customer_name = COALESCE(v_customer, tx.customer_name),
    payment_method = COALESCE(v_method, tx.payment_method),
    description = COALESCE(v_description, tx.description),
    updated_at = now()
  WHERE tx.id = p_id
    AND tx.organization_id = p_organization_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  id := v_row.id;
  transaction_date := v_row.transaction_date;
  amount := v_row.amount::double precision;
  customer_name := v_row.customer_name;
  payment_method := v_row.payment_method;
  status := v_row.status;
  description := v_row.description;
  RETURN NEXT;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_create_expense(
  p_user_id uuid,
  p_organization_id uuid,
  p_expense_name text,
  p_amount numeric,
  p_create_date text,
  p_expense_type text,
  p_category text,
  p_description text
)
RETURNS TABLE (
  id uuid,
  expense_name text,
  amount double precision,
  expense_type text,
  category text,
  create_date date,
  status text,
  description text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
DECLARE
  v_name text;
  v_day date;
  v_type_input text;
  v_category_input text;
  v_type_id uuid;
  v_type_name text;
  v_category_id uuid;
  v_category_name text;
  v_description text;
  v_row public.expenses%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  v_name := NULLIF(btrim(COALESCE(p_expense_name, '')), '');
  IF v_name IS NULL OR char_length(v_name) > 200 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 9999999999999.99 OR scale(p_amount) > 2 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NULLIF(btrim(COALESCE(p_create_date, '')), '') IS NULL
    OR btrim(p_create_date) !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' THEN
    RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
  END IF;
  BEGIN
    v_day := btrim(p_create_date)::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
  END;
  IF to_char(v_day, 'YYYY-MM-DD') <> btrim(p_create_date) THEN
    RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
  END IF;

  v_type_input := NULLIF(btrim(COALESCE(p_expense_type, '')), '');
  v_category_input := NULLIF(btrim(COALESCE(p_category, '')), '');
  IF v_type_input IS NULL OR char_length(v_type_input) > 200
    OR v_category_input IS NULL OR char_length(v_category_input) > 200
    OR lower(v_type_input) = 'internal bank transfer' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT et.id, et.name
  INTO v_type_id, v_type_name
  FROM public.expense_types et
  WHERE et.is_active = true
    AND lower(btrim(et.name)) = lower(v_type_input)
    AND (et.organization_id = p_organization_id OR et.organization_id IS NULL)
  ORDER BY (et.organization_id IS NOT DISTINCT FROM p_organization_id) DESC, et.created_at ASC
  LIMIT 1;
  IF v_type_id IS NULL THEN
    RAISE EXCEPTION 'invalid_master' USING ERRCODE = '22023';
  END IF;

  SELECT ec.id, ec.name
  INTO v_category_id, v_category_name
  FROM public.expense_categories ec
  WHERE ec.is_active = true
    AND ec.expense_type_id = v_type_id
    AND lower(btrim(ec.name)) = lower(v_category_input)
    AND (ec.organization_id = p_organization_id OR ec.organization_id IS NULL)
  ORDER BY (ec.organization_id IS NOT DISTINCT FROM p_organization_id) DESC, ec.created_at ASC
  LIMIT 1;
  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'invalid_master' USING ERRCODE = '22023';
  END IF;

  v_description := NULLIF(btrim(COALESCE(p_description, '')), '');
  IF p_description IS NOT NULL AND (v_description IS NULL OR char_length(v_description) > 2000) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.expenses (
    organization_id,
    created_by,
    expense_name,
    amount,
    expense_type,
    expense_type_id,
    category,
    expense_category_id,
    create_date,
    description,
    status,
    is_recurring
  )
  VALUES (
    p_organization_id,
    p_user_id,
    v_name,
    p_amount,
    v_type_name,
    v_type_id,
    v_category_name,
    v_category_id,
    v_day,
    v_description,
    'active',
    false
  )
  RETURNING * INTO v_row;

  id := v_row.id;
  expense_name := v_row.expense_name;
  amount := v_row.amount::double precision;
  expense_type := v_row.expense_type;
  category := v_row.category;
  create_date := v_row.create_date;
  status := v_row.status;
  description := v_row.description;
  RETURN NEXT;
END;
$mcp$;

CREATE OR REPLACE FUNCTION public.mcp_update_expense(
  p_user_id uuid,
  p_organization_id uuid,
  p_id uuid,
  p_expense_name text,
  p_amount numeric,
  p_create_date text,
  p_expense_type text,
  p_category text,
  p_description text
)
RETURNS TABLE (
  id uuid,
  expense_name text,
  amount double precision,
  expense_type text,
  category text,
  create_date date,
  status text,
  description text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $mcp$
DECLARE
  v_name text;
  v_day date;
  v_type_input text;
  v_category_input text;
  v_type_id uuid;
  v_type_name text;
  v_category_id uuid;
  v_category_name text;
  v_description text;
  v_current public.expenses%ROWTYPE;
  v_row public.expenses%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_organization_id
      AND COALESCE(uo.is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  v_name := NULL;
  IF p_expense_name IS NOT NULL THEN
    v_name := NULLIF(btrim(p_expense_name), '');
    IF v_name IS NULL OR char_length(v_name) > 200 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_amount IS NOT NULL AND (p_amount <= 0 OR p_amount > 9999999999999.99 OR scale(p_amount) > 2) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_day := NULL;
  IF p_create_date IS NOT NULL THEN
    IF btrim(p_create_date) !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' THEN
      RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_day := btrim(p_create_date)::date;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
    END;
    IF to_char(v_day, 'YYYY-MM-DD') <> btrim(p_create_date) THEN
      RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023';
    END IF;
  END IF;

  v_description := NULL;
  IF p_description IS NOT NULL THEN
    v_description := NULLIF(btrim(p_description), '');
    IF v_description IS NULL OR char_length(v_description) > 2000 THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_expense_type IS NOT NULL AND (
    NULLIF(btrim(p_expense_type), '') IS NULL
    OR char_length(btrim(p_expense_type)) > 200
    OR lower(btrim(p_expense_type)) = 'internal bank transfer'
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF p_category IS NOT NULL AND (
    NULLIF(btrim(p_category), '') IS NULL
    OR char_length(btrim(p_category)) > 200
  ) THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  IF v_name IS NULL AND p_amount IS NULL AND v_day IS NULL
    AND p_expense_type IS NULL AND p_category IS NULL AND v_description IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  SELECT expense.*
  INTO v_current
  FROM public.expenses expense
  WHERE expense.id = p_id
    AND expense.organization_id = p_organization_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_current.status IS DISTINCT FROM 'active'
    OR v_current.bank_account_id IS NOT NULL
    OR v_current.gateway_wallet_provider IS NOT NULL
    OR v_current.withdrawal_from_balance IS NOT NULL
    OR v_current.payroll_run_id IS NOT NULL
    OR v_current.is_recurring
    OR v_current.recurring_settlement_for_expense_id IS NOT NULL
    OR v_current.purchase_request_id IS NOT NULL
    OR lower(btrim(v_current.expense_type)) = 'internal bank transfer' THEN
    RAISE EXCEPTION 'not_editable' USING ERRCODE = '22023';
  END IF;

  v_type_id := NULL;
  v_type_name := NULL;
  v_category_id := NULL;
  v_category_name := NULL;
  IF p_expense_type IS NOT NULL OR p_category IS NOT NULL THEN
    v_type_input := COALESCE(NULLIF(btrim(COALESCE(p_expense_type, '')), ''), v_current.expense_type);
    v_category_input := COALESCE(NULLIF(btrim(COALESCE(p_category, '')), ''), v_current.category);
    IF lower(btrim(v_type_input)) = 'internal bank transfer' THEN
      RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
    END IF;

    SELECT et.id, et.name
    INTO v_type_id, v_type_name
    FROM public.expense_types et
    WHERE et.is_active = true
      AND lower(btrim(et.name)) = lower(v_type_input)
      AND (et.organization_id = p_organization_id OR et.organization_id IS NULL)
    ORDER BY (et.organization_id IS NOT DISTINCT FROM p_organization_id) DESC, et.created_at ASC
    LIMIT 1;
    IF v_type_id IS NULL THEN
      RAISE EXCEPTION 'invalid_master' USING ERRCODE = '22023';
    END IF;

    SELECT ec.id, ec.name
    INTO v_category_id, v_category_name
    FROM public.expense_categories ec
    WHERE ec.is_active = true
      AND ec.expense_type_id = v_type_id
      AND lower(btrim(ec.name)) = lower(v_category_input)
      AND (ec.organization_id = p_organization_id OR ec.organization_id IS NULL)
    ORDER BY (ec.organization_id IS NOT DISTINCT FROM p_organization_id) DESC, ec.created_at ASC
    LIMIT 1;
    IF v_category_id IS NULL THEN
      RAISE EXCEPTION 'invalid_master' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.expenses AS expense
  SET
    expense_name = COALESCE(v_name, expense.expense_name),
    amount = COALESCE(p_amount, expense.amount),
    create_date = COALESCE(v_day, expense.create_date),
    expense_type = COALESCE(v_type_name, expense.expense_type),
    expense_type_id = CASE WHEN v_type_id IS NULL THEN expense.expense_type_id ELSE v_type_id END,
    category = COALESCE(v_category_name, expense.category),
    expense_category_id = CASE WHEN v_category_id IS NULL THEN expense.expense_category_id ELSE v_category_id END,
    description = COALESCE(v_description, expense.description),
    updated_at = now()
  WHERE expense.id = p_id
    AND expense.organization_id = p_organization_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  id := v_row.id;
  expense_name := v_row.expense_name;
  amount := v_row.amount::double precision;
  expense_type := v_row.expense_type;
  category := v_row.category;
  create_date := v_row.create_date;
  status := v_row.status;
  description := v_row.description;
  RETURN NEXT;
END;
$mcp$;

REVOKE ALL ON FUNCTION public.mcp_create_income_transaction(uuid, uuid, text, numeric, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_create_income_transaction(uuid, uuid, text, numeric, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_create_income_transaction(uuid, uuid, text, numeric, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_update_income_transaction(uuid, uuid, uuid, text, numeric, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_update_income_transaction(uuid, uuid, uuid, text, numeric, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_update_income_transaction(uuid, uuid, uuid, text, numeric, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_create_expense(uuid, uuid, text, numeric, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_create_expense(uuid, uuid, text, numeric, text, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_create_expense(uuid, uuid, text, numeric, text, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.mcp_update_expense(uuid, uuid, uuid, text, numeric, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mcp_update_expense(uuid, uuid, uuid, text, numeric, text, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_update_expense(uuid, uuid, uuid, text, numeric, text, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
