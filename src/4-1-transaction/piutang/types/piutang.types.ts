export type PiutangFilterMode = 'open' | 'settled' | 'all';

/** Filter aktivitas berdasarkan agregat status verifikasi pembayaran. */
export type PiutangVerificationFilterMode = 'all' | 'unchecked' | 'approved' | 'rejected';

/** Agregat per sales_activity dari semua baris pembayaran. */
export type PiutangVerificationAggregate = 'none' | 'unchecked' | 'approved' | 'rejected';
