import type { ParentRelation, SupportRole } from "@/thinking-lab/big-thought/types";
import type { IndividualAdmission } from "@/thinking-lab/shared/verdict";

export type CertificationAdmission = IndividualAdmission | "NOT_VALID";

export type CertificationCase = {
  id: string;
  category: string;
  parentStatement: string;
  candidateStatement: string;
  expectedAdmission: CertificationAdmission;
  acceptableRelations?: ParentRelation[];
  acceptableSupportRoles?: SupportRole[];
  critical: boolean;
};

export type SiblingCertificationCase = {
  id: string;
  parentStatement: string;
  rows: Array<{ code: string; statement: string }>;
  expectDistinct: boolean;
  expectPair: { a: string; b: string } | null;
  critical: boolean;
};

const STEWARD_PARENT =
  "Kesungguhan memilih wadah pengelolaan merupakan bagian dari tanggung jawab pemberi.";

export const INDIVIDUAL_CERTIFICATION_CASES: CertificationCase[] = [
  {
    id: "restatement-continuation",
    category: "restatement",
    parentStatement: "Tanggung jawab pemberi tidak berhenti setelah dana diserahkan.",
    candidateStatement: "Tanggung jawab pemberi tetap berlanjut setelah dana diserahkan.",
    expectedAdmission: "GENERATE_REJECT",
    acceptableRelations: ["RESTATEMENT"],
    critical: true,
  },
  {
    id: "negation-inversion",
    category: "negation-inversion",
    parentStatement: "Tanggung jawab pemberi tidak berhenti setelah penyerahan dana.",
    candidateStatement: "Pemberi tetap memiliki tanggung jawab setelah dana berpindah tangan.",
    expectedAdmission: "GENERATE_REJECT",
    critical: true,
  },
  {
    id: "normative-elaboration",
    category: "elaboration",
    parentStatement: STEWARD_PARENT,
    candidateStatement:
      "Pemilihan wadah yang cermat merupakan bentuk integritas pemberi dalam menjalankan kewajibannya.",
    expectedAdmission: "GENERATE_REJECT",
    acceptableRelations: ["ELABORATION"],
    critical: true,
  },
  {
    id: "mixed-premise-conclusion",
    category: "mixed-conclusion",
    parentStatement: STEWARD_PARENT,
    candidateStatement:
      "Pemberian mencerminkan komitmen spiritual pemberi, sehingga pemilihan wadah yang bertanggung jawab harus dilakukan dengan sungguh-sungguh.",
    expectedAdmission: "GENERATE_REJECT",
    acceptableRelations: ["ELABORATION"],
    critical: true,
  },
  {
    id: "clean-causal-premise",
    category: "material-support",
    parentStatement: STEWARD_PARENT,
    candidateStatement:
      "Pengelola yang berbeda dapat menggunakan dana yang sama dengan tingkat integritas dan dampak yang berbeda.",
    expectedAdmission: "GENERATE_VALID",
    acceptableRelations: ["DISTINCT_MATERIAL_SUPPORT"],
    acceptableSupportRoles: ["PREMISE", "REASON"],
    critical: true,
  },
  {
    id: "loss-of-control",
    category: "material-support",
    parentStatement: STEWARD_PARENT,
    candidateStatement:
      "Setelah dana diserahkan, pemberi kehilangan sebagian besar kendali langsung atas bagaimana dana tersebut digunakan.",
    expectedAdmission: "GENERATE_VALID",
    critical: true,
  },
  {
    id: "evaluative-evidence",
    category: "evidence",
    parentStatement: "Ibuku adalah orang paling baik sedunia.",
    candidateStatement: "Dia secara konsisten menunjukkan empati yang mendalam kepada orang yang membutuhkan.",
    expectedAdmission: "GENERATE_VALID",
    acceptableSupportRoles: ["EVIDENCE"],
    critical: true,
  },
  {
    id: "evaluative-restatement",
    category: "restatement",
    parentStatement: "Ibuku adalah orang paling baik sedunia.",
    candidateStatement: "Ibuku pada dasarnya adalah orang yang sangat baik dan penuh kasih.",
    expectedAdmission: "GENERATE_REJECT",
    acceptableRelations: ["RESTATEMENT", "ELABORATION"],
    critical: true,
  },
  {
    id: "weak-consistency",
    category: "weak-evidence",
    parentStatement: "Dia selalu menepati janji.",
    candidateStatement: "Dia pernah menepati satu janji penting.",
    expectedAdmission: "NOT_VALID",
    critical: true,
  },
  {
    id: "strong-pattern",
    category: "evidence",
    parentStatement: "Dia selalu menepati janji.",
    candidateStatement:
      "Dalam berbagai situasi selama bertahun-tahun, dia secara konsisten memenuhi janji yang telah dibuatnya.",
    expectedAdmission: "GENERATE_VALID",
    critical: true,
  },
  {
    id: "method-only",
    category: "method",
    parentStatement: "A household should keep one shared belief about how it uses its resources.",
    candidateStatement: "The household should hold a weekly meeting and write each decision in a shared note.",
    expectedAdmission: "GENERATE_REJECT",
    acceptableRelations: ["METHOD"],
    critical: true,
  },
  {
    id: "criterion-only",
    category: "criterion",
    parentStatement: "A person is worth trusting with an important task.",
    candidateStatement: "A trustworthy person must keep every commitment they make.",
    expectedAdmission: "GENERATE_REJECT",
    acceptableRelations: ["CRITERION"],
    critical: true,
  },
  {
    id: "unsupported-premise",
    category: "unsupported-premise",
    parentStatement: "Choosing who will carry a duty is part of that duty.",
    candidateStatement: "Every carrier who is not checked by an outside agency will divert most of the resources within one year.",
    expectedAdmission: "NOT_VALID",
    acceptableRelations: ["UNSUPPORTED_PREMISE", "UNRESOLVED"],
    critical: true,
  },
  {
    id: "multiple-jobs",
    category: "compound",
    parentStatement: STEWARD_PARENT,
    candidateStatement:
      "Pengelola yang berbeda mengubah hasil penggunaan dana yang sama, dan pemberi juga wajib menerbitkan daftar publik lengkap dari setiap pemberian yang pernah dilakukan.",
    expectedAdmission: "NOT_VALID",
    critical: true,
  },
  {
    id: "control-recipient-effect",
    category: "material-support",
    parentStatement:
      "Tanggung jawab dalam memberikan perpuluhan tidak berhenti pada penyerahan dana perpuluhan itu saja, tetapi kesungguhan memilih wadah yang akan mengelolanya juga merupakan bagian dari tanggung jawab pemberi.",
    candidateStatement: "Dampak dan integritas perpuluhan secara langsung dipengaruhi oleh pengelolaan entitas penerima.",
    expectedAdmission: "GENERATE_VALID",
    acceptableRelations: ["DISTINCT_MATERIAL_SUPPORT"],
    acceptableSupportRoles: ["PREMISE", "REASON"],
    critical: true,
  },
  {
    id: "suspect-moral-purity",
    category: "unsupported-premise",
    parentStatement:
      "Tanggung jawab dalam memberikan perpuluhan tidak berhenti pada penyerahan dana perpuluhan itu saja, tetapi kesungguhan memilih wadah yang akan mengelolanya juga merupakan bagian dari tanggung jawab pemberi.",
    candidateStatement:
      "Kelalaian dalam memilih penerima dapat merusak niat awal pemberi dan kesucian tindakan memberi itu sendiri.",
    expectedAdmission: "NOT_VALID",
    acceptableRelations: ["UNSUPPORTED_PREMISE", "UNRESOLVED", "ELABORATION"],
    critical: true,
  },
  {
    id: "suspect-commitment-elaboration",
    category: "elaboration",
    parentStatement:
      "Tanggung jawab dalam memberikan perpuluhan tidak berhenti pada penyerahan dana perpuluhan itu saja, tetapi kesungguhan memilih wadah yang akan mengelolanya juga merupakan bagian dari tanggung jawab pemberi.",
    candidateStatement:
      "Kesungguhan pemberi dalam memilih wadah pengelolaan perpuluhan mencerminkan kedalaman komitmennya terhadap tujuan dan prinsip-prinsip yang mendasari tindakan memberi itu sendiri.",
    expectedAdmission: "NOT_VALID",
    acceptableRelations: ["ELABORATION", "UNRESOLVED"],
    critical: true,
  },
  {
    id: "control-loss-of-control-full",
    category: "material-support",
    parentStatement:
      "Tanggung jawab dalam memberikan perpuluhan tidak berhenti pada penyerahan dana perpuluhan itu saja, tetapi kesungguhan memilih wadah yang akan mengelolanya juga merupakan bagian dari tanggung jawab pemberi.",
    candidateStatement:
      "Setelah dana diserahkan, pemberi kehilangan sebagian besar kendali langsung atas bagaimana dana tersebut digunakan.",
    expectedAdmission: "GENERATE_VALID",
    acceptableRelations: ["DISTINCT_MATERIAL_SUPPORT"],
    acceptableSupportRoles: ["PREMISE", "REASON"],
    critical: true,
  },
  {
    id: "control-intention-not-guarantee",
    category: "material-support",
    parentStatement:
      "Tanggung jawab dalam memberikan perpuluhan tidak berhenti pada penyerahan dana perpuluhan itu saja, tetapi kesungguhan memilih wadah yang akan mengelolanya juga merupakan bagian dari tanggung jawab pemberi.",
    candidateStatement:
      "Niat baik pemberi tidak dengan sendirinya menjamin bahwa dana akan dikelola sesuai dengan tujuan yang mendorong pemberian itu.",
    expectedAdmission: "GENERATE_VALID",
    acceptableRelations: ["DISTINCT_MATERIAL_SUPPORT"],
    acceptableSupportRoles: ["PREMISE", "REASON"],
    critical: true,
  },
];

export const SIBLING_CERTIFICATION_CASES: SiblingCertificationCase[] = [
  {
    id: "sibling-duplicate-job",
    parentStatement: STEWARD_PARENT,
    rows: [
      {
        code: "BT01",
        statement: "Wadah yang tidak bertanggung jawab dapat membuat tujuan pemberian gagal tercapai.",
      },
      {
        code: "BT02",
        statement: "Pemilihan wadah yang bertanggung jawab membantu memastikan tujuan pemberian tercapai.",
      },
    ],
    expectDistinct: false,
    expectPair: { a: "BT01", b: "BT02" },
    critical: true,
  },
  {
    id: "sibling-distinct-jobs",
    parentStatement: STEWARD_PARENT,
    rows: [
      {
        code: "BT01",
        statement: "Pengelola yang berbeda dapat menghasilkan penggunaan dana yang berbeda.",
      },
      {
        code: "BT02",
        statement: "Memilih pengelola juga memberikan mandat kepada pihak tersebut untuk mewakili tujuan pemberian.",
      },
      {
        code: "BT03",
        statement: "Setelah dana diserahkan, pemberi kehilangan kendali langsung atas penggunaannya.",
      },
    ],
    expectDistinct: true,
    expectPair: null,
    critical: true,
  },
];
