-- Add withdrawal_from_balance column to expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS withdrawal_from_balance UUID REFERENCES debts(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_expenses_withdrawal_from_balance ON expenses(withdrawal_from_balance);

-- Add comment
COMMENT ON COLUMN expenses.withdrawal_from_balance IS 'Reference to debt account from which this expense was withdrawn';
