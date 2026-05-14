export type ScriptBreakdownFillRule = 'strict' | 'honest_empty';
export type ScriptBreakdownKeywordHint = 'none' | 'narasi' | 'visual';

export interface ScriptBreakdownTableColumnSnapshot {
  header_label: string;
  placeholder_example?: string | null;
  detail_body?: string | null;
  fill_rule: ScriptBreakdownFillRule;
  keyword_hint: ScriptBreakdownKeywordHint;
}

/** Snapshot ringan untuk membangun blok ## FORMAT TABLE ## di prompt (tanpa ID DB). */
export interface ScriptBreakdownTableSnapshot {
  templateName?: string;
  columns: ScriptBreakdownTableColumnSnapshot[];
}

export interface ScriptGeneratorRequest {
  content_type?: string;
  service_name?: string;
  sub_service_name?: string;
  content_pillar?: string;
  duration_minutes?: number; // Keep for backward compatibility
  slide?: number; // For Post/Carousel
  duration_value?: number; // For Reel/Story/Youtube
  duration_unit?: 'menit' | 'detik'; // For Reel/Story/Youtube
  target_market?: string;
  gender?: string;
  age?: string;
  buying_roles?: string;
  keywords?: string[]; // SEO keywords (max 3)
  useKeyword?: boolean; // Flag to enable/disable keyword usage in prompt
  keinginan?: string;
  kebutuhan?: string;
  hidden_needs?: string;
  problem?: string;
  impact?: string;
  false_belief?: string;
  false_belief_impact?: string;
  what_makes_them_stop?: string;
  feature_name?: string;
  feature_description?: string;
  competitive_advantage?: string;
  solution?: string;
  hook_name?: string; // Hook name selected from dropdown
  hook_description?: string; // Hook description (read-only)
  hook_content?: string; // Hook content (read-only)
  style_name?: string; // Style name selected from dropdown
  style_instruksi?: string; // Style description/instruction
  structure?: string;
  judul?: string; // Title template selected from dropdown
  judul_custom?: string; // Custom title if user wants to edit the template
  selling_approach?: 'Tanpa Produk' | 'Soft Selling' | 'Hard Selling'; // Selling approach: no product, soft selling, or hard selling
  cta_type?: 'use_solution' | 'use_comment'; // CTA type: use solution or use comment for engagement and leads
  // IDs for Save to Plan auto-fill (from form selection)
  content_type_id?: string;
  service_id?: string;
  sub_service_id?: string;
  content_pillar_id?: string;
  /** Hanya untuk pilar Story Telling: `creative` = baris Creative (product_knowledge_detail); `product_knowledge` = alur fitur/insight seperti pillar lain. */
  story_context_mode?: 'creative' | 'product_knowledge';
  /** Template tabel breakdown dari Product Knowledge; jika ada, menggantikan tabel bawaan Story+Video untuk generate ini. */
  script_breakdown_table?: ScriptBreakdownTableSnapshot;
}

export interface ScriptGeneratorResponse {
  script?: string;
  success: boolean;
  error?: string;
}

export const generateScript = async (
  request: ScriptGeneratorRequest
): Promise<ScriptGeneratorResponse> => {
  try {
    // Validate required fields
    if (!request.service_name && !request.content_type) {
      return {
        success: false,
        error: 'Minimal perlu mengisi Service atau Content Type untuk generate prompt'
      };
    }

    // Build ChatGPT prompt
    const prompt = buildChatGPTPrompt(request);

    return {
      script: prompt.trim(),
      success: true
    };
  } catch (error) {
    console.error('Error generating prompt:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function richTextToPlainText(value: string | null | undefined): string {
  if (!value) return '';
  let text = decodeHtmlEntities(String(value).replace(/\u200B/g, ''));
  text = text.replace(/<\s*br\s*\/?>/gi, '\n');
  text = text.replace(/<\/\s*p\s*>/gi, '\n');
  text = text.replace(/<\s*p[^>]*>/gi, '');
  text = text.replace(/<\/\s*li\s*>/gi, '\n');
  text = text.replace(/<\s*li[^>]*>/gi, '- ');
  text = text.replace(/<\/?\s*(ul|ol)[^>]*>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

/**
 * Prompt instruksi lengkap (tabel breakdown 5 kolom + tagging, blok WAJIB mendalam, template Concept panjang, dll.)
 * hanya dipakai ketika Jenis Konten = Reel dan Content Pillar = Edukasi.
 */
function useReelEdukasiExtendedPromptProfile(request: ScriptGeneratorRequest): boolean {
  const ct = (request.content_type || '').trim().toLowerCase();
  const pillar = (request.content_pillar || '').trim().toLowerCase();
  return ct === 'reel' && pillar === 'edukasi';
}

/** Pilar Story telling — sama dengan logika prompt builder (untuk UI Script Generator). */
export function isStoryTellingContentPillar(contentPillar: string | undefined | null): boolean {
  const raw = (contentPillar || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!raw) return false;
  if (raw === 'storytelling' || raw === 'story-telling') return true;
  return raw.includes('story') && raw.includes('tell');
}

/** Pilar Story telling — breakdown video memakai tabel 10 kolom (Timing … Tagging; header tanpa subjudul dalam kurung). */
function isStoryTellingPillar(request: ScriptGeneratorRequest): boolean {
  return isStoryTellingContentPillar(request.content_pillar);
}

/**
 * Mode Creative: sembunyikan konteks Product Knowledge di prompt (persona terstruktur, insight PK, fitur, solusi).
 * - Story Telling: default Creative jika `story_context_mode` tidak diisi (kompatibel API lama).
 * - Pillar lain: Creative hanya jika `story_context_mode === 'creative'`.
 */
function isCreativeContextMode(request: ScriptGeneratorRequest): boolean {
  if (isStoryTellingPillar(request)) {
    return request.story_context_mode !== 'product_knowledge';
  }
  return request.story_context_mode === 'creative';
}

function isEdukasiPillar(request: ScriptGeneratorRequest): boolean {
  return (request.content_pillar || '').trim().toLowerCase() === 'edukasi';
}

function isTrendsPillar(request: ScriptGeneratorRequest): boolean {
  return (request.content_pillar || '').trim().toLowerCase() === 'trends';
}

/**
 * Hanya Edukasi dan Story telling yang memakai prompt lengkap; pillar lain cukup blok dasar + instruksi ringkas.
 */
function useMinimalPillarPromptProfile(request: ScriptGeneratorRequest): boolean {
  if (isEdukasiPillar(request) || isStoryTellingPillar(request)) return false;
  if (isCreativeContextMode(request)) return false;
  return true;
}

function appendPendekatanPenjualanSection(promptParts: string[], request: ScriptGeneratorRequest): void {
  if (!request.selling_approach) return;
  promptParts.push('## Pendekatan Penjualan ##');
  if (request.selling_approach === 'Tanpa Produk') {
    promptParts.push('- **Pendekatan:** Tanpa Produk - Fokus edukasi/informasi umum, TIDAK menyebut produk/layanan spesifik. Berikan insight/tips yang bermanfaat, gunakan solusi umum/konsep jika perlu.');
  } else if (request.selling_approach === 'Soft Selling') {
    promptParts.push('- **Pendekatan:** Soft Selling - Sebutkan produk secara subtle & natural, fokus value/benefit (bukan detail fitur), hindari hard sell. Gunakan storytelling/edukasi yang mengarah ke produk secara halus.');
  } else if (request.selling_approach === 'Hard Selling') {
    promptParts.push('- **Pendekatan:** Hard Selling - 100% fokus produk, fitur detail & konkret, value proposition jelas, jelaskan cara kerja fitur, bandingkan dengan alternatif, CTA langsung ke produk.');
  }
  promptParts.push('====================================================');
  promptParts.push('');
  promptParts.push('');
}

function appendStrukturOutputWajibForPlan(promptParts: string[], storyTellingCompact = false): void {
  if (storyTellingCompact) {
    promptParts.push(
      '**⚠️ Save to Plan:** Akhiri dengan `## CAPTION ##` + teks (maks. 50 kata, judul di baris sendiri). Bila ada konsep, gunakan heading `## Konsep Konten ##` atau `## Concept of Content ##` lalu paragraf. Urutan: isi script & tabel breakdown → baris kosong → `## CAPTION ##`. Kembalikan hanya script lengkap, tanpa penjelasan di luar script.',
    );
    promptParts.push('');
    return;
  }
  promptParts.push('**⚠️ STRUKTUR OUTPUT WAJIB (untuk Save to Plan / Brief Content):**');
  promptParts.push('================================================================');
  promptParts.push('1. CAPTION: Script HARUS memuat tepat satu blok CAPTION dengan format PERSIS seperti berikut (judul di baris sendiri, teks caption di baris berikutnya):');
  promptParts.push('   ## CAPTION ##');
  promptParts.push('   [teks caption singkat dan padat di sini, maksimal 50 kata]');
  promptParts.push('   Jangan gunakan variasi lain (mis. hanya "Caption:" tanpa ##). Tanpa blok ini, Caption tidak bisa disimpan ke plan.');
  promptParts.push('');
  promptParts.push('2. KONSEP (jika ada): Jika script menyertakan konsep, HARUS pakai heading PERSIS salah satu: ## Konsep Konten ## atau ## Concept of Content ## di baris sendiri, lalu baris baru, lalu isi paragraf konsep. Tanpa heading ini, Concept tidak bisa disimpan ke plan.');
  promptParts.push('');
  promptParts.push(
    '3. Urutan akhir script: ... [breakdown script] ... lalu baris kosong, lalu ## CAPTION ##, lalu teks caption, lalu (opsional) ## Struktur ## atau **⚠️ HASHTAG** dan hashtag. Return HANYA script lengkap, tanpa penjelasan.',
  );
  promptParts.push('');
}

/** Tail prompt seragam: Struktur → Hook → Caption → Hashtag → Concept → Save to Plan (compact). Dipakai semua pillar. */
function appendUnifiedScriptTailSections(
  promptParts: string[],
  request: ScriptGeneratorRequest,
  shouldUseKeywords: boolean,
  contextCreativeOnly: boolean
): void {
  const useStoryTellingPillar = isStoryTellingPillar(request);
  const useEdukasiPillar = isEdukasiPillar(request);

  if (!isTrendsPillar(request)) {
    promptParts.push('## Struktur: ##');
    promptParts.push('===============');
    if (useStoryTellingPillar) {
      promptParts.push(
        shouldUseKeywords
          ? 'Hook singkat → narasi utama (## Style & Struktur ##; emosi & pesan; keyword natural) → CTA.'
          : 'Hook singkat → narasi utama (## Style & Struktur ##; tanpa checklist insight/masalah/fitur) → CTA.',
      );
      promptParts.push('CTA: ringkas, selaras nada storytelling.');
    } else if (useEdukasiPillar) {
      promptParts.push(
        shouldUseKeywords
          ? 'Hook singkat → narasi utama (## Style & Struktur ##; penjelasan edukatif & pesan jelas; keyword natural) → CTA.'
          : 'Hook singkat → narasi utama (## Style & Struktur ##; tanpa checklist insight/masalah/fitur; fokus edukasi) → CTA.',
      );
      promptParts.push('CTA: ringkas, selaras nada edukasi.');
    } else {
      promptParts.push(
        shouldUseKeywords
          ? 'Hook singkat → narasi utama (## Style & Struktur ##; emosi & pesan; keyword natural) → CTA.'
          : 'Hook singkat → narasi utama (## Style & Struktur ##; tanpa checklist insight/masalah/fitur) → CTA.',
      );
      promptParts.push('CTA: ringkas, selaras nada storytelling.');
    }
  }

  if (request.hook_name || request.hook_description || request.hook_content) {
    promptParts.push('');
    promptParts.push('## Hook untuk Script ##');
    promptParts.push('=======================');
    if (request.hook_name) {
      promptParts.push(`- **Nama Hook:** ${request.hook_name}`);
    }
    if (request.hook_description) {
      promptParts.push(`- **Deskripsi Hook:** ${request.hook_description}`);
    }
    if (request.hook_content) {
      promptParts.push(`- **Konten Hook:** ${request.hook_content}`);
      promptParts.push('');
      promptParts.push('- **Hook:** Gunakan sebagai referensi; susun ulang dengan bahasa natural dan ringkas sesuai format konten.');
    }
  }

  promptParts.push('');
  promptParts.push('## CAPTION - WAJIB DIBUAT: ##');
  promptParts.push(
    '=============================\n' +
      'CAPTION maks. 50 kata: hook + pesan utama; hindari checklist insight/masalah/fitur. Format blok `## CAPTION ##` di baris sendiri, lalu teks (lihat Save to Plan di akhir).',
  );
  if (shouldUseKeywords) {
    promptParts.push('');
    promptParts.push(`**⚠️ PENTING - Keyword di Caption:**`);
    promptParts.push(`- Keyword yang harus digunakan: ${request.keywords!.join(', ')}`);
    promptParts.push(`- Caption secara keseluruhanHARUS mengandung minimal 2 keyword`);
    promptParts.push(`- Pastikan keyword muncul secara natural dan tidak terkesan terlalu memaksa struktur kalimat`);
    promptParts.push(`- Struktur kalimat HARUS tetap baik, mudah dipahami, dan mengalir natural`);
    promptParts.push(`- Jangan mengorbankan kualitas kalimat hanya untuk menempatkan keyword`);
  }
  promptParts.push('');

  promptParts.push('**⚠️ HASHTAG - WAJIB:**');
  promptParts.push('========================');
  if (shouldUseKeywords) {
    const keywordHashtags = request.keywords!.map((k) => {
      const hashtag = k.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
      return `#${hashtag}`;
    }).join(' ');
    promptParts.push(`**HASHTAG WAJIB menggunakan keyword:** ${keywordHashtags}`);
    promptParts.push('- Hashtag HARUS menggunakan semua keyword: ' + request.keywords!.join(', '));
    promptParts.push('- Format hashtag: hilangkan spasi, gunakan huruf dan angka saja');
    promptParts.push('- Boleh tambahkan hashtag relevan lainnya, tetapi keyword di atas WAJIB ada');
  } else {
    promptParts.push('#hashtag1 #hashtag2 #hashtag3');
    promptParts.push('- Gunakan 3-5 hashtag untuk Instagram atau 1-2 untuk LinkedIn');
  }
  promptParts.push('');

  const hasProductDetails =
    request.feature_name || request.feature_description || request.solution || request.competitive_advantage;
  if (
    useStoryTellingPillar ||
    useEdukasiPillar ||
    request.target_market ||
    request.keinginan ||
    request.kebutuhan ||
    request.hidden_needs ||
    request.problem ||
    request.solution ||
    hasProductDetails
  ) {
    promptParts.push('## Concept of Content ##');
    promptParts.push('=========================');
    promptParts.push(
      'Konsep 2-3 kalimat: big idea, audiens (jika ada), nada emosi — hindari kerangka target→insight→masalah→solusi produk. Awali dengan `## Concept of Content ##` atau `## Konsep Konten ##` lalu paragraf, lalu script utama (heading wajib untuk Save to Plan).',
    );
    promptParts.push('');
    promptParts.push('');
  }

  appendStrukturOutputWajibForPlan(promptParts, true);
}

/** Prompt singkat: pembuka + Format Konten + Produk/Layanan + Content Pillar + tail seragam (semua pillar). */
function buildMinimalChatGPTPrompt(request: ScriptGeneratorRequest): string {
  const promptParts: string[] = [];
  promptParts.push('Anda adalah ahli copywriter digital marketing. Buatkan script konten digital marketing berdasarkan informasi di bawah ini.');
  promptParts.push('=======================================================');
  promptParts.push('');
  promptParts.push(
    'PENTING: patuhi durasi di Format Konten; output rapi; ikuti bagian CAPTION & Save to Plan di akhir prompt.',
  );
  promptParts.push('');
  promptParts.push('## INFORMASI DETAIL UNTUK SCRIPT. ##');
  promptParts.push('====================================');
  promptParts.push('## Format Konten ##');
  if (request.content_type) {
    promptParts.push(`- **Jenis Konten:** ${request.content_type}`);
  }
  if (request.slide) {
    promptParts.push(`- **Jumlah Slide:** ${request.slide} slide`);
  } else if (request.duration_value !== undefined) {
    const unit = request.duration_unit || 'menit';
    promptParts.push(`- **Durasi:** ${request.duration_value} ${unit}`);
  } else if (request.duration_minutes) {
    promptParts.push(`- **Durasi:** ${request.duration_minutes} menit`);
  }
  promptParts.push('');
  if (request.service_name || request.sub_service_name) {
    promptParts.push('## Informasi Produk/Layanan ##');
    if (request.service_name) {
      promptParts.push(`- **Service:** ${request.service_name}`);
    }
    if (request.sub_service_name) {
      promptParts.push(`- **Sub Service:** ${request.sub_service_name}`);
    }
    promptParts.push('');
  }
  if (request.content_pillar) {
    promptParts.push(`## Content Pillar ##`);
    promptParts.push(`- **Pillar:** ${request.content_pillar}`);
    promptParts.push('');
  }
  appendPendekatanPenjualanSection(promptParts, request);
  const shouldUseKeywords = request.useKeyword !== false && request.keywords && request.keywords.length > 0;
  if (shouldUseKeywords) {
    const firstKeyword = request.keywords[0];
    promptParts.push('**⚠️ PENTING - SEO KEYWORDS:**');
    promptParts.push(`- Keyword yang WAJIB digunakan: ${request.keywords.join(', ')}`);
    promptParts.push(`- Keyword HARUS muncul di: Voice Over (VO), Text overlay di video, Caption, dan HASHTAG`);
    promptParts.push(
      `- Semua keyword HARUS digunakan secara natural dalam script Voice Over (VO) dan text overlay di video`,
    );
    promptParts.push('');
    if (request.keywords.length > 1) {
      promptParts.push(`- **Untuk JUDUL:** Gunakan HANYA keyword PERTAMA: "${firstKeyword}" (bukan semua keyword)`);
    } else {
      promptParts.push(`- **Untuk JUDUL:** Gunakan keyword "${firstKeyword}" jika memungkinkan`);
    }
    promptParts.push(`- **Untuk CAPTION:** Keseluruhan isi Caption HARUS mengandung Maksimal 3 keyword, distribusikan semua keyword secara merata. Struktur kalimat tetap harus baik dan mudah dipahami.`);
    promptParts.push(
      `- Hashtag HARUS menggunakan keyword: ${request.keywords.map((k) => `#${k.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '')}`).join(' ')}`,
    );
    promptParts.push('');
  }
  promptParts.push('');
  maybeAppendScriptBreakdownTable(promptParts, request, shouldUseKeywords);
  appendUnifiedScriptTailSections(promptParts, request, shouldUseKeywords, isCreativeContextMode(request));
  return promptParts.join('\n');
}

const STATIC_TAGGING_COLUMN_FOOTER =
  '**Tagging** — dari kolom Visual; kata kunci ID dipisah `-`; urutan: JENIS_SHOT-GERAKAN_KAMERA-SUBJEK-AKSI-SETTING-WAKTU-SUASANA; hentikan jika info habis. Contoh: `CU-diam-host-bingung-studio-siang`.';

/** Kolom default Story + Video (10 kolom) — dipakai seed Product Knowledge dan fallback legacy. */
export function getDefaultStoryTellingVideoBreakdownColumns(): ScriptBreakdownTableColumnSnapshot[] {
  return [
    {
      header_label: 'Timing',
      placeholder_example: '0-3s',
      detail_body: 'Rentang per segmen (0-3s, 3-8s, dst.). Narasi proporsional dengan lebar waktu baris tersebut.',
      fill_rule: 'strict',
      keyword_hint: 'none',
    },
    {
      header_label: 'Narasi',
      placeholder_example: '[Teks narasi]',
      detail_body: 'Teks narasi yang diucapkan pada segmen ini.',
      fill_rule: 'strict',
      keyword_hint: 'narasi',
    },
    {
      header_label: 'Visual',
      placeholder_example: '[Visual detail]',
      detail_body:
        'Shot, transisi, ekspresi, setting, teks layar.\n**Setting:** tulis **Indoor** atau **Outdoor** + detail (studio, taman, dll.).',
      fill_rule: 'strict',
      keyword_hint: 'visual',
    },
    {
      header_label: 'Emotional',
      placeholder_example: '[target emosi]',
      detail_body: '— *rasakan apa?* (mis. relate, sedih, bangga).',
      fill_rule: 'strict',
      keyword_hint: 'none',
    },
    {
      header_label: 'Absurd',
      placeholder_example: '[titik absurd/kontradiksi]',
      detail_body: '— *dimana?* titik konyol/kontradiktif di visual atau situasi.',
      fill_rule: 'honest_empty',
      keyword_hint: 'none',
    },
    {
      header_label: 'Sarkas',
      placeholder_example: '[letak sarkas di narasi]',
      detail_body: '— *dimana?* kutipan/letak sarkas di narasi; jika tidak ada: "—" atau "tidak ada".',
      fill_rule: 'honest_empty',
      keyword_hint: 'none',
    },
    {
      header_label: 'Punchline',
      placeholder_example: '[punchline/menyadarkan]',
      detail_body: '— *dimana?* beat narasi/visual yang menohok/menyadarkan.',
      fill_rule: 'strict',
      keyword_hint: 'none',
    },
    {
      header_label: 'Informasi Penting',
      placeholder_example: '[pesan kunci/nasihat]',
      detail_body: '— pesan kunci/nasihat segmen.',
      fill_rule: 'strict',
      keyword_hint: 'none',
    },
    {
      header_label: 'Element Lainnya',
      placeholder_example: '[SFX/Music/Text overlay]',
      detail_body: '— SFX, musik, overlay di luar teks narasi utama.',
      fill_rule: 'strict',
      keyword_hint: 'none',
    },
    {
      header_label: 'Tagging',
      placeholder_example: '[Tagging]',
      detail_body:
        '— dari kolom Visual; kata kunci ID dipisah `-`; urutan: JENIS_SHOT-GERAKAN_KAMERA-SUBJEK-AKSI-SETTING-WAKTU-SUASANA; hentikan jika info habis. Contoh: `CU-diam-host-bingung-studio-siang`.',
      fill_rule: 'strict',
      keyword_hint: 'none',
    },
  ];
}

const STORY_TELLING_VIDEO_LEGACY_SNAPSHOT: ScriptBreakdownTableSnapshot = {
  columns: getDefaultStoryTellingVideoBreakdownColumns(),
};

function mdTableCell(value: string | null | undefined): string {
  const s = (value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\|/g, '/')
    .replace(/\n+/g, ' ')
    .trim();
  return s || ' ';
}

function appendScriptBreakdownTableFromSnapshot(
  promptParts: string[],
  request: ScriptGeneratorRequest,
  shouldUseKeywords: boolean,
  snapshot: ScriptBreakdownTableSnapshot
): void {
  const columns = snapshot.columns.filter((c) => (c.header_label || '').trim() !== '');
  if (columns.length === 0) return;

  promptParts.push('## FORMAT TABLE: ##');
  promptParts.push('===================');

  const headerLine =
    '| ' + columns.map((c) => mdTableCell(c.header_label)).join(' | ') + ' |';
  const sepLine = '|' + columns.map(() => '--------').join('|') + '|';
  const exampleLine =
    '| ' +
    columns.map((c) => mdTableCell(c.placeholder_example ?? `[${mdTableCell(c.header_label)}]`)).join(' | ') +
    ' |';

  promptParts.push(headerLine);
  promptParts.push(sepLine);
  promptParts.push(exampleLine);
  promptParts.push('');

  const n = columns.length;
  let wajib =
    '**WAJIB:** Salin struktur di atas — tepat **' +
    n +
    ' kolom**, header **persis** sama (termasuk `|`), tanpa kolom `Action`.';
  if (n >= 9) {
    wajib += ' Kolom ke-9 **' + mdTableCell(columns[8].header_label) + '**';
  }
  if (n >= 10) {
    wajib += ', ke-10 **' + mdTableCell(columns[9].header_label) + '**';
  }
  wajib += ' (isi tiap baris).';
  promptParts.push(wajib);
  promptParts.push('');

  for (const col of columns) {
    const label = col.header_label.trim();
    promptParts.push('**' + label + '**');

    const narasiKw =
      col.keyword_hint === 'narasi' &&
      shouldUseKeywords &&
      request.keywords &&
      request.keywords.length > 0;
    const visualKw =
      col.keyword_hint === 'visual' &&
      shouldUseKeywords &&
      request.keywords &&
      request.keywords.length > 0;

    if (narasiKw) {
      promptParts.push(
        `Teks narasi segmen; sisipkan keyword secara natural jika relevan: ${request.keywords!.join(', ')}`,
      );
    } else if (visualKw) {
      promptParts.push(
        `Shot, transisi, ekspresi, setting, teks layar; keyword di visual/overlay jika relevan: ${request.keywords!.join(', ')}`,
      );
      promptParts.push('**Setting:** tulis **Indoor** atau **Outdoor** + detail (studio, taman, dll.).');
    } else if (col.detail_body && col.detail_body.trim()) {
      const parts = col.detail_body.replace(/\r\n/g, '\n').split('\n').filter(Boolean);
      for (const p of parts) {
        promptParts.push(p);
      }
    }

    promptParts.push('');

    if (label.toLowerCase().includes('tagging') && (!col.detail_body || !col.detail_body.trim())) {
      promptParts.push(STATIC_TAGGING_COLUMN_FOOTER);
      promptParts.push('');
    }
  }
}

function appendStoryTellingVideoTableInstructions(
  promptParts: string[],
  request: ScriptGeneratorRequest,
  shouldUseKeywords: boolean
): void {
  appendScriptBreakdownTableFromSnapshot(
    promptParts,
    request,
    shouldUseKeywords,
    STORY_TELLING_VIDEO_LEGACY_SNAPSHOT
  );
}

function isVideoContentType(request: ScriptGeneratorRequest): boolean {
  const ct = (request.content_type || '').trim().toLowerCase();
  return ct === 'reel' || ct === 'story' || ct === 'youtube';
}

function maybeAppendScriptBreakdownTable(
  promptParts: string[],
  request: ScriptGeneratorRequest,
  shouldUseKeywords: boolean
): void {
  const snapshot = request.script_breakdown_table;
  if (snapshot?.columns && snapshot.columns.length > 0) {
    appendScriptBreakdownTableFromSnapshot(promptParts, request, shouldUseKeywords, snapshot);
    return;
  }
  if (isStoryTellingPillar(request) && isVideoContentType(request)) {
    appendStoryTellingVideoTableInstructions(promptParts, request, shouldUseKeywords);
  }
}

function sanitizePromptRequest(request: ScriptGeneratorRequest): ScriptGeneratorRequest {
  return {
    ...request,
    content_type: richTextToPlainText(request.content_type),
    service_name: richTextToPlainText(request.service_name),
    sub_service_name: richTextToPlainText(request.sub_service_name),
    content_pillar: richTextToPlainText(request.content_pillar),
    target_market: richTextToPlainText(request.target_market),
    gender: richTextToPlainText(request.gender),
    age: richTextToPlainText(request.age),
    buying_roles: richTextToPlainText(request.buying_roles),
    keinginan: richTextToPlainText(request.keinginan),
    kebutuhan: richTextToPlainText(request.kebutuhan),
    hidden_needs: richTextToPlainText(request.hidden_needs),
    problem: richTextToPlainText(request.problem),
    impact: richTextToPlainText(request.impact),
    false_belief: richTextToPlainText(request.false_belief),
    false_belief_impact: richTextToPlainText(request.false_belief_impact),
    what_makes_them_stop: richTextToPlainText(request.what_makes_them_stop),
    feature_name: richTextToPlainText(request.feature_name),
    feature_description: richTextToPlainText(request.feature_description),
    competitive_advantage: richTextToPlainText(request.competitive_advantage),
    solution: richTextToPlainText(request.solution),
    hook_name: richTextToPlainText(request.hook_name),
    hook_description: richTextToPlainText(request.hook_description),
    hook_content: richTextToPlainText(request.hook_content),
    style_name: richTextToPlainText(request.style_name),
    style_instruksi: richTextToPlainText(request.style_instruksi),
    structure: richTextToPlainText(request.structure),
    judul: richTextToPlainText(request.judul),
    judul_custom: richTextToPlainText(request.judul_custom),
    keywords: (request.keywords || []).map((k) => richTextToPlainText(k)).filter(Boolean),
    story_context_mode:
      request.story_context_mode === 'product_knowledge'
        ? 'product_knowledge'
        : request.story_context_mode === 'creative'
          ? 'creative'
          : undefined,
    script_breakdown_table: sanitizeScriptBreakdownTableSnapshot(request.script_breakdown_table),
  };
}

function sanitizeScriptBreakdownTableSnapshot(
  snapshot: ScriptBreakdownTableSnapshot | undefined
): ScriptBreakdownTableSnapshot | undefined {
  if (!snapshot || !Array.isArray(snapshot.columns) || snapshot.columns.length === 0) {
    return undefined;
  }
  const columns: ScriptBreakdownTableColumnSnapshot[] = snapshot.columns
    .map((c) => ({
      header_label: richTextToPlainText(c.header_label).trim(),
      placeholder_example: c.placeholder_example != null ? richTextToPlainText(c.placeholder_example) : null,
      detail_body: c.detail_body != null ? richTextToPlainText(c.detail_body) : null,
      fill_rule: (c.fill_rule === 'honest_empty' ? 'honest_empty' : 'strict') as ScriptBreakdownFillRule,
      keyword_hint: (c.keyword_hint === 'narasi'
        ? 'narasi'
        : c.keyword_hint === 'visual'
          ? 'visual'
          : 'none') as ScriptBreakdownKeywordHint,
    }))
    .filter((c) => c.header_label !== '');
  if (columns.length === 0) return undefined;
  const name = snapshot.templateName != null ? richTextToPlainText(snapshot.templateName).trim() : '';
  return {
    ...(name ? { templateName: name } : {}),
    columns,
  };
}

// Helper function to clean duplicated labels from value
function cleanLabelDuplication(text: string | null | undefined, label: string): string {
  if (!text) return '';
  let cleaned = text.trim();
  // Remove duplicated label at the beginning (e.g., "Hidden Needs 1: ..." -> "...")
  const labelPattern = new RegExp(`^${label}:\\s*`, 'i');
  cleaned = cleaned.replace(labelPattern, '');
  return cleaned;
}

// Build a comprehensive prompt for ChatGPT
function buildChatGPTPrompt(request: ScriptGeneratorRequest): string {
  Object.assign(request, sanitizePromptRequest(request));
  if (useMinimalPillarPromptProfile(request)) {
    return buildMinimalChatGPTPrompt(request);
  }
  const useReelEdukasiExtendedPrompt = useReelEdukasiExtendedPromptProfile(request);
  const useStoryTellingPillar = isStoryTellingPillar(request);
  const contextCreativeOnly = isCreativeContextMode(request);
  const includeProductKnowledgePromptSections = !contextCreativeOnly;
  const promptParts: string[] = [];

  // Opening - Concise and clear (semua pillar)
  promptParts.push('Anda adalah ahli copywriter digital marketing. Buatkan script konten digital marketing berdasarkan informasi di bawah ini.');
  promptParts.push('=====================================================');
  promptParts.push('');
  promptParts.push(
    'PENTING: patuhi durasi di Format Konten; output rapi; ikuti bagian CAPTION & Save to Plan di akhir prompt.',
  );
  promptParts.push('');
  promptParts.push('## INFORMASI DETAIL UNTUK SCRIPT. ##');
  promptParts.push('====================================');
  // Content Type & Format
  promptParts.push('## Format Konten ##');
  if (request.content_type) {
    promptParts.push(`- **Jenis Konten:** ${request.content_type}`);
  }
  
  // Duration/Slide
  if (request.slide) {
    promptParts.push(`- **Jumlah Slide:** ${request.slide} slide`);
  } else if (request.duration_value !== undefined) {
    const unit = request.duration_unit || 'menit';
    promptParts.push(`- **Durasi:** ${request.duration_value} ${unit}`);
  } else if (request.duration_minutes) {
    promptParts.push(`- **Durasi:** ${request.duration_minutes} menit`);
  }
  promptParts.push('');
  
  // Service Information
  if (request.service_name || request.sub_service_name) {
    promptParts.push('## Informasi Produk/Layanan ##');
    if (request.service_name) {
      promptParts.push(`- **Service:** ${request.service_name}`);
    }
    if (request.sub_service_name) {
      promptParts.push(`- **Sub Service:** ${request.sub_service_name}`);
    }
    promptParts.push('');
  }
  
  // Content Pillar
  if (request.content_pillar) {
    promptParts.push(`## Content Pillar ##`);
    promptParts.push(`- **Pillar:** ${request.content_pillar}`);
    
    const pillarLower = request.content_pillar.toLowerCase();
    if (pillarLower.includes('compar') || pillarLower.includes('banding')) {
      promptParts.push('**⚠️ Perbandingan:** Bandingkan LAMA vs BARU dengan data/angka terukur. Format: "Metode Lama: [angka] → Solusi: [angka] (Xx lebih baik/hemat Y%)". Setiap poin wajib pakai angka konkret.');
    } else if (pillarLower.includes('q&a') || pillarLower.includes('qa') || pillarLower.includes('tanya') || pillarLower.includes('jawab')) {
      promptParts.push('**⚠️ Q&A:** Format Tanya-Jawab konsisten sepanjang script. Pola: Pertanyaan → Jawaban → Insight. Natural & conversational.');
    }
    promptParts.push('');
  }

  /** Edukasi & Story telling: prompt lengkap — taruh Pendekatan Penjualan langsung setelah Content Pillar (satu-satunya jalur ke fungsi ini). */
  appendPendekatanPenjualanSection(promptParts, request);
  
  // Target Audience
  // Only include keywords if useKeyword is true (default to true for backward compatibility)
  const shouldUseKeywords = request.useKeyword !== false && request.keywords && request.keywords.length > 0;
  if (request.target_market || request.gender || request.age || request.buying_roles || shouldUseKeywords) {
    promptParts.push('## Target Audience ##');
    if (request.target_market) {
      if (contextCreativeOnly) {
        promptParts.push(`- ${request.target_market}`);
      } else {
        promptParts.push(`- **Customer Persona:** ${request.target_market}`);
      }
    }
    if (request.gender) {
      promptParts.push(`- **Gender:** ${request.gender}`);
    }
    if (request.age) {
      promptParts.push(`- **Usia:** ${request.age}`);
    }
    if (request.buying_roles) {
      promptParts.push(`- **Buying Roles:** ${request.buying_roles}`);
    }
    if (shouldUseKeywords) {
      promptParts.push(`- **Keyword SEO:** ${request.keywords!.join(', ')}`);
    }
    promptParts.push('');
  }
  promptParts.push('');
  // Customer Insights — mode Creative yang di-skip; Product Knowledge ikut PK.
  if (includeProductKnowledgePromptSections && (request.keinginan || request.kebutuhan || request.hidden_needs)) {
    promptParts.push('## Insights Pelanggan ##');
    promptParts.push('========================');
    if (request.keinginan) {
      promptParts.push(`- **Keinginan:** ${request.keinginan}`);
    }
    if (request.kebutuhan) {
      promptParts.push(`- **Kebutuhan:** ${request.kebutuhan}`);
    }
    if (request.hidden_needs) {
      promptParts.push(`- **Hidden Needs:** ${request.hidden_needs}`);
    }
    promptParts.push('');
    promptParts.push('');
  }
  
  // Problems
  if (includeProductKnowledgePromptSections && request.problem) {
    promptParts.push('## Masalah yang Dihadapi ##');
    promptParts.push('============================');
    promptParts.push(`${request.problem}`);
    promptParts.push('');
    promptParts.push('');
  }
  
  // Impact
  if (includeProductKnowledgePromptSections && request.impact) {
    promptParts.push('## Dampak dari Masalah ##');
    promptParts.push('=========================');
    promptParts.push(`${request.impact}`);
    promptParts.push('');
    promptParts.push('');
    
  }
  
  // False Belief & Related Fields (bahasa casual: yang suka dianggap enteng)
  if (
    includeProductKnowledgePromptSections &&
    (request.false_belief || request.false_belief_impact || request.what_makes_them_stop)
  ) {
    promptParts.push('## Yang Suka Dianggap Enteng & Dampaknya ##');
    promptParts.push('============================================');
    if (request.false_belief) {
      promptParts.push(`- **Yang suka dianggap enteng:** ${request.false_belief} - Hal yang sering dianggap sepele/enteng oleh pelanggan (misalnya "nggak perlu buru-buru", "kayaknya aman aja")`);
      promptParts.push('');
    }
    if (request.false_belief_impact) {
      promptParts.push(`- **Dampaknya:** ${request.false_belief_impact} - Apa yang terjadi karena dianggap enteng (biasanya masalah makin parah, keluar duit lebih banyak, reputasi kena)`);
      promptParts.push('');
    }
    if (request.what_makes_them_stop) {
      promptParts.push(`- **What Makes Them Stop:** ${request.what_makes_them_stop} - Faktor yang bikin pelanggan ragu, berhenti, atau nggak ambil tindakan`);
      promptParts.push('');
    }
    promptParts.push('');
    if (useReelEdukasiExtendedPrompt) {
      promptParts.push('**⚠️⚠️⚠️ KRITIS - KONSEP UTAMA FALSE BELIEF (SUKA ANGGAP ENTENG MASALAH)');
      promptParts.push('=============================================');
      promptParts.push(' - Dampak dari False Belief (Suka anggap enteng masalah) hampir selalu memperparah Impact awal.');
      promptParts.push(' - Karena menganggap sepele masalah→ nggak waspada → nggak ada pencegahan → masalah makin gede, makin mahal, reputasi ikut kena');
      promptParts.push(' - Pakai bahasa sederhana seperti "anggap enteng masalah" (harus menggunakan bahasa yang mudah dipahami) dan relatable. Tunjukin koneksi jelas antara "yang dianggap enteng" dengan dampak yang makin parah.');
      promptParts.push('');
      promptParts.push('');
    }
  }
  
  // Feature & Competitive Advantage
  if (
    includeProductKnowledgePromptSections &&
    (request.feature_name || request.feature_description || request.competitive_advantage)
  ) {
    promptParts.push('## FITUR & KEUNGGULAN ##');
    promptParts.push('========================');
    if (request.feature_name) {
      promptParts.push(`- **Feature:** ${request.feature_name}`);
    }
    if (request.feature_description) {
      promptParts.push(`- **Deskripsi:** ${request.feature_description}`);
    }
    if (request.competitive_advantage) {
      promptParts.push(`- **Keunggulan:** ${request.competitive_advantage}`);
    }
    promptParts.push('');
    promptParts.push('');
  }
  
  // Solution
  if (includeProductKnowledgePromptSections && request.solution) {
    promptParts.push(`## Solusi ##`);
    promptParts.push('============');
    promptParts.push(`${request.solution}`);
    promptParts.push('');
    promptParts.push('');
  }
  
  // Style & Structure
  if (request.style_instruksi || request.structure || request.style_name) {
    promptParts.push('## Style & Struktur ##');
    promptParts.push('======================');
    if (request.style_instruksi) {
      // Remove the specific detail examples section
      let styleInstruksi = request.style_instruksi;
      // Remove lines containing "Waktu:", "Angka:", "Nama sistem:", "Status:" with "bukan" pattern
      const lines = styleInstruksi.split('\n');
      const filteredLines = lines.filter(line => {
        const lineLower = line.toLowerCase();
        // Skip lines that contain the pattern: "Waktu:", "Angka:", "Nama sistem:", "Status:" followed by "bukan"
        if (lineLower.includes('waktu:') && lineLower.includes('bukan')) return false;
        if (lineLower.includes('angka:') && lineLower.includes('bukan')) return false;
        if (lineLower.includes('nama sistem:') && lineLower.includes('bukan')) return false;
        if (lineLower.includes('status:') && lineLower.includes('bukan')) return false;
        // Also check for specific examples mentioned
        if (lineLower.includes('23.52') || lineLower.includes('hampir tengah malam')) return false;
        if (lineLower.includes('5 juta') || lineLower.includes('uang banyak')) return false;
        if (lineLower.includes('dashboard backend') || lineLower.includes('sistem kami')) return false;
        if (lineLower.includes('transfer pending') || lineLower.includes('masih proses')) return false;
        return true;
      });
      styleInstruksi = filteredLines.join('\n');
      // Clean up multiple newlines
      styleInstruksi = styleInstruksi.replace(/\n{3,}/g, '\n\n');
      promptParts.push(`- **Style Instruksi:** ${styleInstruksi.trim()}`);
    }
    if (request.structure) {
      // Combine style_name and structure if both exist
      if (request.style_name) {
        promptParts.push(`- **Struktur Script:** ${request.style_name} - ${request.structure}`);
      } else {
        promptParts.push(`- **Struktur Script:** ${request.structure}`);
      }
      
      // Add specific instructions for "Tarik-Tahan-Tembak" structure
      const structureLower = request.structure.toLowerCase();
      if (structureLower.includes('tarik') && structureLower.includes('tahan') && structureLower.includes('tembak')) {
        promptParts.push('');
        promptParts.push('**⚠️ PENTING untuk Struktur "Tarik-Tahan-Tembak":**');
        promptParts.push('- **TARIK (Bagian Awal):** Buka dengan pertanyaan/statement yang memicu curiosity, lalu PAUSE 2-3 detik untuk membangun tension');
        promptParts.push('- **TAHAN (Bagian Tengah):** Detail masalah dan dampak dengan intensitas yang meningkat, PAUSE 1-2 detik sebelum solusi');
        promptParts.push('- **TEMBAK (Bagian Akhir):** Solusi muncul dengan momentum kuat, langsung ke benefit dan CTA');
        promptParts.push('- Timing pause sangat penting: gunakan pause efektif untuk membangun anticipation, bukan hanya label "TARIK/TAHAN/TEMBAK"');
        promptParts.push('- Struktur ini harus terasa sebagai pola narasi yang natural, bukan sekadar label di script');
      }
    } else if (request.style_name) {
      // If only style_name exists without structure
      promptParts.push(`- **Struktur Script:** ${request.style_name}`);
    }
    promptParts.push('');
    promptParts.push('');
  }
  
  // SEO keywords — tanpa ## Instruksi ## dan tanpa checklist "Berdasarkan informasi di atas…"
  if (shouldUseKeywords) {
    const firstKeyword = request.keywords[0];
    promptParts.push('**⚠️ PENTING - SEO KEYWORDS:**');
    promptParts.push(`- Keyword yang WAJIB digunakan: ${request.keywords.join(', ')}`);
    promptParts.push(`- Keyword HARUS muncul di: Voice Over (VO), Text overlay di video, Caption, dan HASHTAG`);
    promptParts.push(`- Semua keyword HARUS digunakan secara natural dalam script Voice Over (VO) dan text overlay di video`);
    promptParts.push(`- Contoh: Jika keyword "Cara Membuat SEO di TikTok", maka VO dan text HARUS menyebutkan "Cara Membuat SEO di TikTok"`);
    promptParts.push(`- Pendistribusian keywords di keseluruhan Voice over maksimal 2 atau sampai dengan 3 Keywords saja agar tidak terkesan memaksa struktur kalimat"`);
    promptParts.push('');
    if (request.keywords.length > 1) {
      promptParts.push(`- **Untuk JUDUL:** Gunakan HANYA keyword PERTAMA: "${firstKeyword}" (bukan semua keyword)`);
    } else {
      promptParts.push(`- **Untuk JUDUL:** Gunakan keyword "${firstKeyword}" jika memungkinkan`);
    }
    promptParts.push(`- **Untuk CAPTION:** Keseluruhan isi Caption HARUS mengandung Maksimal 3 keyword, distribusikan semua keyword secara merata. Struktur kalimat tetap harus baik dan mudah dipahami.`);
    promptParts.push(`- Hashtag HARUS menggunakan keyword: ${request.keywords!.map(k => `#${k.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '')}`).join(' ')}`);
    promptParts.push('');
  }

  promptParts.push('');
  promptParts.push('');

  // Judul Information
  if (request.judul || request.judul_custom) {
    const judulToUse = request.judul_custom || request.judul || '';
    promptParts.push('## Judul Script ##');
    promptParts.push(`**Template:** ${judulToUse}`);
    promptParts.push('**⚠️ Ganti [ ] dengan konten relevan. Format: [#]=angka, [#%]=persentase, [#Tanda]=ikon. Ringkas, menarik, relevan.');
    if (shouldUseKeywords) {
      const firstKeyword = request.keywords![0];
      if (request.keywords!.length > 1) {
        promptParts.push(`**⚠️ PENTING - Keyword di Judul:** Jika memungkinkan, SISIPKAN keyword PERTAMA: "${firstKeyword}" ke dalam judul secara natural dan relevan. (Gunakan hanya keyword pertama, bukan semua keyword). Jika Tidak memungkinkan di gabungkan dengan template judul, maka boleh diabaikan penggunaan keyword`);
      } else {
        promptParts.push(`**⚠️ PENTING - Keyword di Judul:** Jika memungkinkan, SISIPKAN keyword: "${firstKeyword}" ke dalam judul secara natural dan relevan. Jika Tidak memungkinkan di gabungkan dengan template judul, maka boleh diabaikan penggunaan keyword`);
      }
    }
    promptParts.push('');
  } else if (shouldUseKeywords) {
    // If no judul template, still remind about keywords
    const firstKeyword = request.keywords![0];
    promptParts.push('## Judul Script ##');
    if (request.keywords!.length > 1) {
      promptParts.push(`**⚠️ PENTING - Keyword di Judul:** Jika memungkinkan, SISIPKAN keyword PERTAMA: "${firstKeyword}" ke dalam judul secara natural dan relevan. (Gunakan hanya keyword pertama, bukan semua keyword)`);
    } else {
      promptParts.push(`**⚠️ PENTING - Keyword di Judul:** Jika memungkinkan, SISIPKAN keyword: "${firstKeyword}" ke dalam judul secara natural dan relevan.`);
    }
    promptParts.push('');
    promptParts.push('');
  }
  
  promptParts.push('');
  maybeAppendScriptBreakdownTable(promptParts, request, shouldUseKeywords);

  appendUnifiedScriptTailSections(promptParts, request, shouldUseKeywords, contextCreativeOnly);

  return promptParts.join('\n');

}

