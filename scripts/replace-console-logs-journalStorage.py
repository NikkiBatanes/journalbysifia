#!/usr/bin/env python3
"""
Automated Console Log Replacement Script for journalStorage.ts
Replaces remaining console.log/warn/error with Logger calls
"""

import re
import sys

def replace_console_logs(file_path):
    """Replace console logs with Logger calls in journalStorage.ts"""
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    replacements_made = 0
    
    # Define replacement patterns
    replacements = [
        # Pattern 1: console.error with authentication messages
        (
            r"console\.error\('\\n⚠️ Authentication issue detected\. Please ensure you are logged in\.'\);",
            "Logger.error('Authentication issue detected', undefined, {\n        component: 'journalStorage',\n        action: 'auth_check',\n      });"
        ),
        # Pattern 2: console.error with session messages
        (
            r"console\.error\('No valid session available\. User must be logged in\.'\);",
            "Logger.error('No valid session available', undefined, {\n        component: 'journalStorage',\n        action: 'session_check',\n      });"
        ),
        # Pattern 3: console.warn with user ID mismatch
        (
            r"console\.warn\('User ID mismatch, using session user ID'\);",
            "Logger.warn('User ID mismatch, using session user ID', {\n        component: 'journalStorage',\n        action: 'user_id_validation',\n      });"
        ),
        # Pattern 4: console.error with selected_date
        (
            r"console\.error\('Missing or invalid selected_date when updating entry:', updatedData\.selected_date\);",
            "Logger.error('Missing or invalid selected_date when updating entry', undefined, {\n        component: 'journalStorage',\n        action: 'update_cloud_entry',\n        selectedDate: updatedData.selected_date,\n      });"
        ),
        # Pattern 5: console.warn with existing data newer
        (
            r"console\.warn\('Existing data is newer than the update'\);",
            "Logger.warn('Existing data is newer than the update', {\n        component: 'journalStorage',\n        action: 'update_cloud_entry',\n      });"
        ),
        # Pattern 6: console.error with attempt failed
        (
            r"console\.error\(`Attempt \$\{attempt\} failed:`, error\.message\);",
            "Logger.error(`Attempt ${attempt} failed`, error as Error, {\n          component: 'journalStorage',\n          action: 'update_cloud_entry_retry',\n          attempt,\n        });"
        ),
        # Pattern 7: console.error with refresh session
        (
            r"console\.error\('Failed to refresh session:', refreshError\);",
            "Logger.error('Failed to refresh session', refreshError as Error, {\n            component: 'journalStorage',\n            action: 'refresh_session',\n          });"
        ),
        # Pattern 8: console.error with ERROR in updateCloudEntry
        (
            r"console\.error\('\\n!!! ERROR in updateCloudEntry !!!'\);",
            "// Error logged below"
        ),
        # Pattern 9: console.error with Error details object
        (
            r"console\.error\('Error details:', \{[^}]+\}\);",
            "// Error details included in Logger call"
        ),
        # Pattern 10: console.error with fetching cloud entry
        (
            r"console\.error\('Error fetching cloud entry:', \{[^}]+\}\);",
            "Logger.error('Error fetching cloud entry', error as Error, {\n        component: 'journalStorage',\n        action: 'get_cloud_entry',\n      });"
        ),
        # Pattern 11: console.error with ERROR in getCloudEntry
        (
            r"console\.error\('!!! ERROR in getCloudEntry !!!'\);",
            "Logger.fatal('CRITICAL ERROR in getCloudEntry', error as Error, {\n      component: 'journalStorage',\n      action: 'get_cloud_entry',\n    });"
        ),
        # Pattern 12: console.error with Error details errorMessage
        (
            r"console\.error\('Error details:', errorMessage\);",
            "// Error details included in Logger call"
        ),
        # Pattern 13: console.error with checking existing entries
        (
            r"console\.error\('Error checking for existing entries:', fetchError\);",
            "Logger.error('Error checking for existing entries', fetchError as Error, {\n        component: 'journalStorage',\n        action: 'sync_to_cloud',\n      });"
        ),
        # Pattern 14: console.error with syncToCloud
        (
            r"console\.error\('Error during syncToCloud:', error\);",
            "Logger.error('Error during syncToCloud', error as Error, {\n      component: 'journalStorage',\n      action: 'sync_to_cloud',\n    });"
        ),
        # Pattern 15: console.error with No valid session (emoji)
        (
            r"console\.error\('❌ No valid session available\. User must be logged in\.'\);",
            "Logger.error('No valid session available for sync', undefined, {\n        component: 'journalStorage',\n        action: 'sync_from_cloud',\n      });"
        ),
        # Pattern 16: console.warn with User ID mismatch (detailed)
        (
            r"console\.warn\(`User ID mismatch: \$\{userId\} \(provided\) vs \$\{sessionUserId\} \(session\)\. Using session user ID\.`\);",
            "Logger.warn('User ID mismatch in syncFromCloud', {\n        component: 'journalStorage',\n        action: 'sync_from_cloud',\n        providedUserId: userId,\n        sessionUserId,\n      });"
        ),
        # Pattern 17: console.warn with fetching cloud entry by ID
        (
            r"console\.warn\('Error fetching cloud entry by ID, will try by date/type:', error\);",
            "Logger.warn('Error fetching cloud entry by ID, trying by date/type', {\n            component: 'journalStorage',\n            action: 'sync_from_cloud',\n          });"
        ),
        # Pattern 18: console.error with querying cloud entries
        (
            r"console\.error\('Error querying cloud entries:', error\);",
            "Logger.error('Error querying cloud entries', error as Error, {\n            component: 'journalStorage',\n            action: 'sync_from_cloud',\n          });"
        ),
        # Pattern 19: console.error with syncFromCloud (multiple occurrences)
        (
            r"console\.error\('Error in syncFromCloud:', error\);",
            "Logger.error('Error in syncFromCloud', error as Error, {\n      component: 'journalStorage',\n      action: 'sync_from_cloud',\n    });"
        ),
        # Pattern 20: console.error with clearJournalCache
        (
            r"console\.error\('Error in clearJournalCache:', error\);",
            "Logger.error('Error in clearJournalCache', error as Error, {\n      component: 'journalStorage',\n      action: 'clear_cache',\n    });"
        ),
        # Pattern 21: console.error with forceRefreshJournalData
        (
            r"console\.error\('Error in forceRefreshJournalData:', error\);",
            "Logger.error('Error in forceRefreshJournalData', error as Error, {\n      component: 'journalStorage',\n      action: 'force_refresh',\n    });"
        ),
        # Pattern 22: console.error with syncing contentType
        (
            r"console\.error\(`Error syncing \$\{contentType\}:`, error\);",
            "Logger.error(`Error syncing ${contentType}`, error as Error, {\n          component: 'journalStorage',\n          action: 'force_refresh_all',\n          contentType,\n        });"
        ),
        # Pattern 23: console.error with syncing time blocks
        (
            r"console\.error\('Error syncing time blocks:', error\);",
            "Logger.error('Error syncing time blocks', error as Error, {\n        component: 'journalStorage',\n        action: 'force_refresh_all',\n      });"
        ),
        # Pattern 24: console.error with forceRefreshAllJournalData
        (
            r"console\.error\('Error in forceRefreshAllJournalData:', error\);",
            "Logger.error('Error in forceRefreshAllJournalData', error as Error, {\n      component: 'journalStorage',\n      action: 'force_refresh_all',\n    });"
        ),
    ]
    
    # Apply replacements
    for pattern, replacement in replacements:
        matches = re.findall(pattern, content)
        if matches:
            content = re.sub(pattern, replacement, content)
            replacements_made += len(matches)
            print(f"✅ Replaced {len(matches)} occurrence(s) of pattern")
    
    # Write back if changes were made
    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"\n✅ Successfully replaced {replacements_made} console log statements")
        print(f"📝 File updated: {file_path}")
        return True
    else:
        print("⚠️ No changes made")
        return False

if __name__ == "__main__":
    file_path = "src/storage/journalStorage.ts"
    success = replace_console_logs(file_path)
    sys.exit(0 if success else 1)
