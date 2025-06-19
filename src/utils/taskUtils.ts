// src/utils/taskUtils.ts
import { ActionStep } from '../context/ActionStepsContext';

export function getCompletedStepsCount(actionSteps: ActionStep[] = []): { completed: number; total: number } {
  let completed = 0;
  let total = 0;

  actionSteps.forEach(step => {
    const subTasks = step.subTasks || [];
    const hasSubTasks = subTasks.length > 0;
    if (hasSubTasks) {
      // For steps with subtasks, only count the step as completed if all subtasks are completed
      const allSubTasksCompleted = subTasks.every(st => st.completed);
      total++;
      if (allSubTasksCompleted) {completed++;}
    } else {
      total++;
      if (step.completed) {completed++;}
    }
  });
  return { completed, total };
}
