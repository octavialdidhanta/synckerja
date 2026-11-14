import type { PillarFitStatus } from "./types";

export type ReviewablePillar = {
  id: string;
  name: string;
  category?: string | null;
  description?: string | null;
  funnel?: string | null;
};

export type PillarReview = {
  contentPillarId: string;
  pillarName: string;
  status: PillarFitStatus;
  reason: string;
  development: string;
  offer?: string;
  comment?: string;
  trigger?: string;
};