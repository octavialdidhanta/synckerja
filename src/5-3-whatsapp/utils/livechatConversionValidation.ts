/** Draft line for livechat Converted flow (string inputs until submit). */

export interface ConversionDraftLine {

  id: string;

  serviceName: string;

  categoryName: string;

  quantityRaw: string;

  unitPriceRaw: string;

}



export function newConversionDraftLineId(): string {

  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {

    return crypto.randomUUID();

  }

  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

}



export function createEmptyConversionDraftLine(

  defaults?: Partial<Pick<ConversionDraftLine, 'serviceName' | 'categoryName' | 'quantityRaw' | 'unitPriceRaw'>>,

): ConversionDraftLine {

  return {

    id: newConversionDraftLineId(),

    serviceName: defaults?.serviceName ?? '',

    categoryName: defaults?.categoryName ?? '',

    quantityRaw: defaults?.quantityRaw ?? '1',

    unitPriceRaw: defaults?.unitPriceRaw ?? '',

  };

}



function normalizeMasterName(value: string): string {
  return value.trim().toLowerCase();
}

export function resolveServiceByName(
  serviceName: string,
  servicesList: { id: string; name: string }[],
): { id: string; name: string } | undefined {
  const trimmed = serviceName.trim();
  if (!trimmed) return undefined;
  const exact = servicesList.find((s) => s.name === trimmed);
  if (exact) return exact;
  const norm = normalizeMasterName(trimmed);
  return servicesList.find((s) => normalizeMasterName(s.name) === norm);
}

export function isServiceCategoryPairValid(
  serviceName: string,
  categoryName: string,
  servicesList: { id: string; name: string }[],
  subServicesList: { service_id: string; name: string }[],
): boolean {
  const cat = categoryName.trim();
  if (!cat) return false;
  const service = resolveServiceByName(serviceName, servicesList);
  if (!service) return false;
  const exactCat = subServicesList.find(
    (ss) => ss.service_id === service.id && ss.name === cat,
  );
  if (exactCat) return true;
  const catNorm = normalizeMasterName(cat);
  return subServicesList.some(
    (ss) => ss.service_id === service.id && normalizeMasterName(ss.name) === catNorm,
  );
}



/** Parse user input as a finite number strictly greater than zero. */

export function parseStrictPositiveNumber(raw: string): number | null {

  const s = raw.trim().replace(',', '.');

  if (s === '') return null;

  const n = Number(s);

  if (!Number.isFinite(n) || n <= 0) return null;

  return n;

}



export function conversionLineTotal(quantityRaw: string, unitPriceRaw: string): number {

  const q = parseStrictPositiveNumber(quantityRaw);

  const p = parseStrictPositiveNumber(unitPriceRaw);

  if (q == null || p == null) return 0;

  return q * p;

}



export function formatConversionRp(amount: number): string {

  const n = Number.isFinite(amount) ? amount : 0;

  return `Rp ${n.toLocaleString('id-ID')}`;

}



export function isConversionDraftValid(

  lines: ConversionDraftLine[],

  notesTrimmed: string,

  servicesList: { id: string; name: string }[],

  subServicesList: { service_id: string; name: string }[],

): boolean {

  if (!notesTrimmed) return false;

  if (lines.length === 0) return false;

  for (const line of lines) {

    if (!isServiceCategoryPairValid(line.serviceName, line.categoryName, servicesList, subServicesList)) {

      return false;

    }

    if (parseStrictPositiveNumber(line.quantityRaw) == null) return false;

    if (parseStrictPositiveNumber(line.unitPriceRaw) == null) return false;

  }

  return true;

}



/** Payload for `updateLead` / `createConvertedSalesActivity`; null if invalid. */

export function buildConversionItemsPayload(

  lines: ConversionDraftLine[],

  servicesList: { id: string; name: string }[],

  subServicesList: { service_id: string; name: string }[],

): Array<{ quantity: number; unit_price: number; services: string; category: string }> | null {

  const out: Array<{ quantity: number; unit_price: number; services: string; category: string }> = [];

  for (const line of lines) {

    if (!isServiceCategoryPairValid(line.serviceName, line.categoryName, servicesList, subServicesList)) {

      return null;

    }

    const q = parseStrictPositiveNumber(line.quantityRaw);

    const p = parseStrictPositiveNumber(line.unitPriceRaw);

    if (q == null || p == null) return null;

    out.push({

      quantity: q,

      unit_price: p,

      services: line.serviceName.trim(),

      category: line.categoryName.trim(),

    });

  }

  return out.length > 0 ? out : null;

}



/** Sum of line totals from draft rows (0 if any line invalid). */

export function conversionLinesGrandTotal(lines: ConversionDraftLine[]): number {

  let sum = 0;

  for (const line of lines) {

    sum += conversionLineTotal(line.quantityRaw, line.unitPriceRaw);

  }

  return sum;

}



/** Parse down payment input: strictly positive finite number. */

export function parseDownPaymentAmount(raw: string): number | null {

  const s = raw.trim().replace(/,/g, '.');

  if (s === '') return null;

  const n = Number(s);

  if (!Number.isFinite(n) || n <= 0) return null;

  return n;

}



export type ConversionPaymentKindUi = 'dp' | 'full';



export function isConversionFinancialValid(params: {

  lines: ConversionDraftLine[];

  paymentKind: ConversionPaymentKindUi;

  downPaymentRaw: string;

  paymentDate: string;

  paymentMethod: string;

  receiptFile: File | null;

  /** Org omnichannel income bank (required for paid livechat conversion). */
  omnichannelBankId?: string | null;

}): boolean {

  const { lines, paymentKind, downPaymentRaw, paymentDate, paymentMethod, receiptFile, omnichannelBankId } =
    params;

  if (!(omnichannelBankId ?? '').trim()) return false;

  if (!(paymentDate ?? '').trim()) return false;

  if (!(paymentMethod ?? '').trim()) return false;

  if (!receiptFile) return false;

  const total = conversionLinesGrandTotal(lines);

  if (!(total > 0)) return false;

  if (paymentKind === 'full') return true;

  const dp = parseDownPaymentAmount(downPaymentRaw);

  if (dp == null || dp > total + 1e-9) return false;

  return true;

}


