/** Shape stored in kol_payment_terms.milestones (sync_payment_milestones trigger). */
export type MilestoneJsonItem = {
  milestone_name: string;
  percentage: number;
  amount: number;
  milestone_order: number;
  due_date?: string | null;
  description?: string | null;
  status?: string;
  trigger_condition?: string;
};

type MilestoneInput = {
  milestone_name: string;
  payment_percentage: number;
  amount?: number;
  milestone_order?: number;
  due_date?: string | null;
  milestone_description?: string | null;
  description?: string | null;
  status?: string;
  trigger_condition?: string;
};

export function buildMilestonesJson(milestones: MilestoneInput[]): MilestoneJsonItem[] {
  return (milestones || []).map((item, index) => ({
    milestone_name: item.milestone_name,
    percentage: item.payment_percentage,
    amount: item.amount ?? 0,
    milestone_order: item.milestone_order ?? index + 1,
    due_date: item.due_date || null,
    description: item.milestone_description ?? item.description ?? null,
    status: item.status ?? "pending",
    trigger_condition: item.trigger_condition ?? "manual",
  }));
}
