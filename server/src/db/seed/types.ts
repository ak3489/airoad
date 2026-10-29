export interface SeedReferenceFile {
  filePath?: string;
  language: string;
  content: string;
}

export interface SeedStepReference {
  approach: string;
  commands?: string[];
  files?: SeedReferenceFile[];
  verify?: string[];
}

export interface SeedStep {
  key: string;
  title: string;
  goal: string;
  principle?: string;
  setup?: string;
  instructions: string;
  code?: { language: string; filePath?: string; content: string };
  commands?: string[];
  expectedOutput?: string;
  pitfalls?: { problem: string; solution: string }[];
  acceptance: string[];
}

export interface SeedTask {
  slug: string;
  phaseSlug: string;
  week: number;
  day: number;
  order: number;
  title: string;
  objective: string;
  problem: string;
  estimatedMinutes: number;
  priority?: 'high' | 'normal' | 'low';
  tags: string[];
  acceptance: string[];
  resourceSlugs: string[];
  prerequisiteSlugs?: string[];
  optional?: boolean;
  steps: SeedStep[];
}

export interface SeedPhase {
  slug: string;
  order: number;
  title: string;
  shortTitle: string;
  weeks: string;
  goal: string;
  why: string;
  knowledge: string[];
  prerequisites: string[];
  estimatedHours: number;
  deliverable: string;
  acceptance: string[];
  unlockCondition: string;
}

export interface SeedResource {
  slug: string;
  title: string;
  url: string;
  kind: 'doc' | 'tutorial' | 'video' | 'repo' | 'article' | 'tool';
  topic: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  phaseSlug: string;
  importance: number;
  keyPoints: string[];
  tags: string[];
  official: boolean;
  verified: boolean;
}

export const seedResourcesVerifiedAt = new Date('2026-10-28T00:00:00+08:00');
