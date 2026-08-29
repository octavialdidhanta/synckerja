import type { FeedbackSentiment } from '../lib/classifyFeedbackSentiment';

export type PosReceiptFeedbackRow = {
  id: string;
  invitationId: string;
  salesActivityId: string;
  posOutletId: string | null;
  servedByEmployeeId: string | null;
  rating: number;
  sentiment: FeedbackSentiment;
  comment: string | null;
  replyText: string | null;
  repliedBy: string | null;
  repliedAt: string | null;
  submittedAt: string;
  customerName: string;
  outletName: string;
  employeeName: string;
};

export type PosReceiptFeedbackFilters = {
  outletId: string | null;
  employeeId: string | null;
  sentiment: FeedbackSentiment | null;
  from: string;
  to: string;
};

export type PosReceiptFeedbackListResult = {
  goodCount: number;
  badCount: number;
  rows: PosReceiptFeedbackRow[];
};
