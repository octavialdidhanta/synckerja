-- Remove orphan ledger-only bank mutations (v2) without live disbursement.
-- Re-run safe: only touches APPROVALS_SANDBOX_v2 markers.

DELETE FROM public.bank_mutation_matches bmm
USING public.bank_statement_lines bsl
WHERE bmm.statement_line_id = bsl.id
  AND bsl.description LIKE '%APPROVALS_SANDBOX_v2%';

DELETE FROM public.bank_statement_lines
WHERE description LIKE '%APPROVALS_SANDBOX_v2%';

DELETE FROM public.expenses
WHERE expense_name LIKE '%APPROVALS_SANDBOX_v2%';
