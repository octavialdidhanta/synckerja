-- Complete default taxonomy for password_categories (idempotent).
-- Supplements 20260430514000_password_manager_synckerja_reference.sql (General, Tools, Tutorial).

INSERT INTO public.password_categories (name, icon, created_at, updated_at)
SELECT v.name, v.icon, timezone('utc'::text, now()), timezone('utc'::text, now())
FROM (
  VALUES
    ('Email', 'mail'),
    ('Finance', 'card'),
    ('Social', 'globe'),
    ('Work', 'briefcase'),
    ('Entertainment', 'sparkles'),
    ('Shopping', 'shopping-bag'),
    ('Health', 'heart'),
    ('Other', 'lock')
) AS v(name, icon)
WHERE NOT EXISTS (
  SELECT 1 FROM public.password_categories c WHERE c.name = v.name
);
