import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Playbook } from '../interfaces/playbook';
import { mergePlaybooks } from '../utils/mergePlaybooks';

import { getPlaybooks, updatePlaybookActionSteps } from '../services/apiIntegration';

type PlaybookStatus = 'inProgress' | 'completed';

interface PlaybookStore {
  playbooks: Playbook[];
  isLoading: boolean;
  loadPlaybooks: (userId: string) => Promise<void>;
  updatePlaybook: (updated: Playbook) => void;
  setPlaybooks: (pbs: Playbook[]) => void;
  removePlaybook: (id: string) => void;
  updateActionStep: (playbookId: string, stepId: string, completed: boolean) => void;
}

// Utility to calculate progress and status
function calculateProgressAndStatus(actionSteps: any[], stepId: string, completed: boolean) {
  const updatedSteps = actionSteps.map((step: any) =>
    step.id === stepId ? { ...step, completed } : step
  );
  const total = updatedSteps.length;
  const completedCount = updatedSteps.filter((step: any) => step.completed).length;
  const progress = total > 0 ? completedCount / total : 0;
  const status: PlaybookStatus = updatedSteps.every((step: any) => step.completed) ? 'completed' : 'inProgress';
  return { updatedSteps, progress, status, total };
}

// Create the store with proper typing
export const usePlaybookStore = create<PlaybookStore>()(
  persist(
    (set, _get) => ({
      playbooks: [],
      isLoading: false,

      loadPlaybooks: async (userId: string) => {
        set({ isLoading: true });
        try {
          const remotePlaybooks = await getPlaybooks(userId);
          set((state) => {
            const merged = mergePlaybooks(state.playbooks, remotePlaybooks);

            return { playbooks: merged, isLoading: false };
          });
        } catch (error) {
          console.error('[loadPlaybooks] Error:', error);
          set({ isLoading: false });
        }
      },

      updatePlaybook: (updated: Playbook) => {
        set((state) => ({
          playbooks: state.playbooks.map((pb) =>
            pb.id === updated.id ? updated : pb,
          ),
        }));
      },

      setPlaybooks: (pbs: Playbook[]) => set({ playbooks: pbs }),

      removePlaybook: (id: string) => set((state) => ({
        playbooks: state.playbooks.filter((pb) => pb.id !== id),
      })),

      updateActionStep: async (playbookId, stepId, completed) => {
        let updatedPlaybook: Playbook | undefined;
        set((state) => {
          const playbooks = state.playbooks.map((playbook) => {
            if (playbook.id !== playbookId) {return playbook;}
            const { updatedSteps, progress, status, total } = calculateProgressAndStatus(
              playbook.actionSteps,
              stepId,
              completed
            );
            updatedPlaybook = {
              ...playbook,
              actionSteps: updatedSteps,
              progress,
              totalTasks: total,
              status,
              completedAt: status === 'completed' ? new Date().toISOString() : playbook.completedAt,
              updatedAt: new Date().toISOString(),
            };

            return updatedPlaybook;
          });

          return { playbooks };
        });
        // Persist in background
        setTimeout(async () => {
          if (updatedPlaybook) {
            try {

              await updatePlaybookActionSteps(
                playbookId,
                updatedPlaybook.actionSteps,
                updatedPlaybook.completedAt
              );
            } catch (err) {
              console.error('[updateActionStep] Error persisting:', err);
            }
          }
        }, 0);
      },
    }),
    {
      name: 'playbook-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
