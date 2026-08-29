/** Display names for Ops Settings Bank Account dropdown (Indonesia + common foreign banks). */
export type IndonesiaBankOption = {
  id: string;
  name: string;
};

export const INDONESIA_BANKS: readonly IndonesiaBankOption[] = [
  { id: "bangkok-bank", name: "Bangkok Bank" },
  { id: "bank-agris", name: "Bank Agris" },
  { id: "bank-amar", name: "Bank Amar Indonesia (formerly Anglomas International Bank)" },
  { id: "bank-anz", name: "Bank ANZ Indonesia" },
  { id: "bank-arta-niaga", name: "Bank Arta Niaga Kencana" },
  { id: "bank-artha-graha", name: "Bank Artha Graha International" },
  { id: "bank-artos", name: "Bank Artos Indonesia" },
  { id: "bank-bisnis", name: "Bank Bisnis Internasional" },
  { id: "bank-bjb", name: "Bank BJB" },
  { id: "bank-bjb-syariah", name: "Bank BJB Syariah" },
  { id: "bank-bnp", name: "Bank BNP Paribas" },
  { id: "bank-bri-agro", name: "Bank BRI Agroniaga" },
  { id: "bank-bukopin", name: "Bank Bukopin" },
  { id: "bank-bumi-arta", name: "Bank Bumi Arta" },
  { id: "bank-capital", name: "Bank Capital Indonesia" },
  { id: "bank-bca", name: "Bank Central Asia (BCA)" },
  { id: "bank-bca-syariah", name: "Bank Central Asia (BCA) Syariah" },
  { id: "bank-chinatrust", name: "Bank Chinatrust Indonesia" },
  { id: "bank-cimb", name: "Bank CIMB Niaga" },
  { id: "bank-cimb-uus", name: "Bank CIMB Niaga UUS" },
  { id: "bank-commonwealth", name: "Bank Commonwealth" },
  { id: "bank-danamon", name: "Bank Danamon" },
  { id: "bank-danamon-uus", name: "Bank Danamon UUS" },
  { id: "bank-dbs", name: "Bank DBS Indonesia" },
  { id: "bank-dinar", name: "Bank Dinar Indonesia" },
  { id: "bank-dki", name: "Bank DKI" },
  { id: "bank-dki-uus", name: "Bank DKI UUS" },
  { id: "bank-fama", name: "Bank Fama International" },
  { id: "bank-ganesha", name: "Bank Ganesha" },
  { id: "bank-hana", name: "Bank Hana" },
  { id: "bank-harda", name: "Bank Harda Internasional" },
  { id: "bank-icbc", name: "Bank ICBC Indonesia" },
  { id: "bank-ina", name: "Bank Ina Perdana" },
  { id: "bank-index", name: "Bank Index Selindo" },
  { id: "bank-jago", name: "Bank Jago" },
  { id: "bank-jasa-jakarta", name: "Bank Jasa Jakarta" },
  { id: "bank-jtrust", name: "Bank JTrust Indonesia (formerly Bank Mutiara)" },
  { id: "bank-kesejahteraan", name: "Bank Kesejahteraan Ekonomi" },
  { id: "bank-mandiri", name: "Bank Mandiri" },
  { id: "bank-maspion", name: "Bank Maspion Indonesia" },
  { id: "bank-mayapada", name: "Bank Mayapada International" },
  { id: "bank-maybank", name: "Bank Maybank (formerly BII)" },
  { id: "bank-maybank-syariah", name: "Bank Maybank Syariah Indonesia" },
  { id: "bank-mayora", name: "Bank Mayora" },
  { id: "bank-mega", name: "Bank Mega" },
  { id: "bank-mestika", name: "Bank Mestika Dharma" },
  { id: "bank-mitra-niaga", name: "Bank Mitra Niaga" },
  { id: "bank-mizuho", name: "Bank Mizuho Indonesia" },
  { id: "bank-mnc", name: "Bank MNC Internasional" },
  { id: "bank-muamalat", name: "Bank Muamalat Indonesia" },
  { id: "bank-mas", name: "Bank Multi Arta Sentosa" },
  { id: "bank-nobu", name: "Bank Nationalnobu" },
  { id: "bank-bni", name: "Bank Negara Indonesia (BNI)" },
  { id: "bank-bnp-parahyangan", name: "Bank Nusantara Parahyangan" },
  { id: "bank-ocbc", name: "Bank OCBC NISP" },
  { id: "bank-ocbc-uus", name: "Bank OCBC NISP UUS" },
  { id: "bank-of-america", name: "Bank of America Merrill-Lynch" },
  { id: "bank-of-china", name: "Bank of China" },
  { id: "bank-of-china-boc", name: "Bank of China (BOC)" },
  { id: "bank-of-india", name: "Bank of India Indonesia" },
  { id: "bank-mufg", name: "Bank of Tokyo Mitsubishi UFJ" },
  { id: "bank-panin", name: "Bank Panin" },
  { id: "bank-panin-syariah", name: "Bank Panin Syariah" },
  { id: "bank-permata", name: "Bank Permata" },
  { id: "bank-permata-uus", name: "Bank Permata UUS" },
  { id: "bank-qnb", name: "Bank QNB Indonesia (formerly Bank QNB Kesawan)" },
  { id: "bank-rabobank", name: "Bank Rabobank International Indonesia" },
  { id: "bank-bri", name: "Bank Rakyat Indonesia (BRI)" },
  { id: "bank-resona", name: "Bank Resona Perdania" },
  { id: "bank-royal", name: "Bank Royal Indonesia" },
  { id: "bank-sahabat-sampoerna", name: "Bank Sahabat Sampoerna" },
  { id: "bank-sbi", name: "Bank SBI Indonesia" },
  { id: "bank-shinhan", name: "Bank Shinhan Indonesia (formerly Bank Metro Express)" },
  { id: "bank-sinarmas-uus", name: "Bank Sinarmas UUS" },
  { id: "bank-sumitomo", name: "Bank Sumitomo Mitsui Indonesia" },
  { id: "bank-syariah-bukopin", name: "Bank Syariah Bukopin" },
  { id: "bank-bsi", name: "Bank Syariah Indonesia (BSI)" },
  { id: "bank-syariah-mega", name: "Bank Syariah Mega" },
  { id: "bank-btn", name: "Bank Tabungan Negara (BTN)" },
  { id: "bank-btn-uus", name: "Bank Tabungan Negara (BTN) UUS" },
  { id: "bank-btpn", name: "Bank Tabungan Pensiunan Nasional" },
  { id: "bank-victoria", name: "Bank Victoria International" },
  { id: "bank-woori", name: "Bank Woori Saudara Indonesia" },
  { id: "bank-yudha", name: "Bank Yudha Bhakti" },
  { id: "bni-syariah", name: "BNI Syariah" },
  { id: "bpd-aceh", name: "BPD Aceh" },
  { id: "bpd-aceh-uus", name: "BPD Aceh UUS" },
  { id: "bpd-bali", name: "BPD Bali" },
  { id: "bpd-bengkulu", name: "BPD Bengkulu" },
  { id: "bpd-diy", name: "BPD Daerah Istimewa Yogyakarta (DIY)" },
  { id: "bpd-diy-uus", name: "BPD Daerah Istimewa Yogyakarta (DIY) UUS" },
  { id: "bpd-jambi", name: "BPD Jambi" },
  { id: "bpd-jateng", name: "BPD Jawa Tengah" },
  { id: "bpd-jateng-uus", name: "BPD Jawa Tengah UUS" },
  { id: "bpd-jatim", name: "BPD Jawa Timur" },
  { id: "bpd-jatim-uus", name: "BPD Jawa Timur UUS" },
  { id: "bpd-kalbar", name: "BPD Kalimantan Barat" },
  { id: "bpd-kalbar-uus", name: "BPD Kalimantan Barat UUS" },
  { id: "bpd-kalsel", name: "BPD Kalimantan Selatan" },
  { id: "bpd-kalsel-uus", name: "BPD Kalimantan Selatan UUS" },
  { id: "bpd-kalteng", name: "BPD Kalimantan Tengah" },
  { id: "bpd-kaltim", name: "BPD Kalimantan Timur" },
  { id: "bpd-kaltim-uus", name: "BPD Kalimantan Timur UUS" },
  { id: "bpd-lampung", name: "BPD Lampung" },
  { id: "bpd-maluku", name: "BPD Maluku" },
  { id: "bpd-ntb", name: "BPD Nusa Tenggara Barat" },
  { id: "bpd-ntb-uus", name: "BPD Nusa Tenggara Barat UUS" },
  { id: "bpd-ntt", name: "BPD Nusa Tenggara Timur" },
  { id: "bpd-papua", name: "BPD Papua" },
  { id: "bpd-riau", name: "BPD Riau Dan Kepri" },
  { id: "bpd-riau-uus", name: "BPD Riau Dan Kepri UUS" },
  { id: "bpd-sulteng", name: "BPD Sulawesi Tengah" },
  { id: "bpd-sultenggara", name: "BPD Sulawesi Tenggara" },
  { id: "bpd-sulselbar", name: "BPD Sulselbar" },
  { id: "bpd-sulselbar-uus", name: "BPD Sulselbar UUS" },
  { id: "bpd-sulut", name: "BPD Sulut" },
  { id: "bpd-sumbar", name: "BPD Sumatera Barat" },
  { id: "bpd-sumbar-uus", name: "BPD Sumatera Barat UUS" },
  { id: "bpd-sumsel", name: "BPD Sumsel Dan Babel" },
  { id: "bpd-sumsel-uus", name: "BPD Sumsel Dan Babel UUS" },
  { id: "bpd-sumut", name: "BPD Sumut" },
  { id: "bpd-sumut-uus", name: "BPD Sumut UUS" },
  { id: "bri-syariah", name: "BRI Syariah" },
  { id: "btpn", name: "BTPN" },
  { id: "btpn-syariah", name: "BTPN Syariah (formerly Bank Sahabat Purba Danarta and Bank Tabungan Pensiunan Nasional UUS)" },
  { id: "centratama", name: "Centratama Nasional Bank" },
  { id: "ccb", name: "China Construction Bank Indonesia (formerly Bank Antar Daerah and Bank Windu Kentjana International)" },
  { id: "citibank", name: "Citibank" },
  { id: "deutsche", name: "Deutsche Bank" },
  { id: "hsbc", name: "Hongkong and Shanghai Bank Corporation (HSBC) (formerly Bank Ekonomi Raharja)" },
  { id: "eximbank", name: "Indonesia Eximbank (formerly Bank Ekspor Indonesia)" },
  { id: "jpmorgan", name: "JP Morgan Chase Bank" },
  { id: "prima-master", name: "Prima Master Bank" },
  { id: "rbs", name: "Royal Bank of Scotland (RBS)" },
  { id: "sinarmas", name: "Sinarmas" },
  { id: "standard-chartered", name: "Standard Chartered Bank" },
  { id: "uob", name: "UOB" },
] as const;

export function filterIndonesiaBanks(query: string): IndonesiaBankOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...INDONESIA_BANKS];
  return INDONESIA_BANKS.filter((b) => b.name.toLowerCase().includes(q));
}

/** Short labels (finance / gateway) → list option id */
const BANK_NAME_ALIASES: Record<string, string> = {
  BCA: "bank-bca",
  "BANK BCA": "bank-bca",
  "BANK CENTRAL ASIA": "bank-bca",
  BNI: "bank-bni",
  "BANK BNI": "bank-bni",
  "BANK NEGARA INDONESIA": "bank-bni",
  BRI: "bank-bri",
  "BANK BRI": "bank-bri",
  "BANK RAKYAT INDONESIA": "bank-bri",
  MANDIRI: "bank-mandiri",
  "BANK MANDIRI": "bank-mandiri",
  PERMATA: "bank-permata",
  "BANK PERMATA": "bank-permata",
  BJB: "bank-bjb",
  "BANK BJB": "bank-bjb",
  BSI: "bank-bsi",
  "BANK SYARIAH INDONESIA": "bank-bsi",
  CIMB: "bank-cimb",
  "CIMB NIAGA": "bank-cimb",
  "BANK CIMB NIAGA": "bank-cimb",
  DANAMON: "bank-danamon",
  "BANK DANAMON": "bank-danamon",
  BTN: "bank-btn",
  "BANK BTN": "bank-btn",
  OCBC: "bank-ocbc",
  "OCBC NISP": "bank-ocbc",
  MEGA: "bank-mega",
  "BANK MEGA": "bank-mega",
  MAYBANK: "bank-maybank",
  PANIN: "bank-panin",
  UOB: "uob",
  "BANK UOB": "uob",
  DBS: "bank-dbs",
  JAGO: "bank-jago",
  "BANK JAGO": "bank-jago",
  // Jenius is BTPN's digital savings product
  JENIUS: "btpn",
  "BANK JENIUS": "btpn",
  BTPN: "btpn",
  "BANK BTPN": "btpn",
};

/**
 * Resolve a stored / typed bank label to a dropdown option.
 * Handles exact names, aliases like "BCA", and "(BCA)" in the option label.
 */
export function resolveIndonesiaBank(
  raw: string | null | undefined,
): IndonesiaBankOption | null {
  const input = (raw ?? "").trim();
  if (!input) return null;

  const exact = INDONESIA_BANKS.find(
    (b) => b.name === input || b.name.toLowerCase() === input.toLowerCase(),
  );
  if (exact) return exact;

  const aliasId = BANK_NAME_ALIASES[input.toUpperCase()];
  if (aliasId) {
    const byAlias = INDONESIA_BANKS.find((b) => b.id === aliasId);
    if (byAlias) return byAlias;
  }

  const upper = input.toUpperCase();
  const byParen = INDONESIA_BANKS.find((b) => {
    const matches = b.name.match(/\(([^)]+)\)/g);
    if (!matches) return false;
    return matches.some((part) => part.slice(1, -1).trim().toUpperCase() === upper);
  });
  if (byParen) return byParen;

  const lower = input.toLowerCase();
  return (
    INDONESIA_BANKS.find(
      (b) =>
        b.name.toLowerCase().includes(lower) ||
        lower.includes(b.name.toLowerCase()),
    ) ?? null
  );
}

/** Canonical display name for persistence / form state. */
export function normalizeIndonesiaBankName(
  raw: string | null | undefined,
): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  // Display names may be "BCA · 8710178926"
  const head = trimmed.split("·")[0]?.trim() || trimmed;
  const resolved = resolveIndonesiaBank(head) ?? resolveIndonesiaBank(trimmed);
  if (resolved) return resolved.name;
  return head;
}
