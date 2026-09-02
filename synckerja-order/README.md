# Synckerja Order

Public QR dine-in storefront (`order.synckerja.com`) plus Office backoffice tabs.

- Host `order.synckerja.com` boots only `0-storefront` (see `src/main.tsx` + `VITE_PUBLIC_ORDER_HOSTNAME`).
- Office imports the same package for activation, catalog opt-in, and table QR print.
- `{code}` is `pos_outlets.public_code` (6 chars a-z0-9, globally unique). Tenant scope is resolved only from that code via SECURITY DEFINER RPCs — clients never send `organization_id` / `outlet_id` as authority.

## Local / LAN testing

Vite serves Office + storefront on the same port (default `8080`). On the same Wi‑Fi, open Office via your LAN IP (e.g. `http://192.168.1.129:8080`), not only `localhost`, so QR links and phone scans share a reachable host.

- In **DEV**, QR URLs use `window.location.origin` (keeps host + port). Opening `https://order.synckerja.com` without a public deploy will show `ERR_CONNECTION_REFUSED` — that host is not your local `:8080`.
- Optional override: set `VITE_PUBLIC_ORDER_ORIGIN=http://192.168.1.129:8080` in `.env.local`, then restart Vite.
