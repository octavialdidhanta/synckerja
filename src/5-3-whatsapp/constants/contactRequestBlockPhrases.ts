/**
 * Daftar frasa yang mengindikasikan permintaan nomor kontak (telepon, WhatsApp, email).
 * Dipakai untuk pemblokiran pesan (Opsi 1: tanpa schema DB).
 * Default ON. Nonaktifkan: VITE_WHATSAPP_BLOCK_CONTACT_REQUESTS=false (frontend), WHATSAPP_BLOCK_CONTACT_REQUESTS=false (webhook).
 */

const PHRASES: readonly string[] = [
  // Kata satuan (single words) — memblokir "nomor mba nya berapa?", "wa berapa mba?", "tlp berapa", dll.
  "nomor",
  "wa",
  "whatsapp",
  "hp",
  "telepon",
  "telpon",
  "tlp",
  "tlpn",
  "telephone",
  "email",
  "kontak",
  "contact",
  // Nomor telepon / WhatsApp (frasa)
  "nomor hp",
  "nomor telepon",
  "nomor wa",
  "nomor whatsapp",
  "no hp",
  "no telepon",
  "no wa",
  "no whatsapp",
  "number wa",
  "whatsapp number",
  "hp kamu",
  "telepon kamu",
  "wa kamu",
  "kirim nomor",
  "beri nomor",
  "bagi nomor",
  "share nomor",
  "kontak kamu",
  "kontak anda",
  "nomor kontak",
  "no kontak",
  "bisa wa",
  "bisa chat wa",
  "chat wa dong",
  "wa saja",
  "hubungi wa",
  "whatsapp saja",
  "dm wa",
  "invite wa",
  "add wa",
  "nomor untuk dihubungi",
  "nomor yang bisa dihubungi",
  "no yang bisa dihubungi",
  // Email
  "email kamu",
  "email anda",
  "alamat email",
  "e-mail",
  "kirim email",
  "beri email",
  "bagi email",
  "share email",
  "kontak email",
  "email untuk konfirmasi",
  "email untuk dihubungi",
  "dm email",
  "send email",
  "your email",
  "email address",
  // Kontak umum
  "cara menghubungi",
  "cara hubungi",
  "bagaimana menghubungi",
  "how to contact",
  "contact you",
  "hubungi kamu",
  "nomor atau email",
  "no atau email",
  "line kamu",
  "id line",
  "telegram",
  "ig kamu",
  "instagram kamu",
  "sosmed",
  "media sosial",
  // Pola pertanyaan
  "minta nomor wa",
  "minta nomor",
  "berapa nomor",
  "apa nomor",
  "bisa minta nomor",
  "boleh minta nomor",
  "bisa minta kontak",
  "boleh minta kontak",
  "bisa minta email",
  "boleh minta email",
  "bisa kasih nomor",
  "boleh kasih nomor",
  "bisa share nomor",
  "boleh share nomor",
  "what's your number",
  "what's your email",
  "whatsapp number",
  "phone number",
  "contact number",
  "can i get your number",
  "can i get your email",
  "give me your number",
  "give me your email",
  "send me your number",
  "send me your email",
  "share your number",
  "share your email",
  "drop your number",
  "drop your email",
  "dm your number",
  "dm your email",
];

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Mengembalikan true jika teks mengandung salah satu frasa yang mengindikasikan permintaan kontak.
 */
export function messageContainsContactRequest(text: string | null | undefined): boolean {
  if (text == null || text === "") return false;
  const normalized = normalizeForMatch(text);
  if (normalized.length === 0) return false;
  return PHRASES.some((phrase) => normalized.includes(phrase));
}
