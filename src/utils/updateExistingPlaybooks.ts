/**
 * Utility to update existing playbooks with journal type detection
 * This can be run to retroactively add journal types to playbooks that don't have them
 */

import { supabase } from '../services/supabaseClient';
import { Logger } from '../utils/ProductionLogger';
import { detectJournalType } from './journalTypeDetection';

/**
 * Updates all existing subtasks that don't have journal types detected
 */
export async function updateExistingPlaybooksWithJournalTypes(userId: string): Promise<void> {
  try {

    // Get all subtasks that don't have journal types or have 'none'
    const { data: subtasks, error } = await supabase
      .from('playbook_sub_tasks')
      .select(`
        id,
        text,
        detected_journal_type,
        playbook_action_steps!inner(
          playbook_id,
          playbooks!inner(
            user_id
          )
        )
      `)
      .eq('playbook_action_steps.playbooks.user_id', userId)
      .or('detected_journal_type.is.null,detected_journal_type.eq.none,detected_journal_type.eq.');

    if (error) {
      Logger.error('❌ Error fetching subtasks', error as Error, {
      component: 'updateExistingPlaybooks',
    });
      return;
    }

    if (!subtasks || subtasks.length === 0) {

      return;
    }

    // Process subtasks in batches
    const batchSize = 50;

    for (let i = 0; i < subtasks.length; i += batchSize) {
      const batch = subtasks.slice(i, i + batchSize);
      const updates = [];

      for (const subtask of batch) {
        if (!subtask.text) {continue;}

        const detectedType = detectJournalType(subtask.text);

        if (detectedType !== 'none') {
          updates.push({
            id: subtask.id,
            detected_journal_type: detectedType,
          });
        }
      }

      if (updates.length > 0) {
        const { error: updateError } = await supabase
          .from('playbook_sub_tasks')
          .upsert(updates, { onConflict: 'id' });

        if (updateError) {
          Logger.error('❌ Error updating batch', updateError as Error, {
  component: 'updateExistingPlaybooks',
});
        } else {
          // Updates applied successfully

        }
      }
    }

  } catch (error) {
    Logger.error('❌ Error in updateExistingPlaybooksWithJournalTypes', error as Error, {
      component: 'updateExistingPlaybooks',
    });
  }
}

/**
 * Updates a specific playbook with journal type detection
 */
export async function updatePlaybookWithJournalTypes(playbookId: string): Promise<void> {
  try {

    // Get all subtasks for this playbook
    const { data: subtasks, error } = await supabase
      .from('playbook_sub_tasks')
      .select(`
        id,
        text,
        detected_journal_type,
        playbook_action_steps!inner(
          playbook_id
        )
      `)
      .eq('playbook_action_steps.playbook_id', playbookId)
      .or('detected_journal_type.is.null,detected_journal_type.eq.none,detected_journal_type.eq.');

    if (error) {
      Logger.error('❌ Error fetching subtasks', error as Error, {
      component: 'updateExistingPlaybooks',
    });
      return;
    }

    if (!subtasks || subtasks.length === 0) {

      return;
    }

    const updates = [];

    for (const subtask of subtasks) {
      if (!subtask.text) {continue;}

      const detectedType = detectJournalType(subtask.text);

      if (detectedType !== 'none') {
        updates.push({
          id: subtask.id,
          detected_journal_type: detectedType,
        });
      }
    }

    if (updates.length > 0) {
      const { error: updateError } = await supabase
        .from('playbook_sub_tasks')
        .upsert(updates, { onConflict: 'id' });

      if (updateError) {
        Logger.error('❌ Error updating subtasks', updateError as Error, {
  component: 'updateExistingPlaybooks',
});
      } else {

      }
    }

  } catch (error) {
    Logger.error('❌ Error in updatePlaybookWithJournalTypes', error as Error, {
      component: 'updateExistingPlaybooks',
    });
  }
}
