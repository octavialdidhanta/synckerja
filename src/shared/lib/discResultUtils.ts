/** Shared DISC result logic: description, job match, level, caveats from scores. */

const SECONDARY_THRESHOLD = 15;

export type DiscLevel = 'Staf' | 'Supervisor' | 'Manager' | 'Direktur';

export function getDiscLevel(scores: { score_d: number; score_i: number; score_s: number; score_c: number }): DiscLevel {
  const d = Number(scores.score_d) || 0;
  const i = Number(scores.score_i) || 0;
  const s = Number(scores.score_s) || 0;
  const c = Number(scores.score_c) || 0;
  const maxVal = Math.max(d, i, s, c);
  const leadership = (d + i) / 2;
  if (maxVal >= 70 && (d >= 65 || i >= 65) && leadership >= 60) return 'Direktur';
  if (maxVal >= 65 && (d >= 58 || i >= 58)) return 'Manager';
  if (maxVal >= 55 || leadership >= 52) return 'Supervisor';
  return 'Staf';
}

function getDiscProfiles(): Record<string, { description: string; jobMatch: string }> {
  return {
    D: {
      description: 'Berorientasi pada hasil dan tantangan. Tegas, langsung, dan percaya diri. Senang memimpin dan mengambil keputusan cepat. Fokus pada tujuan dan efisiensi, termotivasi oleh kompetisi dan pencapaian.',
      jobMatch: 'Director, Manager, Business Development, Sales Leader, Project Manager, Entrepreneur, Operations Manager, General Manager.',
    },
    I: {
      description: 'Ramah, antusias, dan suka bersosialisasi. Komunikatif dan persuasif. Bekerja baik dalam tim, memotivasi orang lain, dan membangun relasi. Optimis dan energik.',
      jobMatch: 'Sales, Marketing, Public Relations, Customer Service, Trainer, Event Coordinator, HR (Recruitment), Spokesperson.',
    },
    S: {
      description: 'Sabar, stabil, dan dapat diandalkan. Kooperatif dan mendukung. Menciptakan lingkungan yang harmonis, menyelesaikan tugas dengan konsisten, dan setia. Lebih suka ritme yang teratur.',
      jobMatch: 'Administrator, Customer Support, Operations, Quality Assurance, Human Resources, Secretary, Logistics, Production (stabil).',
    },
    C: {
      description: 'Berorientasi pada kualitas dan ketepatan. Logis, analitis, dan memiliki standar tinggi. Fokus pada fakta dan prosedur. Ingin hasil terbaik dan suka dihargai atas kualitas kerja.',
      jobMatch: 'Engineering, Research, Finance, Accountant, Quality Controller, Safety Officer, Market Analyst, Planner, MIS Manager, Loss Control.',
    },
    DI: {
      description: 'Kombinasi orientasi hasil dengan kemampuan memengaruhi orang. Kompetitif sekaligus karismatik, senang memimpin dan memotivasi tim menuju target. Strategis dan suka membangun relasi untuk mencapai tujuan.',
      jobMatch: 'Sales Director, Consultant, Event Planner, Business Development Manager, Politician, Art Director, Team Leader (sales/marketing).',
    },
    DC: {
      description: 'Tegas dan berorientasi hasil, dengan fokus pada kualitas dan sistem. Mengambil keputusan cepat berdasarkan analisis. Efisien, tegas, dan menuntut standar tinggi pada diri dan tim.',
      jobMatch: 'Operations Manager, General Manager, Project Manager (teknis), Controller, Procurement, Strategic Planner.',
    },
    ID: {
      description: 'Antusias dan persuasif, dengan dorongan mencapai target. Senang bersosialisasi dan memimpin. Energik, optimis, dan mampu menggerakkan orang sekaligus fokus pada hasil.',
      jobMatch: 'Marketing Manager, Public Relations, Spokesperson, Trainer, Sales (high-touch), HR (recruitment/engagement).',
    },
    IS: {
      description: 'Ramah dan kooperatif, menciptakan suasana positif dan harmonis. Mendukung tim dan relasi. Optimis, sabar, dan suka kolaborasi tanpa konflik.',
      jobMatch: 'Customer Service, Event Coordinator, HR (people development), Community Manager, Trainer (soft skills).',
    },
    SC: {
      description: 'Stabil dan dapat diandalkan, dengan perhatian pada detail dan prosedur. Konsisten, kooperatif, dan berstandar tinggi. Menciptakan keharmonisan sambil menjaga kualitas.',
      jobMatch: 'Administrator, Quality Assurance, Logistics, Production (stabil), Secretary, Compliance, Customer Support (back-office).',
    },
    CS: {
      description: 'Analitis dan sistematis, dengan kebutuhan akan stabilitas dan kerja sama. Teliti, tenang, dan mendukung. Menghargai akurasi dan lingkungan yang teratur.',
      jobMatch: 'Accountant, Administrator, Quality Controller, Research Support, Data Analyst, Operations (back-office).',
    },
    SD: {
      description: 'Stabil dan mendukung, dengan kemampuan mengambil keputusan saat diperlukan. Sabar tapi tegas ketika dibutuhkan. Fokus pada konsistensi dan hasil jangka panjang.',
      jobMatch: 'Operations Manager, Project Coordinator, Team Lead (stabil), Supply Chain, Production Manager.',
    },
    CD: {
      description: 'Berorientasi kualitas dan hasil. Analitis dan tegas. Menetapkan standar tinggi dan mendorong efisiensi. Fokus pada fakta dan pencapaian target.',
      jobMatch: 'Finance Director, Quality Manager, Risk Manager, Internal Audit, Technical Project Manager.',
    },
  };
}

export function getDiscResultFromScores(scores: { score_d: number; score_i: number; score_s: number; score_c: number } | null): {
  description: string;
  jobMatch: string;
  level: DiscLevel;
  caveats: string;
} {
  const fallback = { ...getDiscProfiles().S, level: 'Staf' as DiscLevel, caveats: '' };
  if (!scores) return fallback;
  const d = Number(scores.score_d) || 0;
  const i = Number(scores.score_i) || 0;
  const s = Number(scores.score_s) || 0;
  const c = Number(scores.score_c) || 0;
  const ordered = [
    { key: 'D' as const, val: d },
    { key: 'I' as const, val: i },
    { key: 'S' as const, val: s },
    { key: 'C' as const, val: c },
  ].sort((a, b) => b.val - a.val);
  const primary = ordered[0]?.key ?? 'S';
  const primaryVal = ordered[0]?.val ?? 50;
  const secondary = ordered[1]?.key;
  const secondaryVal = ordered[1]?.val ?? 0;
  const useCombo = secondary != null && primaryVal - secondaryVal <= SECONDARY_THRESHOLD;
  const comboKey = useCombo ? `${primary}${secondary}` : primary;
  const profiles = getDiscProfiles();
  const base = profiles[comboKey] ?? profiles[primary] ?? profiles.S;
  const level = getDiscLevel(scores);
  const caveats: string[] = [];
  if (s < 38) caveats.push('Skor S (Steadiness) rendah: kurang nyaman dengan rutinitas dan stabilitas; dalam peran yang sangat terstruktur mungkin perlu pendampingan.');
  if (c < 38) caveats.push('Skor C (Conscientiousness) rendah: prioritas pada hasil dan orang daripada detail dan prosedur; untuk peran yang sangat mengandalkan kepatuhan prosedur perlu perhatian.');
  if (d >= 72 && i < 45) caveats.push('D sangat dominan dengan I rendah: tegas dan berorientasi hasil; dalam tim perlu kesadaran agar tidak mengabaikan perasaan atau masukan orang lain.');
  return { ...base, level, caveats: caveats.join(' ') };
}
