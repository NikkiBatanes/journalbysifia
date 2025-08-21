/*
 * nextBestStep.ts
 * Computes a ranking score for action steps and generates brief coach tips.
 */

export type Priority = 'high' | 'medium' | 'low' | undefined;

export interface RankedActionStep {
  id: string;
  title: string;
  description?: string;
  playbookTitle: string;
  playbookId: string;
  stepIndex: number;
  isCompleted: boolean;
  dueDate?: string | null;
  priority?: Priority;
  estimatedMinutes?: number | null;
  difficulty?: number | null;
  impactScore?: number | null;
  dependsOnStepId?: string | null;
  blockers?: string | null;
}

function priorityWeight(p?: Priority) {
  switch (p) {
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 2;
  }
}

function dueDateUrgency(due?: string | null) {
  if (!due) return 0;
  const today = new Date();
  const d = new Date(due);
  // Days until due (negative means overdue)
  const diffDays = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (isNaN(diffDays)) return 0;
  if (diffDays < 0) return 4;         // overdue
  if (diffDays === 0) return 3;       // due today
  if (diffDays <= 2) return 2;        // due soon
  if (diffDays <= 7) return 1;        // due within a week
  return 0;
}

function durationWeight(mins?: number | null) {
  if (mins == null) return 1; // unknown
  if (mins <= 10) return 2;   // quick wins
  if (mins <= 25) return 1.5;
  if (mins <= 45) return 1.2;
  return 1; // long tasks get no bonus
}

function difficultyPenalty(diff?: number | null) {
  if (diff == null) return 0;
  // Slightly penalize harder tasks so we bubble approachable wins
  if (diff >= 5) return -1.0;
  if (diff >= 4) return -0.7;
  if (diff >= 3) return -0.4;
  return 0;
}

function impactBoost(impact?: number | null) {
  if (impact == null) return 0;
  // Normalize 1-10 to ~0-2 bonus
  return Math.max(0, Math.min(impact, 10)) / 5;
}

function dependencyPenalty(dependsOnStepId?: string | null) {
  return dependsOnStepId ? -2 : 0;
}

function blockersPenalty(blockers?: string | null) {
  return blockers && blockers.trim().length > 0 ? -0.5 : 0;
}

export function computeStepScore(step: RankedActionStep): number {
  const base = 1;
  const score = base
    + priorityWeight(step.priority)
    + dueDateUrgency(step.dueDate)
    + impactBoost(step.impactScore ?? null)
    + Math.log(1 + (step.stepIndex >= 0 ? (1 + step.stepIndex) : 1)) * 0 // no index bias for now
    + (durationWeight(step.estimatedMinutes ?? null) - 1) // small quick-win boost
    + difficultyPenalty(step.difficulty ?? null)
    + dependencyPenalty(step.dependsOnStepId ?? null)
    + blockersPenalty(step.blockers ?? null);

  return Number(score.toFixed(3));
}

export function rankSteps<T extends RankedActionStep>(steps: T[]): T[] {
  return [...steps].sort((a, b) => computeStepScore(b) - computeStepScore(a));
}

// Lightweight, on-device coach tip generation based on context
export function generateCoachTip(step: RankedActionStep): string | undefined {
  const tips: string[] = [];

  // Priority and urgency first
  if (step.priority === 'high') tips.push('High priority — a small start counts.');

  const urgency = dueDateUrgency(step.dueDate);
  if (urgency >= 4) tips.push('Overdue — take one small action now.');
  else if (urgency >= 3) tips.push('Due today — schedule 10 focused minutes.');
  else if (urgency >= 2) tips.push('Due soon — block time in your day.');

  // Show quick win only when an explicit estimate exists and is <= 10
  if (step.estimatedMinutes != null && step.estimatedMinutes <= 10) {
    tips.push('Quick win — finish in one sitting.');
  }

  if ((step.difficulty ?? 0) >= 4) tips.push('Break it down — pick the first easy subtask.');

  if ((step.impactScore ?? 0) >= 8) tips.push('High impact — great for momentum.');

  if (step.blockers && step.blockers.trim().length > 0) tips.push('Remove one blocker to unlock progress.');

  if (tips.length === 0) tips.push('Take one faithful step forward.');

  return tips[0];
}
