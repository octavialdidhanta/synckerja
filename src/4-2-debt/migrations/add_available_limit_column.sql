-- Add available_limit column to debts table
ALTER TABLE debts ADD COLUMN IF NOT EXISTS available_limit NUMERIC(15, 2);

-- Add comment
COMMENT ON COLUMN debts.available_limit IS 'Available limit remaining (limit_amount - used_amount)';
