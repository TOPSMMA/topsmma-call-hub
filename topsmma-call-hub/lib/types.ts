export type LeadStatus =
  | "Uncalled"
  | "Contacted"
  | "Qualified"
  | "Meeting Booked"
  | "Proposal Sent"
  | "Closed Won"
  | "Closed Lost";

export type Lead = {
  id: string;
  lead_number: string;
  company_name: string;
  contact_name: string | null;
  contact_role: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  region: string | null;
  tier: "T1" | "T2" | "T3" | null;
  tier_label: string | null;
  score: number | null;
  source: string | null;
  status: LeadStatus;
  assigned_rep_id: string | null;
  google_rating: number | null;
  google_reviews: number | null;
  signals: string | null;
  research_notes: string | null;
  ai_brief: string | null;
  next_followup_at: string | null;
  last_activity_at: string | null;
  last_called_at: string | null;
  deal_value: number | null;
  close_date: string | null;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
};

export const LEAD_STATUSES: LeadStatus[] = [
  "Uncalled",
  "Contacted",
  "Qualified",
  "Meeting Booked",
  "Proposal Sent",
  "Closed Won",
  "Closed Lost",
];
