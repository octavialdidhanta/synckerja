-- Link expense to purchase_request when created from payment-process (one-to-one).

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS purchase_request_id UUID REFERENCES purchase_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_purchase_request_id
ON expenses(purchase_request_id) WHERE purchase_request_id IS NOT NULL;

COMMENT ON COLUMN expenses.purchase_request_id IS 'Reference to purchase request when expense was created from payment-process';
