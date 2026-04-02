-- Migration: Add paid_by_user_id and paid_by_name fields to purchase_requests table
-- Description: Allows tracking who processed the payment when invoice is uploaded
-- Created: 2025-01-XX

-- Add paid_by_user_id column to purchase_requests table
ALTER TABLE purchase_requests
ADD COLUMN IF NOT EXISTS paid_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add paid_by_name column to purchase_requests table
ALTER TABLE purchase_requests
ADD COLUMN IF NOT EXISTS paid_by_name TEXT;

-- Add comments to document the fields
COMMENT ON COLUMN purchase_requests.paid_by_user_id IS 'User ID of the person who processed the payment (uploaded invoice)';
COMMENT ON COLUMN purchase_requests.paid_by_name IS 'Name of the person who processed the payment (uploaded invoice)';
