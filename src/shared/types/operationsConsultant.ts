/**
 * Legacy CRM dashboard types (ported from reference @/pages/operations/Consultant).
 * Used by LeadForm, LeadDetail, CRMFilters, and older LeadsTable variants.
 */
export interface FollowUpHistory {
  id: string;
  tanggal: string;
  tahap: string;
  metode: string;
  status: string;
  catatan: string;
  konsultan: string;
}

export interface Lead {
  id: string;
  ticketId?: string;
  client?: string;
  namaPasien?: string;
  phoneNumber?: string;
  sex?: string;
  jenisKelamin?: string;
  age?: number;
  umur?: number;
  address?: string;
  domisili?: string;
  occupation?: string;
  pekerjaan?: string;
  title?: string;
  diagnosa?: string;
  feedbackComplaint?: string;
  keluhan?: string;
  category?: string;
  kategoriPasien?: string;
  assignee?: string;
  konsultan?: string;
  followup?: number;
  fuPriority?: string;
  status?: string;
  source?: string;
  createdBy?: string;
  lastUpdatedBy?: string;
  lastUpdatedByName?: string;
  resolutionNotes?: string;
  createdAt?: string;
  updatedAt?: string;
  riwayatFollowUp?: FollowUpHistory[];
}

export interface CRMFilters {
  search?: string;
  status?: string;
  assignee?: string;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
}
