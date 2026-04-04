// Lead Types

export interface NewLead {
  id: string;
  client: string;
  title: string;
  services: string | null;
  category: string;
  assignee: string;
  assignee_id?: string | null;
  fu_priority: string | null;
  status_id: string;
  source: string | null;
  followup: number | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_name: string;
  organization_id: string;
  ticket_id: string | null;
  lead_status?: {
    id: string;
    name: string;
    color: string | null;
  };
}

export interface CreateLeadData {
  client: string;
  title: string;
  services?: string;
  category?: string;
  assignee: string;
  fu_priority?: string;
  status_id: string;
  source?: string;
}

export interface LeadFollowUpUpdate {
  leadId: string;
  followup: number;
  fu_priority?: string;
  notes?: string;
}









