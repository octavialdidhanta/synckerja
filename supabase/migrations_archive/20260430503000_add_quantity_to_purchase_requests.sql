-- Number of physical units for Physical Item requests; one company_assets row per unit.

ALTER TABLE purchase_requests
ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN purchase_requests.quantity IS 'Number of physical units for Physical Item requests; used to create one company_assets row per unit.';
