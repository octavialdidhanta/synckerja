# Payroll: optional Supabase RPCs

The UI can call these RPCs if they exist on your Supabase project (as in the reference backend). If they are missing, create them in the reference project and copy the SQL, or deploy equivalent Edge Functions.

| RPC | Used by |
|-----|---------|
| `process_payroll_run(run_id uuid)` | `PayrollRunsOverview` — batch calculation for a run |
| `calculate_payroll_run_totals(run_id uuid)` | `CreatePayrollRunDialog` — refresh totals after creating a run |
| `create_default_tax_configuration(org_id uuid)` | Reference `CreatePayrollRunDialog` — replaced in app by inserting a default row into `tax_configurations` |

After adding RPCs, regenerate types if you use generated `Database` types.
