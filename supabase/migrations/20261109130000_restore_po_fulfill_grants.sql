-- Kembalikan EXECUTE untuk authenticated pada dua RPC yang dipanggil langsung oleh halaman Purchase Order.
--
-- Hardening gelombang 2 (20261102150000) mencabut EXECUTE dari authenticated pada:
--   - fulfill_catalog_purchase_order  -> tombol "Mark as Fulfilled" gagal: permission denied (42501)
--   - user_has_inventory_feature_access -> cek akses "PO Fulfillment" gagal, tombol terkunci di mode Advanced
-- Mode Simple tidak terdampak karena create_catalog_purchase_order (SECURITY DEFINER) memanggil fulfill dari dalam.
--
-- Aman dibuka untuk authenticated:
--   - fulfill_catalog_purchase_order menolak organisasi di luar user_organization_ids() (auth.uid()),
--     menolak PO yang bukan 'waiting', dan bila ada purchase request: wajib akses po_fulfillment (Advanced)
--     serta purchase request approved + paid.
--   - user_has_inventory_feature_access hanya menjawab akses pemanggil sendiri (get_user_role_in_org pakai auth.uid()).
-- anon tetap tidak punya EXECUTE.
--
-- Diverifikasi 9 Nov 2026 di transaksi yang di-rollback (org Synckerja Office, mode Advanced):
-- fulfill sebelum bayar ditolak, setelah approved+paid berhasil (stok 7 -> 10), fulfill kedua ditolak.

REVOKE EXECUTE ON FUNCTION public.fulfill_catalog_purchase_order(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fulfill_catalog_purchase_order(uuid,uuid,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.user_has_inventory_feature_access(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_inventory_feature_access(uuid,text) TO authenticated, service_role;
