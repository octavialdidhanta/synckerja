import type { ProductKnowledge } from '../hooks/useProductKnowledge';

export type AudienceMode = 'B2B' | 'B2C';

function formatCompetitiveAdvantage(competitiveAdvantage: unknown): string {
  if (competitiveAdvantage == null) return '';
  if (typeof competitiveAdvantage === 'string') return competitiveAdvantage;
  if (Array.isArray(competitiveAdvantage)) {
    return competitiveAdvantage.filter(Boolean).join('\n');
  }
  return JSON.stringify(competitiveAdvantage);
}

function buildSharedBody(rows: ProductKnowledge[]): string[] {
  const lines: string[] = [];
  lines.push('');
  lines.push('**KONSTRAIN UTAMA (WAJIB DIPATUHI):**');
  lines.push('- Semua output HARUS mengacu HANYA pada kolom Feature dan Feature Description (serta Solution dan Competitive Advantage bila ada) dari product knowledge yang disediakan di bawah.');
  lines.push('- Kolom Solution di hasil Anda HARUS merepresentasikan fitur/solusi dari product knowledge tersebut; JANGAN mengarang solusi di luar Feature dan Feature Description yang diberikan.');
  lines.push('- Yang BOLEH berbeda antar 3 baris: konteks masalah (siapa persona, masalah spesifik apa, dampak apa). Tetapi setiap masalah tersebut HARUS dapat diselesaikan dengan Feature yang sama dari product knowledge.');
  lines.push('- JANGAN melenceng ke fitur atau solusi lain yang tidak tercantum di product knowledge. Satu set Feature/Feature Description = satu acuan untuk semua baris hasil.');
  lines.push('');
  lines.push('**STRUKTUR TABEL WAJIB:**');
  lines.push('| Solution | Customer Persona | Problem | Impact | Wants | Needs | Hidden Needs | False Belief | False Belief Impact | What Makes Them Stop? |');
  lines.push('|----------|------------------|---------|--------|-------|-------|--------------|--------------|---------------------|------------------------|');
  lines.push('');
  lines.push('**INSTRUKSI DETAIL SETIAP KOLOM:**');
  lines.push('');
  lines.push('1. **Solution:**');
  lines.push('   - WAJIB: Ambil langsung dari product knowledge (Feature, Feature Description, Solution, Competitive Advantage) yang disediakan di bawah. Kolom Solution di hasil = representasi fitur/solusi yang sudah diberikan.');
  lines.push('   - Jika kolom Solution di product knowledge kosong, berikan IDE SOLUSI yang tetap berdasarkan HANYA Feature dan Feature Description baris tersebut.');
  lines.push('   - JANGAN menambah atau mengubah ke fitur/solusi lain di luar data yang disediakan.');
  lines.push('');
  lines.push('2. **Customer Persona:**');
  lines.push('   - Profil singkat dengan: A) Karakteristik utama, B) Pola pikir atau kebiasaan spesifik.');
  lines.push('   - HARUS konsisten dengan Feature dan Feature Description (persona yang relevan dengan fitur tersebut).');
  lines.push('');
  lines.push('3. **Problem (Permasalahan):**');
  lines.push('   - Deskripsi masalah spesifik yang dialami. Gunakan bahasa konkret dan spesifik.');
  lines.push('   - WAJIB: Setiap masalah yang Anda tulis HARUS dapat diselesaikan oleh Feature yang diberikan di product knowledge. Tiga baris = tiga variasi masalah yang berbeda, tetapi semuanya terjawab oleh fitur yang sama.');
  lines.push('');
  lines.push('4. **Impact (Dampak):**');
  lines.push('   - Jelaskan DAMPAK NYATA dalam 3 aspek: a) Operasional, b) Finansial, c) Reputasi.');
  lines.push('   - Dampak harus konsekuensi logis dari Problem yang tetap terkait dengan konteks Feature.');
  lines.push('');
  lines.push('5. **Wants (Keinginan):** Apa yang DIINGINKAN (dream mereka ketika menjalankan bisnis/usaha). Harus selaras dengan kebutuhan yang bisa dipenuhi oleh Feature tersebut.');
  lines.push('');
  lines.push('6. **Needs (Kebutuhan):** Apa yang SEBENARNYA DIBUTUHKAN. Harus mengarah ke solusi yang sesuai dengan Feature dan Feature Description yang diberikan.');
  lines.push('');
  lines.push('7. **Hidden Needs (Kebutuhan Tersembunyi):** Kebutuhan yang tidak diucapkan tapi krusial. Tetap dalam konteks persona dan fitur yang sama.');
  lines.push('');
  lines.push('8. **False Belief (Keyakinan Salah):** Asumsi atau keyakinan KELIRU atau sesuatu yang suka dianggap sepele.');
  lines.push('');
  lines.push('9. **False Belief Impact:** Konsekuensi NYATA dari keyakinan salah tersebut; harus menunjukkan eskalsi masalah.');
  lines.push('');
  lines.push('10. **What Makes Them Stop?** Titik kritis dimana mereka akhirnya menyerah/berhenti.');
  lines.push('');
  return lines;
}

function buildKriteriaB2B(placeholder: string): string[] {
  return [
    '**KRITERIA TAMBAHAN:**',
    '- RANGE MASALAH: Cakup berbagai aspek (administratif, operasional, pemasaran, teknis) tetapi SEMUA harus bisa diselesaikan oleh Feature yang sama dari product knowledge.',
    '- TINGKAT KEDALAMAN: Problem spesifik; Impact terukur dan realistis; False Belief Impact lebih parah dari Impact awal.',
    '- PRINSIP ESKALASI: False Belief → Blind Spot → Tidak ada pencegahan → Masalah muncul → Impact lebih besar.',
    '- KONTEKS INDUSTRI: Sesuaikan dengan realitas industri ' + placeholder + '.',
    '- FORMAT OUTPUT: Tabel markdown dengan header persis seperti di atas, baris pemisah, lalu tepat 3 baris data. Satu baris per row; jangan wrap teks di dalam cell.',
    '- PENTING: Setiap baris hasil = satu variasi masalah/persona yang BERBEDA, tetapi Solution dan kemampuan penyelesaian tetap dari Feature/Feature Description yang sama. Jangan keluar dari acuan product knowledge.',
  ];
}

function buildKriteriaB2C(placeholder: string): string[] {
  return [
    '**KRITERIA TAMBAHAN:**',
    '- RANGE MASALAH: Cakup berbagai aspek (administratif, operasional, pemasaran, teknis) tetapi SEMUA harus bisa diselesaikan oleh Feature yang sama dari product knowledge.',
    '- TINGKAT KEDALAMAN: Problem spesifik; Impact terukur dan realistis; False Belief Impact lebih parah dari Impact awal.',
    '- PRINSIP ESKALASI: False Belief → Blind Spot → Tidak ada pencegahan → Masalah muncul → Impact lebih besar.',
    '- KONTEKS KONSUMEN: Sesuaikan dengan realitas segmen konsumen ' + placeholder + '.',
    '- FORMAT OUTPUT: Tabel markdown dengan header persis seperti di atas, baris pemisah, lalu tepat 3 baris data. Satu baris per row; jangan wrap teks di dalam cell.',
    '- PENTING: Setiap baris hasil = satu variasi masalah/persona yang BERBEDA, tetapi Solution dan kemampuan penyelesaian tetap dari Feature/Feature Description yang sama. Jangan keluar dari acuan product knowledge.',
  ];
}

function buildProductKnowledgeRows(rows: ProductKnowledge[]): string[] {
  const lines: string[] = [];
  if (rows.length === 0) {
    lines.push('(Tidak ada data product knowledge. Isi minimal Feature dan Feature Description di tabel.)');
  } else {
    // Deduplicate by feature: satu baris per unik Feature + Feature Description (hindari pengulangan sama di prompt)
    const seen = new Set<string>();
    const uniqueRows: ProductKnowledge[] = [];
    for (const row of rows) {
      const key = `${row.feature_id ?? ''}|${(row.feature_name ?? '').trim()}|${(row.feature_description ?? '').trim()}`;
      if (key && !seen.has(key)) {
        seen.add(key);
        uniqueRows.push(row);
      }
    }
    uniqueRows.forEach((row, idx) => {
      const solutionLabel = row.solusi?.trim()
        ? row.solusi
        : '(kosong - berikan ide solusi berdasarkan Feature dan Feature Description yang sudah di sediakan)';
      const compAdv = formatCompetitiveAdvantage(row.competitive_advantage);
      lines.push(`--- Baris ${idx + 1} ---`);
      lines.push(`Feature: ${row.feature_name?.trim() || '(kosong)'}`);
      lines.push(`Feature Description: ${row.feature_description?.trim() || '(kosong)'}`);
      lines.push(`Solution: ${solutionLabel}`);
      lines.push(`Competitive Advantage: ${compAdv || '(kosong)'}`);
      lines.push('');
    });
  }
  return lines;
}

/**
 * Builds the full prompt for Product Knowledge AI generate.
 * When targetRowId is provided, only that row is included in "PRODUCT KNOWLEDGE YANG WAJIB DIJADIKAN ACUAN" (baris yang diklik "Generate prompt tanpa AI").
 * When targetRowId is null/undefined, all rows are included (deduplicated by feature).
 */
export function buildProductKnowledgePrompt(
  mode: AudienceMode,
  contextValue: string,
  rows: ProductKnowledge[],
  targetRowId?: string | null
): string {
  const rowsForPrompt =
    targetRowId != null
      ? rows.filter((r) => r.id === targetRowId)
      : rows;

  const trimmed = contextValue.trim();
  const placeholderB2B = trimmed || '[ISI INDUSTRI]';
  const placeholderB2C = trimmed || '[SEGMEN KONSUMEN]';

  const introB2B = `Anda adalah konsultan bisnis dan analis pasar untuk industri ${placeholderB2B}. Buatkan 3 permasalahan yang sering dihadapi oleh pelanggan/pasar dalam bentuk tabel dengan struktur yang RAPIH dan DETAIL.`;
  const introB2C = `Anda adalah konsultan untuk segmen konsumen ${placeholderB2C}. Buatkan 3 permasalahan yang sering dihadapi oleh konsumen dalam bentuk tabel dengan struktur yang RAPIH dan DETAIL.`;

  const lines: string[] = [];
  lines.push(mode === 'B2B' ? introB2B : introB2C);
  lines.push(...buildSharedBody(rowsForPrompt));
  lines.push(...(mode === 'B2B' ? buildKriteriaB2B(placeholderB2B) : buildKriteriaB2C(placeholderB2C)));
  lines.push('');
  lines.push('**PRODUCT KNOWLEDGE YANG WAJIB DIJADIKAN ACUAN:**');
  lines.push('==================================================');
  lines.push('Semua kolom Solution di hasil Anda harus merepresentasikan fitur/solusi dari data di bawah. Problem, Impact, Wants, Needs yang Anda generate harus merupakan masalah yang DAPAT diselesaikan oleh Feature dan Feature Description ini. Jangan menambah fitur atau solusi di luar data berikut.');
  lines.push('');
  lines.push(...buildProductKnowledgeRows(rowsForPrompt));
  lines.push('**HASIL AKHIR YANG DIHARAPKAN:**');
  lines.push('- Tabel markdown dengan tepat 3 baris (3 variasi masalah/persona berbeda).');
  lines.push('- Solution setiap baris HARUS mengacu pada Feature dan Feature Description di atas; Problem, Impact, Wants, Needs harus konsisten: masalah yang bisa diselesaikan oleh fitur tersebut.');
  lines.push('- Kolom: Solution | Customer Persona | Problem | Impact | Wants | Needs | Hidden Needs | False Belief | False Belief Impact | What Makes Them Stop?');
  lines.push('- Setiap sel: 1-3 kalimat yang padat. Bahasa: Formal namun mudah dipahami.');
  lines.push('- Output HANYA tabel markdown, tanpa penjelasan tambahan sebelum atau sesudah tabel.');

  return lines.join('\n');
}
