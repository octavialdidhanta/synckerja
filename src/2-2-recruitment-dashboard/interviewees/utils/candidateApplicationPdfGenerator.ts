import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDFDocument } from 'pdf-lib';
import { format, parseISO, isValid } from 'date-fns';
import { supabase } from '@/shared/lib/supabaseClient';
import type { AppLanguage } from '@/shared/i18n/translations';
import type { CandidateApplicationPdfPayload } from '../services/candidateApplicationPdfService';

const BUCKET = 'recruitment-files';
const MARGIN = 18;
const SECTION_GAP = 10;
const LINE_HEIGHT = 6;
const TABLE_HEAD_FILL: [number, number, number] = [41, 128, 185];
const TABLE_HEAD_TEXT = [255, 255, 255] as [number, number, number];

type TranslateFn = (key: string, fallback: string) => string;

function getFinalY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? MARGIN;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result as string;
      resolve(result.indexOf(',') >= 0 ? result.split(',')[1]! : result);
    };
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/** Get image dimensions from blob to preserve aspect ratio when embedding in PDF. */
function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

function isImageMime(mime: string | undefined): boolean {
  if (!mime) return false;
  return /^image\//i.test(mime);
}

function isPdfMime(mime: string | undefined): boolean {
  if (!mime) return false;
  return mime.toLowerCase() === 'application/pdf';
}

/** Format date string (YYYY-MM-DD or ISO) to dd MMM yyyy (e.g. 01 Feb 2026). */
function formatDateDdMmmYyyy(dateStr: string | null | undefined): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  try {
    const d = parseISO(dateStr.trim());
    return isValid(d) ? format(d, 'dd MMM yyyy') : dateStr;
  } catch {
    return dateStr;
  }
}

/** Wrap long text at word boundaries so it fits in narrow table cells and doesn't overlap. */
function wrapTextForCell(text: string, maxCharsPerLine: number): string {
  if (!text || maxCharsPerLine <= 0) return text;
  const trimmed = text.trim();
  if (trimmed.length <= maxCharsPerLine) return trimmed;
  const lines: string[] = [];
  let rest = trimmed;
  while (rest.length > 0) {
    if (rest.length <= maxCharsPerLine) {
      lines.push(rest.trim());
      break;
    }
    let chunk = rest.slice(0, maxCharsPerLine);
    const nextSpace = rest.indexOf(' ', maxCharsPerLine);
    const breakAt = nextSpace >= 0 ? nextSpace : maxCharsPerLine;
    chunk = rest.slice(0, breakAt);
    rest = rest.slice(breakAt).trimStart();
    lines.push(chunk);
  }
  return lines.join('\n');
}

function docLabel(t: TranslateFn, documentType: string): string {
  const keyMap: Record<string, string> = {
    cv: 'candidateApplicationPdf.documentCv',
    ktp: 'candidateApplicationPdf.documentKtp',
    ijazah: 'candidateApplicationPdf.documentIjazah',
    transcript: 'candidateApplicationPdf.documentTranscript',
    portfolio: 'candidateApplicationPdf.documentPortfolio',
    other: 'candidateApplicationPdf.documentOther'
  };
  const key = keyMap[documentType] || 'candidateApplicationPdf.documentOther';
  return t(key, documentType);
}

function addSectionTitle(doc: jsPDF, y: number, title: string, pageHeight: number): number {
  let currentY = y;
  if (currentY + 18 > pageHeight - 20) {
    doc.addPage();
    currentY = MARGIN + 4;
  }
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text(title, MARGIN, currentY);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  return currentY + 6;
}

const tableTheme = {
  headStyles: { fillColor: TABLE_HEAD_FILL, textColor: TABLE_HEAD_TEXT, fontSize: 9, fontStyle: 'bold' },
  bodyStyles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak' as const, valign: 'top' as const },
  alternateRowStyles: { fillColor: [245, 245, 245] },
  margin: { left: MARGIN, right: MARGIN },
  theme: 'striped' as const
};

async function downloadDocumentBlob(filePath: string): Promise<Blob | null> {
  const { data, error } = await supabase.storage.from(BUCKET).download(filePath);
  if (error || !data) return null;
  return data;
}

export interface GeneratePdfResult {
  blob: Blob;
  filename: string;
}

/**
 * Generates the candidate application PDF: summary + sections + embedded documents.
 * Uses jsPDF for text and images, then pdf-lib to append any uploaded PDFs.
 */
export async function generateCandidateApplicationPDF(
  data: CandidateApplicationPdfPayload,
  language: AppLanguage,
  t: TranslateFn
): Promise<GeneratePdfResult> {
  const emptyStr = t('candidateApplicationPdf.empty', '—');
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const tableFullWidth = pageWidth - 2 * MARGIN;
  const maxY = pageHeight - 20;

  const checkY = (y: number, need: number = 25) => {
    if (y + need > maxY) {
      doc.addPage();
      return MARGIN + 5;
    }
    return y;
  };

  const name = data.profile?.full_name || '';
  const jobTitle =
    (data.jobApplication as any)?.job_openings?.job_title ??
    (Array.isArray((data.jobApplication as any)?.job_openings)
      ? (data.jobApplication as any).job_openings[0]?.job_title
      : null) ??
    '';
  const dateGenerated = format(new Date(), 'dd MMMM yyyy');

  // ---- Header: title + summary table (left), photo (right) ----
  const photoWidth = 32;
  const photoHeight = 40;
  const photoX = pageWidth - MARGIN - photoWidth;
  const contentWidth = photoX - MARGIN - 8;

  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text(t('candidateApplicationPdf.title', 'Rekap Aplikasi Kandidat'), MARGIN, MARGIN + 6);

  autoTable(doc, {
    startY: MARGIN + 12,
    head: [['Field', 'Value']],
    body: [
      ['Name', name || emptyStr],
      [t('candidateApplicationPdf.positionApplied', 'Position applied for'), jobTitle || emptyStr],
      [t('candidateApplicationPdf.dateGenerated', 'Date generated'), dateGenerated]
    ],
    tableWidth: contentWidth,
    columnStyles: { 0: { cellWidth: contentWidth * 0.35 }, 1: { cellWidth: contentWidth * 0.65 } },
    ...tableTheme,
    headStyles: { ...tableTheme.headStyles, fillColor: [70, 70, 70] }
  });

  let y = getFinalY(doc) + 4;

  // Optional photo: right-aligned, no overlap with table
  const photoUrl = data.profile?.photo_url;
  if (photoUrl && typeof photoUrl === 'string') {
    try {
      let blob: Blob | null = null;
      if (photoUrl.startsWith('http')) {
        const res = await fetch(photoUrl);
        if (res.ok) blob = await res.blob();
      } else {
        blob = await downloadDocumentBlob(photoUrl);
      }
      if (blob && blob.type.startsWith('image/')) {
        const base64 = await blobToBase64(blob);
        const imgFormat = blob.type.toLowerCase().includes('png') ? 'PNG' : 'JPEG';
        doc.addImage(base64, imgFormat, photoX, MARGIN + 8, photoWidth, photoHeight);
      }
    } catch {
      // skip photo
    }
  }

  y += SECTION_GAP;

  // ---- Personal Info (table) ----
  const p = data.profile;
  y = addSectionTitle(doc, y, t('candidateApplicationPdf.personalInfo', 'Informasi Personal'), pageHeight);
  const personalRows = p
    ? [
        ['Name', p.full_name || emptyStr],
        ['Email', p.email || emptyStr],
        ['Phone', p.mobile_phone || emptyStr],
        ['Birth date', formatDateDdMmmYyyy(p.birth_date) || emptyStr],
        ['Birth place', p.birth_place || emptyStr],
        ['Gender', p.gender || emptyStr],
        ['NIK', p.nik || emptyStr],
        ['Religion', p.religion || emptyStr],
        ['Marital status', p.marital_status || emptyStr],
        ['Nationality', p.nationality || emptyStr],
        ['Blood type', p.blood_type || emptyStr]
      ]
    : [['—', emptyStr]];
  autoTable(doc, {
    startY: y,
    head: [['Field', 'Value']],
    body: personalRows,
    columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 'auto' } },
    ...tableTheme
  });
  y = getFinalY(doc) + SECTION_GAP;

  // ---- Address (table) ----
  y = addSectionTitle(doc, y, t('candidateApplicationPdf.address', 'Alamat'), pageHeight);
  const addressRows = p
    ? [
        ['Address', p.address || emptyStr],
        ['ID address', p.citizen_address || emptyStr],
        ['Postal code', p.postal_code || emptyStr]
      ]
    : [['—', emptyStr]];
  autoTable(doc, {
    startY: y,
    head: [['Field', 'Value']],
    body: addressRows,
    tableWidth: tableFullWidth,
    columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 'auto' } },
    ...tableTheme
  });
  y = getFinalY(doc) + SECTION_GAP;

  // ---- Education (table) ----
  y = addSectionTitle(doc, y, t('candidateApplicationPdf.education', 'Pendidikan'), pageHeight);
  const educationHead = ['Institution', 'Degree', 'Field', 'Period', 'GPA/Notes'];
  const educationBody =
    data.educations.length > 0
      ? data.educations.map((ed) => [
          ed.institution_name || emptyStr,
          ed.degree || emptyStr,
          ed.field_of_study || emptyStr,
          [formatDateDdMmmYyyy(ed.start_date), formatDateDdMmmYyyy(ed.end_date)].filter(Boolean).join(' – ') || emptyStr,
          ed.grade_gpa || ed.description || emptyStr
        ])
      : [[emptyStr, emptyStr, emptyStr, emptyStr, emptyStr]];
  autoTable(doc, {
    startY: y,
    head: [educationHead],
    body: educationBody,
    tableWidth: tableFullWidth,
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 28 },
      2: { cellWidth: 35 },
      3: { cellWidth: 38 },
      4: { cellWidth: 'auto' }
    },
    ...tableTheme
  });
  y = getFinalY(doc) + SECTION_GAP;

  // ---- Informal Education (table) ----
  y = addSectionTitle(doc, y, t('candidateApplicationPdf.informalEducation', 'Pendidikan Non-Formal'), pageHeight);
  const informalHead = ['Course', 'Provider', 'Period', 'Description'];
  const informalBody =
    data.informalEducations.length > 0
      ? data.informalEducations.map((inf) => [
          inf.course_name || emptyStr,
          inf.provider || inf.field_of_certification || emptyStr,
          [formatDateDdMmmYyyy(inf.start_date), formatDateDdMmmYyyy(inf.end_date)].filter(Boolean).join(' – ') || emptyStr,
          inf.description || emptyStr
        ])
      : [[emptyStr, emptyStr, emptyStr, emptyStr]];
  autoTable(doc, {
    startY: y,
    head: [informalHead],
    body: informalBody,
    tableWidth: tableFullWidth,
    columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 40 }, 2: { cellWidth: 35 }, 3: { cellWidth: 'auto' } },
    ...tableTheme
  });
  y = getFinalY(doc) + SECTION_GAP;

  // ---- Work Experience (table) ----
  y = addSectionTitle(doc, y, t('candidateApplicationPdf.workExperience', 'Pengalaman Kerja'), pageHeight);
  const workHead = [
    t('candidateApplicationPdf.workCompanyLocation', 'Company / Location'),
    t('candidateApplicationPdf.workDetails', 'Position, Period & Description')
  ];
  const workBody =
    data.workExperiences.length > 0
      ? data.workExperiences.map((we) => {
          const period = we.is_current
            ? `${formatDateDdMmmYyyy(we.start_date) || ''} – Present`
            : [formatDateDdMmmYyyy(we.start_date), formatDateDdMmmYyyy(we.end_date)].filter(Boolean).join(' – ') || emptyStr;
          const company = (we.company_name || '').trim();
          const location = (we.location || '').trim();
          const companyLocation = company && location
            ? `${company}\n——\n${location}`
            : company || location || emptyStr;
          const position = we.position || emptyStr;
          const descriptionWrapped = wrapTextForCell(we.job_description || emptyStr, 65);
          const detailsBlock = [position, period].filter(Boolean).join('\n');
          const detailsCell = descriptionWrapped
            ? `${detailsBlock}\n——\n${descriptionWrapped}`
            : detailsBlock || emptyStr;
          return [companyLocation, detailsCell];
        })
      : [[emptyStr, emptyStr]];
  const workCol0 = 52;
  const workCol1 = tableFullWidth - workCol0;
  autoTable(doc, {
    startY: y,
    head: [workHead],
    body: workBody,
    tableWidth: tableFullWidth,
    columnStyles: {
      0: { cellWidth: workCol0, overflow: 'linebreak' },
      1: { cellWidth: workCol1, overflow: 'linebreak', minCellHeight: 8 }
    },
    ...tableTheme
  });
  y = getFinalY(doc) + SECTION_GAP;

  // ---- Family (table) ----
  y = addSectionTitle(doc, y, t('candidateApplicationPdf.family', 'Keluarga'), pageHeight);
  const familyHead = ['Name', 'Relationship', 'Gender', 'Age', 'Occupation', 'Emergency'];
  const familyBody =
    data.familyMembers.length > 0
      ? data.familyMembers.map((fm) => [
          fm.name || emptyStr,
          fm.relationship || emptyStr,
          fm.gender || emptyStr,
          fm.age != null ? String(fm.age) : emptyStr,
          fm.occupation || emptyStr,
          fm.is_emergency_contact ? 'Yes' : ''
        ])
      : [[emptyStr, emptyStr, emptyStr, emptyStr, emptyStr, emptyStr]];
  autoTable(doc, {
    startY: y,
    head: [familyHead],
    body: familyBody,
    tableWidth: tableFullWidth,
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 28 },
      2: { cellWidth: 22 },
      3: { cellWidth: 15 },
      4: { cellWidth: 35 },
      5: { cellWidth: 'auto' }
    },
    ...tableTheme
  });
  y = getFinalY(doc) + SECTION_GAP;

  // ---- Reviews (table) ----
  y = addSectionTitle(doc, y, t('candidateApplicationPdf.reviews', 'Reviews'), pageHeight);
  const ratingLabel = t('candidateApplicationPdf.rating', 'Rating');
  const reviewerLabel = t('candidateApplicationPdf.reviewer', 'Reviewer');
  const reviewsHead = ['Question', ratingLabel, reviewerLabel, 'Comment'];
  const reviewsBody =
    data.reviews.length > 0
      ? data.reviews.map((rev) => [
          (rev.question_review as any)?.question_text || emptyStr,
          `${rev.rating}/5`,
          rev.reviewer_name || emptyStr,
          rev.review_text || emptyStr
        ])
      : [[emptyStr, emptyStr, emptyStr, emptyStr]];
  if (data.reviews.length > 0) {
    const avgRating = data.reviews.reduce((s, r) => s + r.rating, 0) / data.reviews.length;
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`${ratingLabel} (avg): ${avgRating.toFixed(1)}/5`, MARGIN, y);
    y += 6;
  }
  autoTable(doc, {
    startY: y,
    head: [reviewsHead],
    body: reviewsBody,
    tableWidth: tableFullWidth,
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 20 },
      2: { cellWidth: 32 },
      3: { cellWidth: 'auto' }
    },
    ...tableTheme
  });
  y = getFinalY(doc) + SECTION_GAP;

  // ---- Attachments (section title) ----
  if (data.documents.length > 0) {
    y = addSectionTitle(doc, y, t('candidateApplicationPdf.attachments', 'Lampiran Dokumen'), pageHeight);
  }

  // ---- Embedded documents: images only in jsPDF (PDFs merged later) ----
  const pdfBlobsToMerge: { blob: Blob; label: string }[] = [];

  for (const d of data.documents) {
    const blob = await downloadDocumentBlob(d.file_path);
    if (!blob) continue;

    if (isImageMime(d.mime_type)) {
      try {
        const base64 = await blobToBase64(blob);
        const dims = await getImageDimensions(blob);
        const label = docLabel(t, d.document_type);
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text(label, MARGIN, y);
        y += LINE_HEIGHT + 2;
        const pxToMm = 25.4 / 96;
        const wMm = dims.width * pxToMm;
        const hMm = dims.height * pxToMm;
        const maxW = 70;
        const maxH = 50;
        const scale = Math.min(maxW / wMm, maxH / hMm, 1);
        const imgW = wMm * scale;
        const imgH = hMm * scale;
        y = checkY(y, imgH + 4);
        const imgFormat = d.mime_type?.toLowerCase().includes('png') ? 'PNG' : 'JPEG';
        doc.addImage(base64, imgFormat, MARGIN, y, imgW, imgH);
        y += imgH + SECTION_GAP;
      } catch {
        // skip failed image
      }
      continue;
    }

    if (isPdfMime(d.mime_type)) {
      pdfBlobsToMerge.push({ blob, label: docLabel(t, d.document_type) });
    }
  }

  const jsPdfOutput = doc.output('arraybuffer') as ArrayBuffer;

  // Merge with pdf-lib if we have PDFs to append
  let finalBytes: Uint8Array;
  if (pdfBlobsToMerge.length > 0) {
    const mainPdf = await PDFDocument.load(jsPdfOutput);
    const pageIndices = mainPdf.getPageIndices();
    const mergedPdf = await PDFDocument.create();
    const copied = await mergedPdf.copyPages(mainPdf, pageIndices);
    copied.forEach((page) => mergedPdf.addPage(page));

    for (const { blob } of pdfBlobsToMerge) {
      try {
        const buf = await blob.arrayBuffer();
        const src = await PDFDocument.load(buf);
        const indices = src.getPageIndices();
        const pages = await mergedPdf.copyPages(src, indices);
        pages.forEach((page) => mergedPdf.addPage(page));
      } catch {
        // skip failed PDF
      }
    }

    finalBytes = await mergedPdf.save();
  } else {
    finalBytes = new Uint8Array(jsPdfOutput);
  }

  const safeName = (name || 'Candidate').replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 50);
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const filename = `Rekap-Aplikasi-${safeName}-${dateStr}.pdf`;

  return {
    blob: new Blob([finalBytes], { type: 'application/pdf' }),
    filename
  };
}
