import type { SeedStepReference } from '../types';
import { phase1References } from './phase1';
import { phase2References } from './phase2';
import { phase3References } from './phase3';
import { phase4References } from './phase4';
import { phase5References } from './phase5';
import { phase6References } from './phase6';
import { phase7References } from './phase7';

const allReferences: Record<string, SeedStepReference> = {
  ...phase1References,
  ...phase2References,
  ...phase3References,
  ...phase4References,
  ...phase5References,
  ...phase6References,
  ...phase7References,
};

export function referenceFor(taskSlug: string, stepKey: string): SeedStepReference | undefined {
  return allReferences[`${taskSlug}/${stepKey}`];
}

export function referenceCount(): number {
  return Object.keys(allReferences).length;
}
