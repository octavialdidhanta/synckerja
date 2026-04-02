-- Create debts table
CREATE TABLE IF NOT EXISTS debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    debt_name TEXT NOT NULL,
    debt_type TEXT NOT NULL,
    bank_name TEXT,
    limit_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    used_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    debt_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    interest_rate NUMERIC(5, 2),
    due_date DATE,
    minimum_payment NUMERIC(15, 2),
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid_off', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for debts
CREATE INDEX IF NOT EXISTS idx_debts_organization_id ON debts(organization_id);
CREATE INDEX IF NOT EXISTS idx_debts_created_by ON debts(created_by);
CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);
CREATE INDEX IF NOT EXISTS idx_debts_debt_type ON debts(debt_type);
CREATE INDEX IF NOT EXISTS idx_debts_created_at ON debts(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_debts_updated_at
    BEFORE UPDATE ON debts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for debts
CREATE POLICY "Users can view organization debts"
    ON debts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM profiles p
            WHERE p.user_id = auth.uid()
                AND p.active_organization_id = debts.organization_id
        )
    );

CREATE POLICY "Users can insert organization debts"
    ON debts
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles p
            WHERE p.user_id = auth.uid()
                AND p.active_organization_id = debts.organization_id
        )
    );

CREATE POLICY "Users can update organization debts"
    ON debts
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM profiles p
            WHERE p.user_id = auth.uid()
                AND p.active_organization_id = debts.organization_id
        )
    );

CREATE POLICY "Users can delete organization debts"
    ON debts
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1
            FROM profiles p
            WHERE p.user_id = auth.uid()
                AND p.active_organization_id = debts.organization_id
        )
    );

-- Comments
COMMENT ON TABLE debts IS 'Stores debt records per organization';
COMMENT ON COLUMN debts.limit_amount IS 'Total limit/plafon available';
COMMENT ON COLUMN debts.used_amount IS 'Amount already used from limit';
COMMENT ON COLUMN debts.debt_amount IS 'Actual debt amount (same as used_amount - the amount that has been used)';
