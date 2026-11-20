-- Normalize free-text bank_accounts.bank_name to Ops Settings dropdown labels
-- and backfill gateway_payout_bank_code where a known Xendit code exists.

UPDATE public.bank_accounts AS ba
SET
  bank_name = m.canonical_name,
  gateway_payout_bank_code = COALESCE(
    NULLIF(btrim(ba.gateway_payout_bank_code), ''),
    m.gateway_code
  ),
  updated_at = now()
FROM (
  VALUES
    ('BCA', 'Bank Central Asia (BCA)', 'BCA'),
    ('BANK BCA', 'Bank Central Asia (BCA)', 'BCA'),
    ('BANK CENTRAL ASIA', 'Bank Central Asia (BCA)', 'BCA'),
    ('BNI', 'Bank Negara Indonesia (BNI)', 'BNI'),
    ('BANK BNI', 'Bank Negara Indonesia (BNI)', 'BNI'),
    ('BRI', 'Bank Rakyat Indonesia (BRI)', 'BRI'),
    ('BANK BRI', 'Bank Rakyat Indonesia (BRI)', 'BRI'),
    ('MANDIRI', 'Bank Mandiri', 'MANDIRI'),
    ('BANK MANDIRI', 'Bank Mandiri', 'MANDIRI'),
    ('PERMATA', 'Bank Permata', 'PERMATA'),
    ('BANK PERMATA', 'Bank Permata', 'PERMATA'),
    ('BJB', 'Bank BJB', 'BJB'),
    ('BSI', 'Bank Syariah Indonesia (BSI)', 'BSI'),
    ('CIMB', 'Bank CIMB Niaga', 'CIMB'),
    ('CIMB NIAGA', 'Bank CIMB Niaga', 'CIMB'),
    ('DANAMON', 'Bank Danamon', NULL),
    ('BTN', 'Bank Tabungan Negara (BTN)', NULL),
    ('OCBC', 'Bank OCBC NISP', NULL),
    ('OCBC NISP', 'Bank OCBC NISP', NULL),
    ('MEGA', 'Bank Mega', NULL),
    ('MAYBANK', 'Bank Maybank (formerly BII)', NULL),
    ('PANIN', 'Bank Panin', NULL),
    ('UOB', 'UOB', NULL),
    ('BANK UOB', 'UOB', NULL),
    ('DBS', 'Bank DBS Indonesia', NULL),
    ('JAGO', 'Bank Jago', NULL),
    ('JENIUS', 'BTPN', NULL),
    ('BANK JENIUS', 'BTPN', NULL),
    ('BTPN', 'BTPN', NULL)
) AS m(alias, canonical_name, gateway_code)
WHERE upper(btrim(ba.bank_name)) = m.alias
  AND ba.bank_name IS DISTINCT FROM m.canonical_name;

COMMENT ON TABLE public.bank_accounts IS
  'Org bank accounts. bank_name should prefer Ops Settings Indonesia bank dropdown labels.';
