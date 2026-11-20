-- Add withdrawal_from_balance and bank_account_id to purchase_requests
-- so approval/payment-process can store funding source (debt or bank account).

ALTER TABLE purchase_requests
ADD COLUMN IF NOT EXISTS withdrawal_from_balance UUID REFERENCES debts(id) ON DELETE SET NULL;

ALTER TABLE purchase_requests
ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_requests_withdrawal_from_balance
ON purchase_requests(withdrawal_from_balance) WHERE withdrawal_from_balance IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_requests_bank_account_id
ON purchase_requests(bank_account_id) WHERE bank_account_id IS NOT NULL;

COMMENT ON COLUMN purchase_requests.withdrawal_from_balance IS 'Debt account from which payment will be withdrawn (set at approval or payment-process)';
COMMENT ON COLUMN purchase_requests.bank_account_id IS 'Bank account from which payment will be withdrawn (set at approval or payment-process)';
