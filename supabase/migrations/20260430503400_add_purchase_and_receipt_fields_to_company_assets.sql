-- Link company_assets to purchase request / expense and track receipt confirmation.

ALTER TABLE company_assets
ADD COLUMN IF NOT EXISTS purchase_request_id uuid REFERENCES purchase_requests(id) ON DELETE SET NULL;

ALTER TABLE company_assets
ADD COLUMN IF NOT EXISTS expense_id uuid REFERENCES expenses(id) ON DELETE SET NULL;

ALTER TABLE company_assets
ADD COLUMN IF NOT EXISTS receipt_confirmed_at timestamptz;

ALTER TABLE company_assets
ADD COLUMN IF NOT EXISTS receipt_confirmed_by uuid;

CREATE INDEX IF NOT EXISTS idx_company_assets_purchase_request_id
ON company_assets(purchase_request_id) WHERE purchase_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_company_assets_receipt_pending
ON company_assets(receipt_confirmed_at) WHERE receipt_confirmed_at IS NULL AND purchase_request_id IS NOT NULL;

COMMENT ON COLUMN company_assets.purchase_request_id IS 'Link to purchase request when asset was created from Physical Item flow';
COMMENT ON COLUMN company_assets.expense_id IS 'Link to expense record from payment-process';
COMMENT ON COLUMN company_assets.receipt_confirmed_at IS 'When set, item has been confirmed received by management; null = pending receipt check';
COMMENT ON COLUMN company_assets.receipt_confirmed_by IS 'User who confirmed receipt (Admin)';
