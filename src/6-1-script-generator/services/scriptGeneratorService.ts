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
  const promptParts: string[] = [];
  
  // Opening - Concise and clear
  promptParts.push('Anda adalah ahli copywriter digital marketing. Buatkan script konten digital marketing berdasarkan informasi di bawah ini.');
  promptParts.push('=======================================================');
  promptParts.push('');
  promptParts.push('PENTING:');
  promptParts.push('1. Baca semua informasi sebelum membuat script');
  promptParts.push('2. Buat Caption setelah script selesai');
  promptParts.push('3. Pastikan Output mudah dibaca dengan struktur jelas');
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
  
  // Target Audience
  // Only include keywords if useKeyword is true (default to true for backward compatibility)
  const shouldUseKeywords = request.useKeyword !== false && request.keywords && request.keywords.length > 0;
  if (request.target_market || request.gender || request.age || request.buying_roles || shouldUseKeywords) {
    promptParts.push('## Target Audience ##');
    if (request.target_market) {
      promptParts.push(`- **Customer Persona:** ${request.target_market}`);
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
  // Customer Insights
  if (request.keinginan || request.kebutuhan || request.hidden_needs) {
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
  if (request.problem) {
    promptParts.push('## Masalah yang Dihadapi ##');
    promptParts.push('============================');
    promptParts.push(`${request.problem}`);
    promptParts.push('');
    promptParts.push('');
  }
  
  // Impact
  if (request.impact) {
    promptParts.push('## Dampak dari Masalah ##');
    promptParts.push('=========================');
    promptParts.push(`${request.impact}`);
    promptParts.push('');
    promptParts.push('');
    
  }
  
  // False Belief & Related Fields (bahasa casual: yang suka dianggap enteng)
  if (request.false_belief || request.false_belief_impact || request.what_makes_them_stop) {
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
    promptParts.push('**⚠️⚠️⚠️ KRITIS - KONSEP UTAMA FALSE BELIEF (SUKA ANGGAP ENTENG MASALAH)');
    promptParts.push('=============================================');
    promptParts.push(' - Dampak dari False Belief (Suka anggap enteng masalah) hampir selalu memperparah Impact awal.');
    promptParts.push(' - Karena menganggap sepele masalah→ nggak waspada → nggak ada pencegahan → masalah makin gede, makin mahal, reputasi ikut kena');
    promptParts.push(' - Pakai bahasa sederhana seperti "anggap enteng masalah" (harus menggunakan bahasa yang mudah dipahami) dan relatable. Tunjukin koneksi jelas antara "yang dianggap enteng" dengan dampak yang makin parah.');
    promptParts.push('');
    promptParts.push('');
  }
  
  // Feature & Competitive Advantage
  if (request.feature_name || request.feature_description || request.competitive_advantage) {
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
  if (request.solution) {
    promptParts.push(`## Solusi ##`);
    promptParts.push('============');
    promptParts.push(`${request.solution}`);
    promptParts.push('');
    promptParts.push('');
  }
  
  // Selling Approach
  if (request.selling_approach) {
    promptParts.push('## Pendekatan Penjualan ##');
    promptParts.push('==========================');
    if (request.selling_approach === 'Tanpa Produk') {
      promptParts.push('- **Pendekatan:** Tanpa Produk - Fokus edukasi/informasi umum, TIDAK menyebut produk/layanan spesifik. Berikan insight/tips yang bermanfaat, gunakan solusi umum/konsep jika perlu.');
    } else if (request.selling_approach === 'Soft Selling') {
      promptParts.push('- **Pendekatan:** Soft Selling - Sebutkan produk secara subtle & natural, fokus value/benefit (bukan detail fitur), hindari hard sell. Gunakan storytelling/edukasi yang mengarah ke produk secara halus.');
    } else if (request.selling_approach === 'Hard Selling') {
      promptParts.push('- **Pendekatan:** Hard Selling - 100% fokus produk, fitur detail & konkret, value proposition jelas, jelaskan cara kerja fitur, bandingkan dengan alternatif, CTA langsung ke produk.');
    }
    promptParts.push('');
    promptParts.push('');
  }
  
  // Hook Information
  if (request.hook_name || request.hook_content) {
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
      promptParts.push('- **⚠️ Hook:** Gunakan sebagai referensi, susun ulang natural (jangan copy-paste). Ringkas & impactful: 1-2 kalimat untuk video (3-5 detik) atau 1 kalimat untuk post/carousel. Adaptasi template seperti "[X] dari pada [Y]" dengan konteks spesifik. Gunakan pause 1-2 detik setelah hook untuk membangun tension.');
    }
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
  
  // Instructions for ChatGPT - More focused and concise
  promptParts.push('## Instruksi ##');
  promptParts.push('===============');
  
  // Add keyword instructions at the beginning if keywords exist and useKeyword is enabled
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
  
  promptParts.push('Berdasarkan informasi di atas, buatkan script konten digital marketing yang:');
  promptParts.push('');
  if (request.hook_content) {
    promptParts.push('1. Menggunakan hook yang sudah disediakan di bagian "Hook untuk Script" sebagai dasar, kemudian susun ulang dengan bahasa yang lebih natural, mudah dipahami, dan engaging untuk menarik perhatian di awal');
  } else {
    promptParts.push('1. Menarik perhatian di awal (hook yang kuat dan relevan)');
  }
  promptParts.push('2. Menjelaskan masalah dengan jelas sesuai konteks target audience');
  promptParts.push('3. Menunjukkan dampak konkret dari masalah tersebut');
  if (request.selling_approach === 'Tanpa Produk') {
    promptParts.push('4. Menawarkan solusi umum yang relevan dan menarik, TIDAK menyebutkan produk/layanan spesifik');
    promptParts.push('5. Menjelaskan benefit dan value dari solusi secara umum, tanpa promosi produk');
    promptParts.push('6. Memiliki call-to-action yang edukatif dan informatif, bukan promosi produk');
  } else if (request.selling_approach === 'Soft Selling') {
    promptParts.push('4. Menawarkan solusi yang relevan dan menarik dengan pendekatan soft, produk/layanan disebutkan secara subtle');
    promptParts.push('5. Menjelaskan benefit dan value proposition dengan fokus pada value untuk audience, bukan detail produk');
    promptParts.push('6. Memiliki call-to-action yang soft dan tidak agresif, lebih mengarah ke edukasi atau informasi');
  } else if (request.selling_approach === 'Hard Selling') {
    promptParts.push('4. Menawarkan solusi produk/layanan yang relevan dan menarik dengan fokus pada produk');
    promptParts.push('5. Menjelaskan benefit, value proposition dan positioning produk/layanan dengan jelas dan detail');
    promptParts.push('6. Memiliki call-to-action yang jelas, persuasif, dan langsung mengarah ke produk/layanan');
  } else {
    promptParts.push('4. Menawarkan solusi yang relevan dan menarik');
    promptParts.push('5. Menjelaskan benefit dan value proposition dengan jelas');
    promptParts.push('6. Memiliki call-to-action yang jelas, persuasif, dan actionable');
  }
  // Use style_name for instruction 7 - keep it short, details already in Style & Struktur section
  if (request.style_name) {
    promptParts.push(`7. Menggunakan style: ${request.style_name} (lihat detail di bagian ## Style & Struktur ##)`);
  } else if (request.style_instruksi) {
    promptParts.push(`7. Menggunakan style sesuai instruksi di bagian ## Style & Struktur ##`);
  }
  // Keep structure reference short
  if (request.structure) {
    const instructionNumber = (request.style_name || request.style_instruksi) ? '8' : '7';
    promptParts.push(`${instructionNumber}. Mengikuti struktur yang telah dijelaskan di bagian ## Style & Struktur ##`);
    
    // Add reminder for Tarik-Tahan-Tembak structure
    const structureLower = request.structure.toLowerCase();
    if (structureLower.includes('tarik') && structureLower.includes('tahan') && structureLower.includes('tembak')) {
      promptParts.push('');
      promptParts.push('**⚠️ PENTING - Penerapan Struktur "Tarik-Tahan-Tembak":**');
      promptParts.push('- Struktur ini HARUS terasa sebagai pola narasi yang natural, bukan sekadar label');
      promptParts.push('- Gunakan PAUSE efektif untuk membangun tension: pause 2-3 detik setelah hook, pause 1-2 detik sebelum solusi');
      promptParts.push('- Timing pause sangat penting untuk membangun anticipation dan engagement');
    }
  }
  
  promptParts.push('');
  promptParts.push('');
  promptParts.push('**⚠️ WAJIB DIPENUHI:**');
  promptParts.push('=======================');
  promptParts.push('- Semua field yang diisi HARUS muncul dan dieksplorasi dalam script (Keinginan, Kebutuhan, Hidden Needs, Problem, Impact, yang dianggap enteng, dampaknya, What Makes Them Stop, Feature, Feature Description, Competitive Advantage, Solution');
  promptParts.push('');
  if (request.kebutuhan) {
    const needInstr = request.selling_approach === 'Tanpa Produk' 
      ? '→ Solusi umum (tanpa produk spesifik)'
      : request.selling_approach === 'Soft Selling'
      ? '→ Solusi soft, fokus benefit'
      : '→ Solusi spesifik, tunjukkan fitur konkret';
    promptParts.push(`- Kebutuhan: ${request.kebutuhan} ${needInstr}`);
    promptParts.push('');
  }
  if (request.hidden_needs) {
    promptParts.push(`- Hidden Needs: ${request.hidden_needs} → Jawab dengan hook emosional`);
    promptParts.push('');
  }
  if (request.false_belief || request.false_belief_impact || request.what_makes_them_stop) {
    if (request.false_belief) {
      promptParts.push(`- Yang dianggap enteng: ${request.false_belief} → Jelaskan dengan bahasa casual, tunjukkan kenapa "nggak waspada" bikin bahaya`);
      promptParts.push('');
    }
    if (request.false_belief_impact) {
      promptParts.push(`- Dampaknya: ${request.false_belief_impact} → TEKANKAN: bikin Impact awal makin parah`);
      promptParts.push('');
    }
    if (request.what_makes_them_stop) {
      promptParts.push(`- What Makes Them Stop: ${request.what_makes_them_stop} → Tunjukkan solusi`);
      promptParts.push('');
    }
    promptParts.push('- FOKUS: Anggapan enteng → Nggak waspada → Masalah makin gede');
  }
  if (request.feature_name || request.feature_description || request.competitive_advantage) {
    promptParts.push('- Feature & Keunggulan: Bahasa sederhana, fokus benefit, value proposition jelas');
    if (request.feature_name) promptParts.push(`  - Feature: ${request.feature_name}`);
    if (request.feature_description) promptParts.push(`  - Deskripsi: ${request.feature_description}`);
    if (request.competitive_advantage) promptParts.push(`  - Keunggulan: ${request.competitive_advantage}`);
  }
  const pillarLowerForSolution = (request.content_pillar || '').toLowerCase();
  const isStoryOrMotivational = pillarLowerForSolution.includes('story') || pillarLowerForSolution.includes('motivational') || pillarLowerForSolution.includes('motivasi');
  
  if (request.selling_approach === 'Tanpa Produk') {
    promptParts.push('- Solution: Umum/konseptual,  TIDAK menyebut produk spesifik. Bahasa edukatif.');
  } else if (request.selling_approach === 'Soft Selling') {
    promptParts.push(isStoryOrMotivational ? '- Solution: Sesuai pillar Story/Motivational' : '- Solution: Produk subtle, fokus benefit, bahasa edukatif');
  } else if (request.selling_approach === 'Hard Selling') {
    promptParts.push(isStoryOrMotivational ? '- Solution: Story/Motivational, fokus produk' : '- Solution: Spesifik - platform/fitur, cara kerja, detail terukur. Format: "Fitur #1: [nama] - Cara kerja: [penjelasan]"');
  } else {
    promptParts.push(isStoryOrMotivational ? '- Solution: Sesuai pillar Story/Motivational' : '- Solution: Spesifik - platform/fitur, cara kerja, detail terukur');
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
  
  promptParts.push('## Format Output Script ##');
  promptParts.push('==========================');
  
  // Format output berdasarkan content type
  const contentTypeLower = (request.content_type || '').toLowerCase();
  
  if (contentTypeLower === 'carousel' || contentTypeLower === 'post') {
    if (request.slide) {
      promptParts.push(`Untuk format ${request.content_type} dengan ${request.slide} slide, berikan output dalam format berikut:`);
      promptParts.push('');
      promptParts.push('**⚠️ PENTING - Instruksi Copywriting untuk Slide:**');
      promptParts.push('====================================================');
      promptParts.push('- **Ukuran Slide:** Setiap slide berukuran 1080 x 1080 piksel (format persegi/instagram square)');
      promptParts.push('- **Copywriting Realistis:** Copy harus REALISTIS dan TIDAK TERLALU PANJANG agar design carousel/post tidak terlalu full');
      promptParts.push('- **Prinsip Copywriting:**');
      promptParts.push('  • Maksimal 2-3 kalimat pendek per slide (jangan lebih dari 15-20 kata per slide)');
      promptParts.push('  • Gunakan kalimat yang ringkas, padat, dan mudah dibaca');
      promptParts.push('  • Hindari copy yang terlalu panjang yang akan membuat slide terlihat penuh dan sulit dibaca');
      promptParts.push('  • Prioritaskan pesan utama yang ingin disampaikan di setiap slide');
      promptParts.push('  • Pastikan copy proporsional dengan ruang visual yang tersedia (1080x1080)');
      promptParts.push('  • Copy harus mudah dibaca dalam waktu singkat (3-5 detik per slide)');
      promptParts.push('');
      promptParts.push('**Gunakan garis pembatas untuk setiap section:**');
      promptParts.push('');
      if (request.judul || request.judul_custom) {
        if (shouldUseKeywords) {
          const firstKeyword = request.keywords![0];
          if (request.keywords!.length > 1) {
            promptParts.push(`1. **Judul Script** (gunakan template judul yang sudah disediakan, ganti [ ] dengan konten yang relevan. ⚠️ SISIPKAN keyword PERTAMA: "${firstKeyword}" jika memungkinkan secara natural. Gunakan hanya keyword pertama, Jika Tidak memungkinkan di gabungkan dengan template judul, maka boleh diabaikan penggunaan keyword)`);
          } else {
            promptParts.push(`1. **Judul Script** (gunakan template judul yang sudah disediakan, ganti [ ] dengan konten yang relevan. ⚠️ SISIPKAN keyword: "${firstKeyword}" jika memungkinkan secara natural, Jika Tidak memungkinkan di gabungkan dengan template judul, maka boleh diabaikan penggunaan keyword)`);
          }
        } else {
          promptParts.push('1. **Judul Script** (gunakan template judul yang sudah disediakan, ganti [ ] dengan konten yang relevan)');
        }
      } else {
        if (shouldUseKeywords) {
          const firstKeyword = request.keywords![0];
          if (request.keywords!.length > 1) {
            promptParts.push(`1. **Judul Script** (singkat dan menarik. ⚠️ SISIPKAN keyword PERTAMA: "${firstKeyword}" jika memungkinkan secara natural. Gunakan hanya keyword pertama, Jika Tidak memungkinkan di gabungkan dengan template judul, maka boleh diabaikan penggunaan keyword)`);
          } else {
            promptParts.push(`1. **Judul Script** (singkat dan menarik. ⚠️ SISIPKAN keyword: "${firstKeyword}" jika memungkinkan secara natural, Jika Tidak memungkinkan di gabungkan dengan template judul, maka boleh diabaikan penggunaan keyword)`);
          }
        } else {
          promptParts.push('1. **Judul Script** (singkat dan menarik)');
        }
      }
      promptParts.push('2. **Format & Style** (format konten dan tone)');
      promptParts.push(`3. **Breakdown per Slide** (untuk setiap slide dari ${request.slide} slide, berikan:`);
      promptParts.push('   - **Visual Suggestion:** Deskripsi singkat visual/gambar yang sesuai');
      if (shouldUseKeywords) {
        promptParts.push(`   - **Copy:** Teks/konten yang akan ditampilkan di slide tersebut (MAKSIMAL 2-3 kalimat pendek, realistis untuk ukuran 1080x1080). HARUS menggunakan keyword: ${request.keywords!.join(', ')}`);
      } else {
        promptParts.push('   - **Copy:** Teks/konten yang akan ditampilkan di slide tersebut (MAKSIMAL 2-3 kalimat pendek, realistis untuk ukuran 1080x1080)');
      }
      promptParts.push('   - **Element tambahan:** (jika ada) seperti hashtag, CTA, dll');
      promptParts.push('');
      promptParts.push('   **Gunakan sub-separator (───) di antara setiap slide untuk memudahkan pembacaan**');
      promptParts.push('');
      promptParts.push('Pastikan setiap slide memiliki alur yang jelas dan saling terhubung.');
      promptParts.push('');
      promptParts.push('**⚠️ REMINDER:** Copy harus REALISTIS dan TIDAK TERLALU PANJANG untuk ukuran slide 1080x1080!');
    } else {
      promptParts.push(`Untuk format ${request.content_type}, berikan output dalam format:`);
      promptParts.push('');
      promptParts.push('**⚠️ PENTING - Instruksi Copywriting untuk Post:**');
      promptParts.push('==================================================');
      promptParts.push('- **Ukuran Post:** Post berukuran 1080 x 1080 piksel (format persegi/instagram square)');
      promptParts.push('- **Copywriting Realistis:** Copy harus REALISTIS dan TIDAK TERLALU PANJANG agar design post tidak terlalu full');
      promptParts.push('- **Prinsip Copywriting:**');
      promptParts.push('  • Copy harus ringkas dan mudah dibaca dalam format 1080x1080');
      promptParts.push('  • Hindari copy yang terlalu panjang yang akan membuat post terlihat penuh');
      promptParts.push('  • Prioritaskan pesan utama yang ingin disampaikan');
      promptParts.push('  • Copy harus proporsional dengan ruang visual yang tersedia');
      promptParts.push('');
      promptParts.push('**Gunakan garis pembatas untuk setiap section:**');
      promptParts.push('');
      if (request.judul || request.judul_custom) {
        promptParts.push('- **Judul Script** (gunakan template judul yang sudah disediakan, ganti [ ] dengan konten yang relevan)');
      } else {
        promptParts.push('- **Judul Script**');
      }
      promptParts.push('- **Visual Suggestion** (deskripsi singkat visual)');
      if (shouldUseKeywords) {
        promptParts.push(`- **Copy/Konten** (teks lengkap untuk konten - REALISTIS untuk ukuran 1080x1080, tidak terlalu panjang. Dari total keseluruhan slide, setikaknya HARUS menggunakan maksimal 2 keyword: ${request.keywords!.join(', ')}) - Jika di dalam text atau copy Tidak memungkinkan menggunakan keyword, maka boleh diabaikan penggunaan keyword`);
      } else {
        promptParts.push('- **Copy/Konten** (teks lengkap untuk konten - REALISTIS untuk ukuran 1080x1080, tidak terlalu panjang)');
      }
      promptParts.push('');
      promptParts.push('**⚠️ REMINDER:** Copy harus REALISTIS dan TIDAK TERLALU PANJANG untuk ukuran post 1080x1080!');
    }
  } else if (contentTypeLower === 'reel' || contentTypeLower === 'story' || contentTypeLower === 'youtube') {
    const duration = request.duration_value ? `${request.duration_value} ${request.duration_unit || 'menit'}` : 
                     request.duration_minutes ? `${request.duration_minutes} menit` : 'sesuai durasi';
    
    // Calculate total seconds
    let totalSeconds = 60; // default 60 seconds
    if (request.duration_value) {
      totalSeconds = request.duration_unit === 'detik' 
        ? request.duration_value 
        : request.duration_value * 60;
    } else if (request.duration_minutes) {
      totalSeconds = request.duration_minutes * 60;
    }
    
    promptParts.push(`Untuk format ${request.content_type} dengan durasi ${duration} (total ${totalSeconds} detik), berikan output dalam format berikut:`);
    promptParts.push('');
    if (request.judul || request.judul_custom) {
      if (shouldUseKeywords) {
        const firstKeyword = request.keywords![0];
        if (request.keywords!.length > 1) {
          promptParts.push(`1. **Judul Script** (gunakan template judul yang sudah disediakan, ganti [ ] dengan konten yang relevan. ⚠️ SISIPKAN keyword PERTAMA: "${firstKeyword}" jika memungkinkan secara natural. Gunakan hanya keyword pertama, Jika Tidak memungkinkan di gabungkan dengan template judul, maka boleh diabaikan penggunaan keyword)`);
        } else {
          promptParts.push(`1. **Judul Script** (gunakan template judul yang sudah disediakan, ganti [ ] dengan konten yang relevan. ⚠️ SISIPKAN keyword: "${firstKeyword}" jika memungkinkan secara natural, Jika Tidak memungkinkan di gabungkan dengan template judul, maka boleh diabaikan penggunaan keyword)`);
        }
      } else {
        promptParts.push('1. **Judul Script** (gunakan template judul yang sudah disediakan, ganti [ ] dengan konten yang relevan)');
      }
    } else {
      if (shouldUseKeywords) {
        const firstKeyword = request.keywords![0];
        if (request.keywords!.length > 1) {
          promptParts.push(`1. **Judul Script** (singkat dan menarik. ⚠️ SISIPKAN keyword PERTAMA: "${firstKeyword}" jika memungkinkan secara natural. Gunakan hanya keyword pertama, Jika Tidak memungkinkan di gabungkan dengan template judul, maka boleh diabaikan penggunaan keyword)`);
        } else {
          promptParts.push(`1. **Judul Script** (singkat dan menarik. ⚠️ SISIPKAN keyword: "${firstKeyword}" jika memungkinkan secara natural, Jika Tidak memungkinkan di gabungkan dengan template judul, maka boleh diabaikan penggunaan keyword)`);
        }
      } else {
        promptParts.push('1. **Judul Script** (singkat dan menarik)');
      }
    }
    promptParts.push('2. **Format & Style** (format konten dan tone)');
    promptParts.push('3. **Breakdown Script dalam bentuk TABLE (HARUS tepat ' + totalSeconds + ' detik):**');
    promptParts.push('');
    promptParts.push('');
    promptParts.push('## FORMAT TABLE: ##');
    promptParts.push('===================');
    promptParts.push('| Timing | VO (Voice Over) | Visual | Element Lainnya | Tagging |');
    promptParts.push('|--------|-----------------|--------|-----------------|---------|');
    promptParts.push('| 0-3s   | [Script VO]     | [Visual detail] | [SFX/Music/Text overlay] | [Tagging] |');
    promptParts.push('');
    promptParts.push('**⚠️ WAJIB — HEADER & STRUKTUR TABEL BREAKDOWN (100% SAMA DENGAN CONTOH):**');
    promptParts.push(
      'Salin PERSIS baris header berikut ke output (termasuk tanda `|` di awal/akhir); jangan ubah ejaan, huruf besar/kecil, atau spasi pada nama kolom:',
    );
    promptParts.push(
      '| Timing | VO (Voice Over) | Visual | Element Lainnya | Tagging |',
    );
    promptParts.push(
      'TEPAT LIMA kolom data — tidak boleh 4, tidak boleh 6. Kolom ke-4 HARUS bernama persis **Element Lainnya** (bukan "Text On Screen", "Teks di Layar", "On-Screen Text", "Audio", atau nama lain). Teks/on-screen/SFX tambahan yang bukan narasi VO tetap masuk ke **Element Lainnya**.',
    );
    promptParts.push(
      'Kolom ke-5 HARUS ada dan bernama persis **Tagging** — dilarang menghapus kolom ini. Setiap baris isi script (setelah header) WAJIB mengisi kolom Tagging dengan tag sesuai PERATURAN tagging di bawah (format kata-kunci Indonesia dipisah `-`); jangan biarkan sel Tagging kosong.',
    );
    promptParts.push(
      'DILARANG mengganti/menyederhanakan kolom lain: Scene/Visual, Scene/V, Audio/Teks di Layar, Narasi, Durasi (detik) sebagai header. Durasi hanya lewat kolom **Timing** (0-3s, dll.).',
    );
    promptParts.push(
      'Jangan menyertakan kolom `Action` di markdown hasil — hanya lima kolom di atas (UI aplikasi bisa menambah kolom aksi terpisah).',
    );
    promptParts.push('');
    promptParts.push('## Detail kolom: ##');
    promptParts.push('===================');
    promptParts.push('');
    promptParts.push('**Timing**');
    promptParts.push('Range waktu spesifik (contoh: "0-3s", "3-8s")');
    promptParts.push('');
    promptParts.push('**VO**');
    if (shouldUseKeywords) {
      promptParts.push(`Script yang diucapkan dengan timing tepat. HARUS menggunakan keyword: ${request.keywords!.join(', ')}`);
    } else {
      promptParts.push('Script yang diucapkan dengan timing tepat.');
    }
    promptParts.push('');
    promptParts.push('**VO - Nama fitur/produk**');
    promptParts.push('Saat memperkenalkan solusi, di awal cukup sebutkan LAYANAN saja (misalnya Etix). Nama FITUR (misalnya Dashboard Seller) tidak wajib disebut di awal—sering kali lebih natural jika fitur disebutkan nanti di tengah atau akhir paragraf, saat menjelaskan benefit atau cara kerja.');
    promptParts.push('Jangan paksa "namanya [Fitur] dari [Layanan]" di kalimat pertama solusi. Susun kalimat agar enak diucapkan; jangan tempel nama begitu saja.');
    promptParts.push('');
    promptParts.push('Contoh kurang pas (fitur dipaksa di awal):');
    promptParts.push('"Sampai akhirnya aku nemu solusinya, namanya Dashboard Seller dari Etix."');
    promptParts.push('');
    promptParts.push('Contoh lebih natural (layanan dulu, fitur nanti di paragraf):');
    promptParts.push('"Sampai akhirnya aku nemu solusinya dari Etix. Ada fitur Dashboard Seller—semua pendaftaran dan pembayaran masuk otomatis ke satu dashboard, nggak perlu validasi manual."');
    promptParts.push('"Aku pakai Etix. Di dalamnya ada Dashboard Seller, jadi semua pembayaran bisa aku cek real-time."');
    promptParts.push('');
    promptParts.push('**Visual**');
    if (shouldUseKeywords) {
      promptParts.push(`Deskripsi SANGAT SPESIFIK - frame-by-frame, jenis visual/graphic, text overlay (font/warna/animasi) yang HARUS menampilkan keyword: ${request.keywords!.join(', ')}, transisi, ekspresi/gesture host, background/setting.`);
    } else {
      promptParts.push('Deskripsi SANGAT SPESIFIK - frame-by-frame, jenis visual/graphic, text overlay (font/warna/animasi), transisi, ekspresi/gesture host, background/setting.');
    }
    promptParts.push('');
    promptParts.push('**Element Lainnya**');
    promptParts.push('SFX/Music cues, text overlay tambahan.');
    promptParts.push('');
    promptParts.push('**Tagging**');
    promptParts.push('Tag detail untuk Visual yang di shoot, mempermudah pencarian clip saat editing.');
    promptParts.push('');
    promptParts.push('PERATURAN:');
    promptParts.push('(1) TAG harus KATA KUNCI BAHASA INDONESIA dipisahkan tanda hubung (-)');
    promptParts.push('(2) HANYA tag informasi yang disebutkan dalam deskripsi visual');
    promptParts.push('(3) Urutan: JENIS_SHOT-GERAKAN_KAMERA-SUBJEK-AKSI-SETTING-WAKTU-SUASANA');
    promptParts.push('(4) HENTIKAN jika informasi sudah habis (jangan tambahkan elemen kosong)');
    promptParts.push('');
    promptParts.push('Contoh:');
    promptParts.push('• Close-up wajah wanita tersenyum di taman siang hari, kamera diam → "CU-diam-wanita-tersenyum-taman-siang"');
    promptParts.push('• Medium shot pria berjalan di kantor, kamera follow → "MS-follow-pria-berjalan-kantor"');
    promptParts.push('• Wide shot kerumunan di konser malam hari → "WS-kerumunan-konser-malam"');
    promptParts.push('');
    promptParts.push('Setting: Wajib mengisi apakah "Indoor" atau "Outdoor", lalu jelaskan detailnya (Indoor: studio, kamar, dll; Outdoor: taman, jalan, dll).');
    promptParts.push('');
    promptParts.push('');
    promptParts.push('## ⚠️ KRITIS - TIMING: ## )');
    promptParts.push('==========================');
    promptParts.push('- Setiap baris, Kolom VO harus bisa menyesuaikan jumlah kalimat yang di ucapkan dengan kolom timing');
    promptParts.push('- Untuk video pendek (≤60 detik), setiap section harus sangat ringkas dan impactful');
    promptParts.push('- Total durasi SEMUA bagian HARUS tepat 30 detik (tidak lebih tidak kurang)');
    promptParts.push('- Jangan membuat section terlalu panjang, prioritaskan kejelasan dan impact');
    promptParts.push('');
    promptParts.push('');
    promptParts.push('## ⚠️ CTA HARUS sangat jelas, urgent, dan actionable: ##');
    promptParts.push('======================================================');
    if (request.cta_type === 'use_solution') {
      if (request.solution) {
        promptParts.push('  - **TIPE CTA: Menggunakan Solution** - CTA harus mengarahkan ke Solution yang sudah dijelaskan');
        promptParts.push(`  - Solution yang digunakan: ${request.solution}`);
        promptParts.push('  - CTA harus mengajak audience untuk mengambil tindakan berdasarkan Solution tersebut');
        promptParts.push('  - Sebutkan benefit spesifik dari Solution (contoh: "Coba Solution ini sekarang!", "Implementasikan Solution ini untuk hasil maksimal")');
      } else {
        promptParts.push('  - **TIPE CTA: Menggunakan Solution** - ⚠️ PERINGATAN: Field Solution belum diisi, pastikan Solution sudah diisi di accordion "Product/Service Details"');
      }
    } else if (request.cta_type === 'use_comment') {
      promptParts.push('  - **TIPE CTA: Menggunakan Comment untuk Engagement dan Leads**');
      promptParts.push('  - CTA harus meminta audience untuk memberikan comment/komentar');
      promptParts.push('  - Fokus pada engagement: ajak audience untuk share pengalaman, pertanyaan, atau pendapat mereka');
      promptParts.push('  - Contoh CTA comment: "KOMEN di bawah pengalaman kamu!", "Tulis di comment apa yang ingin kamu tanyakan", "Share di comment jika kamu pernah mengalami hal ini"');
      promptParts.push('  - CTA comment harus spesifik dan mudah diikuti, hindari generic seperti "Komentar di bawah"');
      promptParts.push('  - Tambahkan sense of urgency atau value (contoh: "KOMEN sekarang, saya akan reply semua!", "KOMEN \'YA\' jika setuju, saya akan share tips lebih lanjut")');
    } else {
      // Default CTA instructions if no cta_type selected
      promptParts.push('  - Sebutkan benefit spesifik dari CTA (contoh: "FREE ROI Calculator", "FREE 30 menit strategy session")');
      promptParts.push('  - Tambahkan sense of urgency (contoh: "Cuma untuk 5 pertama", "Slot terbatas", "Hari ini saja")');
      promptParts.push('  - CTA harus spesifik dan mudah diikuti (contoh: "KOMEN \'COMPARE\' sekarang!" bukan hanya "Hubungi kami")');
    }
    promptParts.push('  - Panjang CTA: untuk video ≤60 detik, maksimal 5 detik; untuk video lebih panjang, maksimal 10 detik');
    promptParts.push('- Jika perlu mengurangi durasi suatu bagian, prioritaskan untuk mempertahankan hook dan CTA yang kuat');
  } else {
    promptParts.push('Berikan output script dalam format yang jelas dan terstruktur, dengan breakdown per bagian/section.');
  }
  promptParts.push('');
  promptParts.push('');
  promptParts.push('## Prinsip Utama:##');
  promptParts.push('===================');
  promptParts.push('- Gunakan bahasa natural dan yang mudah di pahami, conversational, kalimat pendek, struktur sederhana');
  promptParts.push('- Nama layanan (brand) boleh disebut di awal saat memperkenalkan solusi. Nama fitur tidak wajib di awal—sebutkan di tengah atau akhir paragraf ketika konteksnya pas (misalnya saat jelaskan benefit/cara kerja), dengan cara natural untuk diucapkan.');
  promptParts.push('- hindari bahasa yang sulit di pahami seperti "False belief", "Blind Spot" dan lain lain');
  promptParts.push('- Jika konsep kompleks, gunakan analogi/contoh sehari-hari');
  promptParts.push('- Script harus sesuai durasi/format, engaging, dan mudah dipahami');
  promptParts.push('');
  promptParts.push('');
  promptParts.push('## CAPTION - WAJIB DIBUAT: ##');
  promptParts.push('=============================');
  promptParts.push('Setelah script selesai, buatkan CAPTION Dengan Singkat dan padat (Maksimal 50 kata) yang mencerminkan semua informasi field yang diisi.');
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
  promptParts.push('');
  promptParts.push('## Struktur: ##');
  promptParts.push('===============');
  promptParts.push('[Opening/Hook 1-2 kalimat]');
  promptParts.push('');
  if (shouldUseKeywords) {
    promptParts.push('[Body: harus berdasarkan analisa dari penjelasan di ## Style & Struktur ## sampai dengan ## Instruksi ## dan boleh di acak atau tidak harus berurutan, yang penting hasilnya bagus, di tambah solusi, benefit dari semua field. BAGI menjadi beberapa paragraf yang terstruktur dengan baik. SETIAP PARAGRAF harus mengandung keyword secara natural]');
  } else {
    promptParts.push('[Body: harus berdasarkan analisa dari penjelasan di ## Style & Struktur ## sampai dengan ## Instruksi ## dan boleh di acak atau tidak harus berurutan, yang penting hasilnya bagus, di tambah solusi, benefit dari semua field. BAGI menjadi beberapa paragraf yang terstruktur dengan baik]');
  }
  promptParts.push('');
  promptParts.push('[CTA yang jelas dan actionable]');
  if (request.cta_type === 'use_solution') {
    if (request.solution) {
      promptParts.push('  - **CTA Type: Menggunakan Solution** - CTA caption harus mengarahkan ke Solution yang sudah dijelaskan');
      promptParts.push(`  - Solution: ${request.solution}`);
      promptParts.push('  - CTA harus mengajak audience untuk mengambil tindakan berdasarkan Solution tersebut');
    } else {
      promptParts.push('  - **CTA Type: Menggunakan Solution** - ⚠️ PERINGATAN: Field Solution belum diisi');
    }
  } else if (request.cta_type === 'use_comment') {
    promptParts.push('  - **CTA Type: Menggunakan Comment** - CTA caption harus meminta audience untuk memberikan comment');
    promptParts.push('  - Fokus pada engagement: ajak audience untuk share pengalaman, pertanyaan, atau pendapat mereka');
    promptParts.push('  - Contoh: "KOMEN di bawah pengalaman kamu!", "Tulis di comment apa yang ingin kamu tanyakan"');
  }
  promptParts.push('');

  // Hashtag section - use keywords if available and enabled
  promptParts.push('**⚠️ HASHTAG - WAJIB:**');
  promptParts.push('========================');
  promptParts.push('');
  if (shouldUseKeywords) {
    const keywordHashtags = request.keywords!.map(k => {
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
  promptParts.push('**Format Caption:** Gunakan emoji relevan, paragraf jelas, tone sesuai style.');
  promptParts.push('');

  // Template Konsep Konten Sederhana - agar tujuan pembuatan konten lebih clear
  const hasProductDetails = request.feature_name || request.feature_description || request.solution || request.competitive_advantage;
  if (request.target_market || request.keinginan || request.kebutuhan || request.hidden_needs || request.problem || request.solution || hasProductDetails) {
    promptParts.push('## Concept of Content ##');
    promptParts.push('=========================');
    promptParts.push('');
    promptParts.push('Buatkan narasi konsep PADAT (max 2-3 kalimat) yang mencakup semua elemen di bawah. Format: 1 paragraf singkat, tidak bertele-tele.');
    promptParts.push('');
    promptParts.push('');
    promptParts.push('**Template konsep (ringkaskan ke dalam 1 paragraf):**');
    promptParts.push('');
    if (hasProductDetails) {
      const productName = request.feature_name || request.service_name || '[produk/layanan]';
      promptParts.push(`- **Produk/Layanan yang dibahas:** ${productName}`);
      if (request.feature_description) {
        promptParts.push(`  - Deskripsi: ${request.feature_description}`);
      }
      if (request.competitive_advantage) {
        promptParts.push(`  - Keunggulan: ${request.competitive_advantage}`);
      }
      promptParts.push('');
    }
    promptParts.push(`- **Target:** Menargetkan ${request.target_market || '[isi target]'}`);
    promptParts.push('');
    promptParts.push(`- **Keinginan:** Yang ingin ${request.keinginan || '[isi keinginan]'}`);
    promptParts.push('');
    promptParts.push(`- **Kebutuhan:** Dan butuh ${request.kebutuhan || '[isi kebutuhan]'}`);
    promptParts.push('');
    promptParts.push(`- **Hidden Needs:** Biar ${request.hidden_needs || '[isi kebutuhan tersembunyi]'}`);
    promptParts.push('');
    promptParts.push(`- **Masalah:** Tapi ${request.problem || '[isi masalah]'}`);
    promptParts.push('');
    promptParts.push(`- **Solusi:** ${request.solution || '[isi solusi]'}`);
    promptParts.push('');
    promptParts.push('');
    promptParts.push('**⚠️ WAJIB:** Konsep harus PADAT (2-3 kalimat saja). Gabungkan semua poin jadi satu paragraf singkat. Jangan ulangi detail. Script utama tetap mengacu pada konsep ini.');
    promptParts.push('');
    if (hasProductDetails) {
      promptParts.push('**⚠️ WAJIB - FITUR:** Jika ada Produk/Layanan yang dibahas di atas, konsep HARUS juga menyebutkan fitur-fitur utama produk/layanan tersebut #dengan singkat dan padat# secara natural dalam paragraf. Jangan hanya narasi target-masalah-solusi umum; sertakan apa yang ditawarkan produk (fitur, benefit) agar konsep jelas membahas produk yang dimaksud.');
      promptParts.push('');
    }
    promptParts.push('**Format output:** Awali script dengan ## Konsep Konten ## (atau ## Concept of Content ##) diikuti paragraf konsep, lalu baris kosong, baru Judul Script dan section lainnya.');
    promptParts.push('');
    promptParts.push('');
  }

  // STRUKTUR OUTPUT WAJIB - agar Caption dan Concept bisa di-save di popup Save to Plan / Brief Content
  promptParts.push('**⚠️ STRUKTUR OUTPUT WAJIB (untuk Save to Plan / Brief Content):**');
  promptParts.push('================================================================');
  promptParts.push('1. CAPTION: Script HARUS memuat tepat satu blok CAPTION dengan format PERSIS seperti berikut (judul di baris sendiri, teks caption di baris berikutnya):');
  promptParts.push('   ## CAPTION ##');
  promptParts.push('   [teks caption singkat dan padat di sini, maksimal 50 kata]');
  promptParts.push('   Jangan gunakan variasi lain (mis. hanya "Caption:" tanpa ##). Tanpa blok ini, Caption tidak bisa disimpan ke plan.');
  promptParts.push('');
  promptParts.push('2. KONSEP (jika ada): Jika script menyertakan konsep, HARUS pakai heading PERSIS salah satu: ## Konsep Konten ## atau ## Concept of Content ## di baris sendiri, lalu baris baru, lalu isi paragraf konsep. Tanpa heading ini, Concept tidak bisa disimpan ke plan.');
  promptParts.push('');
  promptParts.push('3. Urutan akhir script: ... [tabel breakdown] ... lalu baris kosong, lalu ## CAPTION ##, lalu teks caption, lalu (opsional) ## Struktur ## atau **⚠️ HASHTAG** dan hashtag. Return HANYA script lengkap, tanpa penjelasan.');
  promptParts.push('');

  return promptParts.join('\n');
}

