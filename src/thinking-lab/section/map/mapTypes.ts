export type MasterMapExecution = {
  id: string;
  label: string;
  passed: boolean;
  leadMagnet?: boolean;
};

export type MasterMapPillar = {
  id: string;
  label: string;
  leadMagnet?: boolean;
  executions?: MasterMapExecution[];
};

export type MasterMapIdea = {
  id: string;
  code: string;
  statement: string;
  subject?: string;
  recommended?: boolean;
  childCount?: number;
  pillars?: MasterMapPillar[];
  executions?: MasterMapExecution[];
};

export type MasterMapAngle = {
  id: string;
  code: string;
  statement: string;
  subject?: string;
  childCount?: number;
  ideas?: MasterMapIdea[];
};

export type MasterMapTerritory = {
  id: string;
  code: string;
  statement: string;
  childCount?: number;
  angles?: MasterMapAngle[];
};

export type MasterMapChild = {
  id: string;
  code: string;
  label?: string;
  statement: string;
  childCount?: number;
  territories?: MasterMapTerritory[];
};