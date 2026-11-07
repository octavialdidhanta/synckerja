# Synckerja Order — floating WhatsApp button

Shows a WhatsApp button (bottom-right) on the public storefront `order.synckerja.com/{code}`.

## Rules

1. Number source is **omnichannel WhatsApp only** (`organization_whatsapp_accounts`, connected at `/omnichannel/integrations/whatsapp`). `synckerja_order_org_settings.contact_whatsapp` is not used here.
2. Office → Synckerja Order → **Outlets** has two columns per outlet:
   - **WhatsApp** dropdown ("Pilih WhatsApp"). Saves on select. "Tanpa WhatsApp" hides the button.
   - **Pesan pembuka** text (≤ 300 chars, `{outlet}` / `{meja}` placeholders). Auto-saves 1s after typing and on blur.
3. The outlet must always pick a number in the dropdown — even when only one account is connected. No pick → no button.
4. A picked account that is disconnected / inactive hides the button.

## Data & security

- Columns on `synckerja_order_outlet_settings`: `whatsapp_button_enabled`, `whatsapp_account_id`, `whatsapp_prefill_message`
  (migrations `20261107090000_synckerja_order_outlet_whatsapp.sql` + `20261107100000_synckerja_order_whatsapp_explicit_pick.sql`).
- Trigger rejects an account from another organization (`whatsapp_account_not_in_organization`).
- Storefront reads `get_public_synckerja_order_whatsapp(p_code)` (SECURITY DEFINER, anon). It returns **only** `phone_digits` and `prefill_message` — never tokens. Tenant comes from the public code, like the other storefront RPCs.
- Backoffice selects only `id, whatsapp_business_name, display_phone_number` from the accounts table.

## Layout

```
6-whatsapp/
  components/  OutletWhatsAppSelect, OutletWhatsAppMessageInput (Office) · OrderWhatsAppFloatingButton (storefront)
  hooks/       useSynckerjaOrderOutletWhatsApp (Office) · usePublicOrderWhatsApp (storefront)
  lib/         orderWhatsApp (pure helpers + tests) · fetchPublicOrderWhatsApp (RPC)
```

Icon: `public/synckerja-order/whatsapp.png` (192px, rendered at 52px).
