export function formatPhoneToWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("62")) return `+${digits}`;
  if (digits.startsWith("0")) return `+62${digits.slice(1)}`;
  return `+${digits}`;
}

export function createWhatsAppMessage(
  candidateName: string,
  position: string,
  organizationName: string,
  profileLink: string,
  interviewDetails: {
    date?: string;
    time?: string;
    location?: string;
    interviewer?: string;
  },
): string {
  const lines = [
    `Halo ${candidateName},`,
    "",
    `Kami dari ${organizationName} mengundang Anda untuk wawancara posisi ${position}.`,
  ];
  if (interviewDetails.date) lines.push(`Tanggal: ${interviewDetails.date}`);
  if (interviewDetails.time) lines.push(`Waktu: ${interviewDetails.time}`);
  if (interviewDetails.location) lines.push(`Lokasi: ${interviewDetails.location}`);
  if (interviewDetails.interviewer) lines.push(`Pewawancara: ${interviewDetails.interviewer}`);
  if (profileLink) {
    lines.push("", `Profil kandidat: ${profileLink}`);
  }
  return lines.join("\n");
}
