-- Full catalog of app routes in permission_configuration_defaults + backfill per organization.
-- Safe to re-run: ON CONFLICT updates template; org rows inserted only when missing.

INSERT INTO public.permission_configuration_defaults (
  page_path,
  page_title,
  is_active,
  roles_allowed,
  job_levels_allowed,
  exceptions,
  exception_paths
)
VALUES
  ('/', 'Beranda', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/dashboard', 'Dashboard', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/employee-management', 'Employee Management (legacy)', true, ARRAY['owner', 'admin']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/employees', 'Halaman Employees', true, ARRAY['owner', 'admin']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/employees/add', 'Tambah Karyawan', true, ARRAY['owner', 'admin', 'hr']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/employees/reprimand', 'Reprimand', true, ARRAY['owner', 'admin', 'hr']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  (
    '/recruitment',
    'Recruitment',
    true,
    ARRAY['owner', 'admin']::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY['/recruitment/interviewees']::text[]
  ),
  ('/access-permissions', 'Access Permissions', true, ARRAY['owner']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/access-permissions/page-access', 'Page Access', true, ARRAY['owner']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/access-permissions/overview', 'Access Overview', true, ARRAY['owner']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/access-permissions/roles', 'Access Roles', true, ARRAY['owner']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/access-permissions/pages', 'Access Pages', true, ARRAY['owner']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/subscription', 'Subscription', true, ARRAY['owner']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/transfer-ownership', 'Transfer Ownership', true, ARRAY['owner']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/settings', 'Settings', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/reports', 'Laporan (mobile)', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/company/dashboard', 'Company Dashboard', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/company/company-assets', 'Company Assets', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/company/files', 'Company Files', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/company/organization', 'Company Organization', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/incomes/dashboard', 'Incomes Dashboard', true, ARRAY['owner', 'admin', 'hr']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/incomes/transaction', 'Incomes Transactions', true, ARRAY['owner', 'admin', 'hr']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/expenses/dashboard', 'Expenses Dashboard', true, ARRAY['owner', 'admin', 'hr']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/expenses/debt', 'Expenses Debt', true, ARRAY['owner', 'admin', 'hr']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/expenses/approvals', 'Expenses Approvals', true, ARRAY['owner', 'admin', 'hr']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/expenses/payment-process', 'Expenses Payment Process', true, ARRAY['owner', 'admin', 'hr']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/expenses/reminder-bills', 'Expenses Reminder Bills', true, ARRAY['owner', 'admin', 'hr']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/payroll/calculations', 'Payroll', true, ARRAY['owner', 'admin', 'hr']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/attendance', 'Attendance', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/okr', 'OKR', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/my-info', 'Informasi Saya', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/request-form/purchase', 'Request Form — Purchase', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/request-form/reimbursement', 'Request Form — Reimbursement', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/request-form/cash-advance', 'Request Form — Cash Advance', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/request-form/loan', 'Request Form — Loan', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/tools/daily-task', 'Daily Task', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/tools/daily-task-report', 'Daily Task Report', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/tools/meeting-notes', 'Meeting Notes', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/tools/habits-tracker', 'Habits Tracker', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/tools/password-manager', 'Password Manager', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/tools/pph21-calculator', 'PPh21 Calculator', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/tools/default-prices', 'Default Prices', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/tools/pricing-tools', 'Pricing Tools', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/tools/promo-simulation', 'Promo Simulation', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/tools/calculator', 'Calculator', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/operations/sales', 'Operations Sales', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/operations/consultant/dashboard', 'CRM Dashboard', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/operations/consultant/leads-management', 'Leads Management', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/operations/consultant/whatsapp/connect', 'Connect WhatsApp', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/operations/consultant/instagram/connect', 'Connect Instagram', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/operations/consultant/email/connect', 'Connect Email', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/operations/consultant/all/livechat', 'Livechat', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/operations/consultant/whatsapp/templates', 'WhatsApp Templates', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/kol-management/dashboard', 'KOL Dashboard', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/kol-management/kol-management', 'KOL Management', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/kol-management/campaigns', 'KOL Campaigns', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/kol-management/content-post', 'KOL Content Post', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  ('/kol-management/payment-terms', 'KOL Payment Terms', true, ARRAY['owner', 'admin', 'hr', 'employee']::text[], ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]),
  (
    '/digital-marketing',
    'Digital Marketing',
    true,
    ARRAY['owner', 'admin', 'hr', 'employee']::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    ARRAY[]::text[]
  )
ON CONFLICT (page_path) DO UPDATE SET
  page_title = EXCLUDED.page_title,
  is_active = EXCLUDED.is_active,
  roles_allowed = EXCLUDED.roles_allowed,
  job_levels_allowed = EXCLUDED.job_levels_allowed,
  exceptions = EXCLUDED.exceptions,
  exception_paths = EXCLUDED.exception_paths,
  updated_at = now();

-- Copy any missing template paths into each organization's permission_configurations
INSERT INTO public.permission_configurations (
  organization_id,
  page_path,
  page_title,
  is_active,
  roles_allowed,
  job_levels_allowed,
  exceptions,
  exception_paths
)
SELECT
  o.id,
  d.page_path,
  d.page_title,
  d.is_active,
  d.roles_allowed,
  d.job_levels_allowed,
  d.exceptions,
  d.exception_paths
FROM public.organizations o
CROSS JOIN public.permission_configuration_defaults d
WHERE NOT EXISTS (
  SELECT 1
  FROM public.permission_configurations p
  WHERE p.organization_id = o.id
    AND p.page_path = d.page_path
);
