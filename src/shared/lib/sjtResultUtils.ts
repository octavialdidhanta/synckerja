/** SJT result logic: dynamic description, job match, caveats from dimension scores and A/B/C/D grades. */

export type SjtDimensionKey = 'etika' | 'komunikasi' | 'prioritas' | 'konflik' | 'prosedur';

const SJT_DIMENSION_KEYS: SjtDimensionKey[] = ['etika', 'komunikasi', 'prioritas', 'konflik', 'prosedur'];

export const SJT_DIMENSION_LABELS: Record<SjtDimensionKey, string> = {
  etika: 'Etika & Integritas',
  komunikasi: 'Komunikasi & Transparansi',
  prioritas: 'Prioritas & Koordinasi',
  konflik: 'Penanganan Konflik',
  prosedur: 'Kepatuhan Prosedur',
};

/** Per-dimension grade counts and weighted score (new format from sjt_submit_test). */
export interface SjtDimensionDetail {
  A: number;
  B: number;
  C: number;
  D: number;
  weighted: number;
}

/** New format: sjt_dimension_scores with total_weighted, count_A/B/C/D, and per-dimension details. */
export interface SjtScoresNewFormat {
  total_weighted?: number;
  count_A?: number;
  count_B?: number;
  count_C?: number;
  count_D?: number;
  etika?: number | SjtDimensionDetail;
  komunikasi?: number | SjtDimensionDetail;
  prioritas?: number | SjtDimensionDetail;
  konflik?: number | SjtDimensionDetail;
  prosedur?: number | SjtDimensionDetail;
}

function isDimensionDetail(v: number | SjtDimensionDetail | undefined): v is SjtDimensionDetail {
  return v != null && typeof v === 'object' && 'weighted' in v;
}

/** Normalize to per-dimension weighted and grade counts. Backward compatible with legacy { etika: number, ... }. */
function normalizeScores(
  scores: Record<string, unknown> | null | undefined
): {
  totalWeighted: number;
  countA: number;
  countB: number;
  countC: number;
  countD: number;
  dim: Record<SjtDimensionKey, { A: number; B: number; C: number; D: number; weighted: number }>;
} {
  const dim: Record<SjtDimensionKey, { A: number; B: number; C: number; D: number; weighted: number }> = {
    etika: { A: 0, B: 0, C: 0, D: 0, weighted: 0 },
    komunikasi: { A: 0, B: 0, C: 0, D: 0, weighted: 0 },
    prioritas: { A: 0, B: 0, C: 0, D: 0, weighted: 0 },
    konflik: { A: 0, B: 0, C: 0, D: 0, weighted: 0 },
    prosedur: { A: 0, B: 0, C: 0, D: 0, weighted: 0 },
  };
  let totalWeighted = 0;
  let countA = 0;
  let countB = 0;
  let countC = 0;
  let countD = 0;

  if (!scores || typeof scores !== 'object') {
    return { totalWeighted, countA, countB, countC, countD, dim };
  }

  const raw = scores as SjtScoresNewFormat;
  totalWeighted = Number(raw.total_weighted) || 0;
  countA = Number(raw.count_A) || 0;
  countB = Number(raw.count_B) || 0;
  countC = Number(raw.count_C) || 0;
  countD = Number(raw.count_D) || 0;

  for (const key of SJT_DIMENSION_KEYS) {
    const v = raw[key];
    if (isDimensionDetail(v)) {
      dim[key] = {
        A: Number(v.A) || 0,
        B: Number(v.B) || 0,
        C: Number(v.C) || 0,
        D: Number(v.D) || 0,
        weighted: Number(v.weighted) || 0,
      };
    } else {
      const legacyCount = Number(v) || 0;
      dim[key] = {
        A: legacyCount,
        B: 0,
        C: 0,
        D: 0,
        weighted: legacyCount * 4,
      };
    }
  }

  return { totalWeighted, countA, countB, countC, countD, dim };
}

/** Build one paragraph for a dimension: honest, formula-based. */
function dimensionSummary(
  key: SjtDimensionKey,
  d: { A: number; B: number; C: number; D: number; weighted: number }
): string {
  const label = SJT_DIMENSION_LABELS[key];
  const total = d.A + d.B + d.C + d.D;
  if (total === 0) return `${label}: tidak ada jawaban dalam dimensi ini.`;
  const parts: string[] = [];
  if (d.A > 0) parts.push(`${d.A} sangat baik`);
  if (d.B > 0) parts.push(`${d.B} baik`);
  if (d.C > 0) parts.push(`${d.C} cukup`);
  if (d.D > 0) parts.push(`${d.D} buruk`);
  const maxWeight = total * 4;
  const pct = maxWeight > 0 ? Math.round((d.weighted / maxWeight) * 100) : 0;
  return `${label}: ${parts.join(', ')} (skor tertimbang ${d.weighted}/${maxWeight}, setara ${pct}% dari maksimal).`;
}

/** Role suggestions by dimension (strong = high weighted or many A/B). */
const ROLES_BY_DIMENSION: Record<SjtDimensionKey, string> = {
  etika: 'Compliance, Internal Audit, Risk Management, HR kebijakan & etika, Legal, Quality Assurance.',
  komunikasi: 'Project Manager, Customer Success, HR engagement, Public Relations, Koordinator lintas divisi.',
  prioritas: 'Operations Manager, Project Coordinator, Supply Chain, Admin multi-stakeholder, Team Lead.',
  konflik: 'HR employee relations, Mediator, Team Lead, Customer Service complaint handling, Supervisor.',
  prosedur: 'Compliance Officer, Administrator, Finance & Accounting, Quality Control, Document Control, Safety Officer.',
};

export function getSjtResultFromScores(scores: Record<string, unknown> | SjtScoresNewFormat | null | undefined): {
  description: string;
  jobMatch: string;
  caveats: string;
} {
  const fallback = {
    description:
      'Profil berdasarkan pilihan dalam Tes Situasi Kerja. Selesaikan tes untuk melihat deskripsi dan rekomendasi peran.',
    jobMatch: '—',
    caveats: '',
  };

  const { totalWeighted, countA, countB, countC, countD, dim } = normalizeScores(
    scores as Record<string, unknown> | null | undefined
  );

  const totalAnswers = countA + countB + countC + countD;
  if (totalAnswers === 0) return fallback;

  const maxTotalWeight = totalAnswers * 4;
  const totalPct = maxTotalWeight > 0 ? Math.round((totalWeighted / maxTotalWeight) * 100) : 0;

  // Deskripsi dinamis: ringkasan skor lalu per dimensi
  const intro =
    `Berdasarkan ${totalAnswers} skenario, kandidat memperoleh skor tertimbang ${totalWeighted}/${maxTotalWeight} (setara ${totalPct}% dari maksimal). ` +
    `Komposisi jawaban: ${countA} sangat baik, ${countB} baik, ${countC} cukup, ${countD} buruk. `;
  const dimensionParagraphs = SJT_DIMENSION_KEYS.map((key) => dimensionSummary(key, dim[key]));
  const description = intro + 'Per dimensi: ' + dimensionParagraphs.join(' ') + ' ' +
    'Deskripsi di atas disusun secara otomatis dari pola jawaban dan tidak menggantikan penilaian wawancara atau assessment lanjutan.';

  // Rekomendasi peran: dimensi kuat (weighted relatif tinggi) vs lemah
  const dimWeightedList = SJT_DIMENSION_KEYS.map((key) => ({
    key,
    weighted: dim[key].weighted,
    total: dim[key].A + dim[key].B + dim[key].C + dim[key].D,
  })).filter((x) => x.total > 0);
  const maxDimWeight = Math.max(...dimWeightedList.map((x) => x.weighted), 1);
  const strongDims = dimWeightedList.filter((x) => x.total > 0 && x.weighted >= maxDimWeight * 0.6).map((x) => x.key);
  const weakDims = dimWeightedList.filter((x) => x.total > 0 && x.weighted <= maxDimWeight * 0.35).map((x) => x.key);

  const roleParts: string[] = [];
  if (strongDims.length > 0) {
    roleParts.push(
      'Dimensi yang relatif kuat dari pola jawaban: ' +
        strongDims.map((k) => SJT_DIMENSION_LABELS[k]).join(', ') +
        '. Rekomendasi peran yang sesuai: ' +
        strongDims.map((k) => ROLES_BY_DIMENSION[k]).join(' ')
    );
  }
  if (weakDims.length > 0) {
    roleParts.push(
      'Dimensi yang perlu perhatian: ' +
        weakDims.map((k) => SJT_DIMENSION_LABELS[k]).join(', ') +
        '. Untuk peran yang sangat mengandalkan dimensi tersebut, disarankan pelatihan atau pendampingan.'
    );
  }
  const jobMatch = roleParts.length > 0 ? roleParts.join(' ') : 'Berdasarkan pola jawaban, pertimbangkan penilaian per dimensi di atas untuk mencocokkan dengan kebutuhan peran.';

  // Catatan: skor rendah per dimensi
  const caveatsList: string[] = [];
  for (const key of SJT_DIMENSION_KEYS) {
    const d = dim[key];
    const n = d.A + d.B + d.C + d.D;
    if (n === 0) continue;
    const maxW = n * 4;
    const pct = maxW > 0 ? d.weighted / maxW : 0;
    if (pct <= 0.4 && (d.D >= 1 || d.C + d.D >= 2)) {
      caveatsList.push(
        `Skor ${SJT_DIMENSION_LABELS[key]} rendah (banyak jawaban cukup/buruk): untuk peran yang sangat mengandalkan dimensi ini, perlu perhatian atau assessment tambahan.`
      );
    }
  }
  const caveats = caveatsList.join(' ');

  return {
    description,
    jobMatch,
    caveats,
  };
}

/** Return per-dimension value for display: new format returns weighted, legacy returns number as-is. */
export function getDimensionDisplayValue(
  dimensionScores: Record<string, unknown> | null | undefined,
  key: SjtDimensionKey
): number {
  if (!dimensionScores || typeof dimensionScores[key] !== 'object') {
    return Number((dimensionScores as Record<string, number>)?.[key]) || 0;
  }
  const d = (dimensionScores[key] as SjtDimensionDetail);
  return Number(d?.weighted) ?? 0;
}
