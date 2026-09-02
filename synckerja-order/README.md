# Synckerja Order

Public QR dine-in storefront (`order.synckerja.com`) plus Office backoffice tabs.

- Host `order.synckerja.com` boots only `0-storefront` (see `src/main.tsx` + `VITE_PUBLIC_ORDER_HOSTNAME`).
- Office imports the same package for activation, catalog opt-in, and table QR print.
- `{code}` is `pos_outlets.public_code` (6 chars a-z0-9, globally unique). Tenant scope is resolved only from that code via SECURITY DEFINER RPCs — clients never send `organization_id` / `outlet_id` as authority.
