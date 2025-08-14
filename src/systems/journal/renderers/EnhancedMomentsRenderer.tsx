import React from 'react';
import { View, Text, StyleSheet, SectionList, RefreshControlProps, ScrollView, Dimensions, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { JournalPlugin } from '../types';
import { PluginRenderer } from '../PluginRenderer';
import { Colors } from '../../../theme/colors';
import { Fonts } from '../../../theme/fonts';
import { format, startOfMonth } from 'date-fns';
import { GroupingType, SortType } from '../../../components/moments/GroupingControls';
import { DateRange } from '../../../components/moments/DateFilterBar';
import { supabase } from '../../../services/supabaseClient';
import { useAuth } from '../../../context/IndustryStandardAuthContext';

const { width: screenWidth } = Dimensions.get('window');

interface EnhancedMomentsRendererProps {
  plugins: JournalPlugin[];
  dateRange: DateRange;
  refreshKey?: number;
  groupBy: GroupingType;
  sortBy: SortType;
  searchQuery: string;
  style?: any;
  headerComponents?: React.ReactElement[];
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

interface MomentEntry {
  plugin: JournalPlugin;
  date: Date;
  category: string;
  type: string;
}

interface GroupedSection {
  title: string;
  data: MomentEntry[][];  // Array of arrays - each inner array represents a carousel group
  key: string;
}

export const EnhancedMomentsRenderer: React.FC<EnhancedMomentsRendererProps> = ({
  plugins,
  dateRange,
  refreshKey,
  groupBy,
  sortBy,
  searchQuery,
  style,
  headerComponents = [],
  refreshControl,
}) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [realEntries, setRealEntries] = React.useState<MomentEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Fetch real journal entries from user interactions - NOT generated content
  const fetchRealEntries = React.useCallback(async () => {
    if (!user) {
      setRealEntries([]);
      setLoading(false);
      return;
    }

    console.log('🔍 [MomentsRenderer] Starting data fetch for user:', user.id);
    console.log('🔍 [MomentsRenderer] Date range filter:', {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      label: dateRange.label
    });
    console.log('🔍 [MomentsRenderer] Available plugins:', plugins.map(p => ({ id: p.id, title: p.title, category: p.category })));

    try {
      setLoading(true);
      let entries: MomentEntry[] = [];

      // Fetch real journal entries from user interactions - NOT generated content
      try {
        // Fetch journal entries (todos, today's focus, gratitude, etc.) - the main user content
        const { data: journalEntries, error: journalEntriesError } = await supabase
          .from('journal_entries')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        console.log('📊 [MomentsRenderer] Journal entries query result:', { 
          error: journalEntriesError, 
          count: journalEntries?.length || 0,
          sample: journalEntries?.slice(0, 3).map(e => ({ 
            content_type: e.content_type, 
            created_at: e.created_at,
            hasContent: !!e.content 
          }))
        });

        // Check specifically for July 31 entries in raw data
        if (journalEntries) {
          const july31RawEntries = journalEntries.filter(entry => {
            const selectedDate = entry.selected_date ? new Date(entry.selected_date) : null;
            const createdDate = new Date(entry.created_at);
            
            const selectedIsJuly31 = selectedDate && selectedDate.getMonth() === 6 && selectedDate.getDate() === 31;
            const createdIsJuly31 = createdDate.getMonth() === 6 && createdDate.getDate() === 31;
            
            return selectedIsJuly31 || createdIsJuly31;
          });
          
          if (july31RawEntries.length > 0) {
            console.log('🗓️ [MomentsRenderer] Found July 31 raw entries in database:', july31RawEntries.map(e => ({
              content_type: e.content_type,
              selected_date: e.selected_date,
              created_at: e.created_at,
              hasContent: !!e.content,
              content: typeof e.content === 'string' ? e.content.substring(0, 50) + '...' : 'object'
            })));
          } else {
            console.log('🗓️ [MomentsRenderer] No July 31 entries found in raw database results (checked both selected_date and created_at)');
          }
        }

        if (!journalEntriesError && journalEntries && journalEntries.length > 0) {
          console.log('🔍 [MomentsRenderer] Processing', journalEntries.length, 'journal entries...');
          let processedCount = 0;
          let skippedCount = 0;
          
          journalEntries.forEach(entry => {
            // Check if entry has meaningful content (or is a devotional marker)
            const hasTextContent = entry.content && (
                typeof entry.content === 'string' ? entry.content.trim().length > 0 :
                typeof entry.content === 'object' ? Object.keys(entry.content).length > 0 : true);

            // Detect devotional saved in journal_entries
            const devoStrings = [
              (entry as any).content_type,
              (entry as any).source,
              (entry as any).type,
              (entry as any).journal_category,
              (entry as any).action,
            ].filter(Boolean) as string[];
            const devoBooleans = [
              (entry as any).prayed_devo,
              (entry as any).is_devo,
              (entry as any).is_devotional,
              (entry as any).prayedDevotional,
            ].filter(v => typeof v === 'boolean') as boolean[];
            const isDevotionalJE =
              devoStrings.some(v => {
                const s = (v || '').toLowerCase();
                return s.includes('devo') || s.includes('devotional') || s.includes('devotion');
              }) || devoBooleans.some(Boolean);

            const hasContent = hasTextContent || isDevotionalJE;

            console.log('🔍 [MomentsRenderer] Content check for entry:', {
              content_type: entry.content_type,
              hasContent,
              hasTextContent,
              isDevotionalJE,
              contentType: typeof entry.content,
              contentPreview: typeof entry.content === 'string' ? entry.content.substring(0, 30) + '...' : 'object'
            });
            
            if (hasContent) {
              console.log('🔍 [MomentsRenderer] Processing journal entry:', { 
                content_type: entry.content_type, 
                created_at: entry.created_at,
                content: typeof entry.content === 'string' ? entry.content.substring(0, 50) + '...' : 'object'
              });

              // Find appropriate plugin based on content_type
              let plugin = null;
              
              // Map content types to plugin searches - focus on plan/reflect/pray/devo plugins
              const contentTypeMap: Record<string, string[]> = {
                'gratitude': ['gratitude', 'reflect', 'journal'],
                'todo': ['todo', 'task', 'plan', 'journal'],
                'today_win': ['win', 'reflect', 'journal'],
                'looking_forward': ['forward', 'reflect', 'journal'],
                'todays_focus': ['focus', 'plan', 'journal'],
                'prayed_devotional': ['devotional', 'devo', 'prayer', 'journal'],
                'devotional': ['devotional', 'devo', 'journal'],
              };
              
              const searchTerms = contentTypeMap[entry.content_type] || (isDevotionalJE ? ['devotional', 'devo'] : ['journal']);
              
              console.log('🔍 [MomentsRenderer] Searching for plugin with terms:', searchTerms);
              
              for (const term of searchTerms) {
                plugin = plugins.find((p: JournalPlugin) => 
                  p.title.toLowerCase().includes(term.toLowerCase())
                );
                if (plugin) {
                  console.log('✅ [MomentsRenderer] Found plugin:', plugin.title, 'for term:', term);
                  break;
                }
              }
              
              // Final fallback - use any available plugin
              if (!plugin && plugins.length > 0) {
                plugin = plugins[0];
                console.log('⚠️ [MomentsRenderer] Using fallback plugin:', plugin.title);
              }

              if (plugin) {
                // Create readable type names
                const typeNames: Record<string, string> = {
                  'gratitude': 'Gratitude List',
                  'todo': 'Todo',
                  'today_win': "Today's Win",
                  'looking_forward': 'Looking Forward To',
                  'todays_focus': "Today's Focus",
                  'prayed_devotional': 'Prayed Devotional',
                  'devotional': 'Devotional',
                };
                
                // Prefer a Prayer plugin for devotional journal entries so they appear under Prayer Journal.
                // Fallback to a Devotional plugin if no prayer plugin exists.
                const prayerPluginFromJE =
                  plugins.find((p: JournalPlugin) => p.title.toLowerCase().includes('prayer journal')) ||
                  plugins.find((p: JournalPlugin) => p.title.toLowerCase().includes('prayer list')) ||
                  plugins.find((p: JournalPlugin) => p.title.toLowerCase().includes('prayer')) ||
                  plugins.find((p: JournalPlugin) => (p.category || '').toLowerCase().includes('pray')) ||
                  plugins.find((p: JournalPlugin) => (p.category || '').toLowerCase().includes('prayer')) ||
                  null as any;

                const devoPlugin = plugins.find((p: JournalPlugin) => p.title.toLowerCase().includes('devotional') || p.title.toLowerCase().includes('devo')) ||
                                   plugins.find((p: JournalPlugin) => (p.category || '').toLowerCase().includes('devotional')) ||
                                   null as any;

                const selectedPlugin = isDevotionalJE ? (prayerPluginFromJE || devoPlugin || plugin) : plugin;
                const momentEntry = {
                  plugin: selectedPlugin,
                  date: new Date(entry.selected_date || entry.created_at), // Use selected_date first, fallback to created_at
                  category: isDevotionalJE ? 'Prayer' : 'Journal',
                  type: isDevotionalJE ? 'Prayed Devotional' : (typeNames[entry.content_type] || entry.content_type || 'Journal Entry'),
                };
                
                console.log('✅ [MomentsRenderer] Adding journal entry:', momentEntry);
                entries.push(momentEntry);
                processedCount++;
              } else {
                console.log('❌ [MomentsRenderer] No plugin found for entry:', entry.content_type);
                skippedCount++;
              }
            } else {
              console.log('⚠️ [MomentsRenderer] Skipping entry with no content:', entry.content_type);
              skippedCount++;
            }
          });
          
          console.log('📊 [MomentsRenderer] Journal entries processing summary:', {
            total: journalEntries.length,
            processed: processedCount,
            skipped: skippedCount,
            successRate: `${Math.round((processedCount / journalEntries.length) * 100)}%`
          });
        } else {
          console.log('⚠️ [MomentsRenderer] No journal entries found or error occurred:', {
            error: journalEntriesError,
            hasData: !!journalEntries,
            count: journalEntries?.length || 0
          });
        }

        // Fetch user prayer entries (from pray carousel interactions)
        const { data: prayers, error: prayersError } = await supabase
          .from('prayers')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!prayersError && prayers && prayers.length > 0) {
          console.log('📊 [MomentsRenderer] Prayers query result:', { 
            error: prayersError, 
            count: prayers?.length || 0,
            sample: prayers?.slice(0, 3).map(p => ({ 
              created_at: p.created_at,
              selected_date: p.selected_date,
              hasContent: !!(p.content || p.prayer_text)
            }))
          });

          // Check specifically for August 1-2 prayer entries
          const august12Prayers = prayers.filter(prayer => {
            const selectedDate = prayer.selected_date ? new Date(prayer.selected_date) : null;
            const createdDate = new Date(prayer.created_at);
            
            const selectedIsAugust12 = selectedDate && selectedDate.getMonth() === 7 && (selectedDate.getDate() === 1 || selectedDate.getDate() === 2);
            const createdIsAugust12 = createdDate.getMonth() === 7 && (createdDate.getDate() === 1 || createdDate.getDate() === 2);
            
            return selectedIsAugust12 || createdIsAugust12;
          });
          
          if (august12Prayers.length > 0) {
            console.log('🗓️ [MomentsRenderer] Found August 1-2 prayer entries:', august12Prayers.map(p => ({
              selected_date: p.selected_date,
              created_at: p.created_at,
              hasContent: !!(p.content || p.prayer_text),
              content: p.content || p.prayer_text,
              journal_category: p.journal_category
            })));
          } else {
            console.log('🗓️ [MomentsRenderer] No August 1-2 prayer entries found in raw database results');
          }

          // Try to find the best prayer plugin - prefer Prayer Journal, then Prayer List, then any prayer plugin
          let prayerPlugin = plugins.find((p: JournalPlugin) => p.title.toLowerCase().includes('prayer journal'));
          if (!prayerPlugin) {
            prayerPlugin = plugins.find((p: JournalPlugin) => p.title.toLowerCase().includes('prayer list'));
          }
          if (!prayerPlugin) {
            prayerPlugin = plugins.find((p: JournalPlugin) => p.title.toLowerCase().includes('prayer'));
          }
          // Fallback by category if titles don't contain the word 'prayer'
          if (!prayerPlugin) {
            prayerPlugin = plugins.find((p: JournalPlugin) => (p.category || '').toLowerCase().includes('pray')) ||
                           plugins.find((p: JournalPlugin) => (p.category || '').toLowerCase().includes('prayer')) ||
                           null as any;
          }
          // Final generic fallback
          if (!prayerPlugin && plugins.length > 0) {
            prayerPlugin = plugins[0];
          }
          // Also identify a Devotional plugin for devo prayers
          const devoPlugin = plugins.find((p: JournalPlugin) => p.title.toLowerCase().includes('devotional') || p.title.toLowerCase().includes('devo')) ||
                             plugins.find((p: JournalPlugin) => (p.category || '').toLowerCase().includes('devotional')) ||
                             null as any;
          console.log('🔍 [MomentsRenderer] Prayer plugin search result:', {
            found: !!prayerPlugin,
            pluginTitle: prayerPlugin?.title,
            devoPlugin: devoPlugin?.title,
            availablePlugins: plugins.map(p => p.title)
          });
          
          if (prayerPlugin) {
            let devoCount = 0;
            prayers.forEach(prayer => {
              // Consider entries with journal_category or devotional markers as valid even if text fields are empty
              const rawContent = (prayer as any).content;
              const contentText = typeof rawContent === 'string' ? rawContent : (prayer as any).prayer_text || '';
              const contentObj = typeof rawContent === 'object' && rawContent !== null ? rawContent as any : null;
              const hasText = typeof contentText === 'string' ? contentText.trim().length > 0 : false;
              const hasObjectContent = contentObj ? Object.keys(contentObj).length > 0 : false;
              // Common list fields for people/prayer list structures
              const hasPeopleList = Array.isArray((prayer as any).people) && (prayer as any).people.length > 0;
              const hasPrayerList = Array.isArray((prayer as any).prayer_list) && (prayer as any).prayer_list.length > 0;
              const devoStrings = [
                (prayer as any).source,
                (prayer as any).type,
                (prayer as any).journal_category,
                (prayer as any).action,
              ].filter(Boolean) as string[];
              const devoBooleans = [
                (prayer as any).prayed_devo,
                (prayer as any).is_devo,
                (prayer as any).is_devotional,
                (prayer as any).prayedDevotional,
              ].filter(v => typeof v === 'boolean') as boolean[];
              const isDevotional =
                devoStrings.some(v => {
                  const s = (v || '').toLowerCase();
                  return s.includes('devo') || s.includes('devotional') || s.includes('devotion');
                }) || devoBooleans.some(Boolean);
              if (isDevotional) devoCount++;
              const hasUserContent = hasText || hasObjectContent || hasPeopleList || hasPrayerList || !!(prayer as any).journal_category || isDevotional;

              console.log('🔍 [MomentsRenderer] Processing prayer entry:', {
                created_at: prayer.created_at,
                selected_date: prayer.selected_date,
                hasUserContent,
                hasText,
                isDevotional,
                journal_category: prayer.journal_category,
                source: (prayer as any).source,
                type: (prayer as any).type,
                action: (prayer as any).action,
              });

              if (hasUserContent) {
                const entryDate = new Date((prayer as any).selected_date || (prayer as any).created_at); // Use selected_date first, fallback to created_at
                const typeLabel = isDevotional
                  ? 'Prayed Devotional'
                  : ((prayer as any).journal_category
                      ? ((prayer as any).journal_category as string).charAt(0).toUpperCase() + ((prayer as any).journal_category as string).slice(1) + ' Prayer'
                      : 'Prayer');

                // Keep devotional prayers under the Prayer plugin so they appear in Prayer Journal
                const targetPlugin = prayerPlugin;

                const prayerEntry = {
                  plugin: targetPlugin,
                  date: entryDate,
                  category: 'Prayer',
                  type: typeLabel,
                };

                console.log('✅ [MomentsRenderer] Adding prayer entry:', {
                  ...prayerEntry,
                  pluginTitle: targetPlugin?.title,
                });
                entries.push(prayerEntry);
              } else {
                console.log('⚠️ [MomentsRenderer] Skipping prayer entry with no content and no category');
              }
            });
            console.log('📊 [MomentsRenderer] Prayer processing summary:', {
              total: prayers.length,
              devotionalTagged: devoCount,
            });
          } else {
            console.log('❌ [MomentsRenderer] No prayer plugin found!');
          }
        }

        // Fetch user reflections (from reflect carousel interactions)
        const { data: reflections, error: reflectionsError } = await supabase
          .from('reflection_entries')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!reflectionsError && reflections && reflections.length > 0) {
          console.log('📊 [MomentsRenderer] Reflections query result:', { 
            error: reflectionsError, 
            count: reflections?.length || 0,
            sample: reflections?.slice(0, 3).map(r => ({ 
              created_at: r.created_at,
              selected_date: r.selected_date,
              hasContent: !!(r.content && r.content.trim().length > 0)
            }))
          });

          const reflectionPlugin = plugins.find((p: JournalPlugin) => p.title.toLowerCase().includes('reflection'));
          console.log('🔍 [MomentsRenderer] Reflection plugin search result:', {
            found: !!reflectionPlugin,
            pluginTitle: reflectionPlugin?.title,
            availablePlugins: plugins.map(p => p.title)
          });
          
          if (reflectionPlugin) {
            reflections.forEach(reflection => {
              // Filter out generated reflections - only include user-created heart journal entries
              const isUserCreated = !reflection.source || 
                (reflection.source !== 'devotional' && reflection.source !== 'playbook');
              const isUserType = !reflection.type || 
                (reflection.type !== 'devotional' && reflection.type !== 'playbook');
              
              // Check if reflection has user-created content - be more flexible with content validation
              const hasUserContent = reflection.content && 
                (typeof reflection.content === 'string' ? reflection.content.trim().length > 0 : 
                 typeof reflection.content === 'object' ? Object.keys(reflection.content).length > 0 : true);
              
              console.log('🔍 [MomentsRenderer] Processing reflection entry:', {
                created_at: reflection.created_at,
                selected_date: reflection.selected_date,
                hasUserContent,
                isUserCreated,
                isUserType,
                type: reflection.type,
                source: reflection.source,
                contentPreview: reflection.content ? reflection.content.substring(0, 50) + '...' : 'null'
              });
              
              if (hasUserContent && isUserCreated && isUserType) {
                const reflectionEntry = {
                  plugin: reflectionPlugin,
                  date: new Date(reflection.selected_date || reflection.created_at), // Use selected_date first, fallback to created_at
                  category: 'Reflection',
                  type: reflection.type || 'Reflection',
                };
                
                console.log('✅ [MomentsRenderer] Adding reflection entry:', reflectionEntry);
                entries.push(reflectionEntry);
              } else {
                console.log('⚠️ [MomentsRenderer] Skipping reflection entry:', {
                  reason: !hasUserContent ? 'no content' : !isUserCreated ? 'generated content (source)' : 'generated content (type)',
                  content: reflection.content,
                  contentType: typeof reflection.content,
                  contentLength: reflection.content ? reflection.content.length : 0,
                  source: reflection.source,
                  type: reflection.type
                });
              }
            });
          } else {
            console.log('❌ [MomentsRenderer] No reflection plugin found!');
          }
        }

        // Fetch time blocks (user-created schedule entries)
        const { data: timeBlocks, error: timeBlocksError } = await supabase
          .from('time_blocks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!timeBlocksError && timeBlocks && timeBlocks.length > 0) {
          console.log('📊 [MomentsRenderer] Time blocks query result:', { 
            error: timeBlocksError, 
            count: timeBlocks?.length || 0,
            sample: timeBlocks?.slice(0, 3).map(tb => ({ 
              created_at: tb.created_at,
              selected_date: tb.selected_date,
              hasContent: !!(tb.title || tb.description)
            }))
          });

          timeBlocks.forEach(timeBlock => {
            // Check if time block has meaningful user content
            if (timeBlock.title && timeBlock.title.trim().length > 0) {
              // Find appropriate plugin
              let plugin = plugins.find((p: JournalPlugin) => 
                p.title.toLowerCase().includes('schedule') || 
                p.title.toLowerCase().includes('time') ||
                p.title.toLowerCase().includes('plan')
              );
              
              // Fallback to a generic plugin
              if (!plugin && plugins.length > 0) {
                plugin = plugins[0];
              }

              if (plugin) {
                entries.push({
                  plugin: plugin,
                  date: new Date(timeBlock.selected_date || timeBlock.created_at), // Use selected_date first, fallback to created_at
                  category: 'Schedule',
                  type: 'Time Block',
                });
              }
            }
          });
        }

      } catch (dbError) {
        console.log('Database query error:', dbError);
        // If database queries fail, don't show any entries
      }

      // Only set entries if we have real content
      // Check for duplicates before final processing
      // Build groups by day + plugin + type to detect duplicates across all times
      const duplicateCheck = entries.reduce((acc, entry, index) => {
        const day = format(entry.date, 'yyyy-MM-dd');
        const pluginId = (entry.plugin as any).id || entry.plugin.title;
        const key = `${day}::${pluginId}::${entry.type}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push({ index, plugin: entry.plugin.title, date: entry.date, type: entry.type, category: entry.category });
        return acc;
      }, {} as Record<string, Array<{ index: number; plugin: string; date: Date; type: string; category: string }>>);

      const duplicates = Object.entries(duplicateCheck).filter(([_, list]) => list.length > 1);
      
      if (duplicates.length > 0) {
        console.log('⚠️ [MomentsRenderer] Found duplicates (by day + plugin + type):', duplicates.map(([key, dupEntries]) => ({
          key,
          count: dupEntries.length,
          dates: dupEntries.map(e => e.date.toISOString()),
          plugins: dupEntries.map(e => e.plugin),
          types: dupEntries.map(e => e.type),
          categories: dupEntries.map(e => e.category)
        })));

        // For each day+plugin+type, keep the most recent entry only
        const groupedByKey: Record<string, MomentEntry[]> = {};
        entries.forEach(entry => {
          const day = format(entry.date, 'yyyy-MM-dd');
          const pluginId = (entry.plugin as any).id || entry.plugin.title;
          const key = `${day}::${pluginId}::${entry.type}`;
          if (!groupedByKey[key]) groupedByKey[key] = [];
          groupedByKey[key].push(entry);
        });

        const kept: MomentEntry[] = [];
        const removed: Array<{ key: string; date: string; type: string; category: string; plugin: string }> = [];

        Object.entries(groupedByKey).forEach(([key, list]) => {
          const latest = list.sort((a, b) => b.date.getTime() - a.date.getTime())[0];
          kept.push(latest);
          list.filter(e => e !== latest).forEach(e => removed.push({ key, date: e.date.toISOString(), type: e.type, category: e.category, plugin: e.plugin.title }));
        });

        if (removed.length > 0) {
          console.log('🗑️ [MomentsRenderer] Removing duplicate entries (kept latest per day+plugin+type):', removed);
        }

        entries = kept;
        console.log('✅ [MomentsRenderer] After deduplication (day+plugin+type):', entries.length, 'entries');
      }

      console.log('📋 [MomentsRenderer] Final entries summary:', {
        totalEntries: entries.length,
        duplicatesFound: duplicates.length,
        byType: entries.reduce((acc, entry) => {
          acc[entry.type] = (acc[entry.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        byCategory: entries.reduce((acc, entry) => {
          acc[entry.category] = (acc[entry.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        byPlugin: entries.reduce((acc, entry) => {
          acc[entry.plugin.title] = (acc[entry.plugin.title] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });
      
      // Check specifically for July 31 entries
      const july31Entries = entries.filter(entry => {
        const entryDate = entry.date;
        return entryDate.getMonth() === 6 && entryDate.getDate() === 31; // July is month 6 (0-indexed)
      });
      
      if (july31Entries.length > 0) {
        console.log('🗓️ [MomentsRenderer] Found July 31 entries:', july31Entries.map(e => ({
          type: e.type,
          date: e.date.toISOString(),
          plugin: e.plugin.title
        })));
      } else {
        console.log('🗓️ [MomentsRenderer] No July 31 entries found in final results');
      }

      // Check specifically for August 1-2 entries
      const august12Entries = entries.filter(entry => {
        const entryDate = entry.date;
        return entryDate.getMonth() === 7 && (entryDate.getDate() === 1 || entryDate.getDate() === 2); // August is month 7 (0-indexed)
      });
      
      if (august12Entries.length > 0) {
        console.log('🗓️ [MomentsRenderer] Found August 1-2 entries:', august12Entries.map(e => ({
          type: e.type,
          date: e.date.toISOString(),
          plugin: e.plugin.title,
          category: e.category
        })));
      } else {
        console.log('🗓️ [MomentsRenderer] No August 1-2 entries found in final results');
      }
      
      setRealEntries(entries);
    } catch (error) {
      console.error('❌ [MomentsRenderer] Error fetching journal entries:', error);
      setRealEntries([]);
    } finally {
      setLoading(false);
    }
  }, [user, plugins]);

  // Fetch entries when component mounts or dependencies change
  React.useEffect(() => {
    fetchRealEntries();
  }, [fetchRealEntries, refreshKey]);

  // Generate moment entries from real data
  const generateMomentEntries = React.useMemo(() => {
    console.log('🔍 [MomentsRenderer] Filtering entries with dateRange:', dateRange);
    console.log('🔍 [MomentsRenderer] Raw entries count:', realEntries.length);
    
    // First filter by date range
    let filteredEntries = realEntries.filter(entry => {
      const entryDate = entry.date;
      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);
      
      // Set times to handle date comparison properly
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      
      const isInRange = entryDate >= startDate && entryDate <= endDate;
      
      if (!isInRange) {
        console.log('🔍 [MomentsRenderer] Entry filtered out by date:', {
          entryDate: entryDate.toISOString(),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          type: entry.type,
          category: entry.category
        });
      } else {
        // Log entries that pass date filtering, especially for July 31 and August 1-2
        const isJuly31 = entryDate.getMonth() === 6 && entryDate.getDate() === 31;
        const isAugust12 = entryDate.getMonth() === 7 && (entryDate.getDate() === 1 || entryDate.getDate() === 2);
        
        if (isJuly31 || isAugust12) {
          console.log('✅ [MomentsRenderer] Special date entry passed filtering:', {
            entryDate: entryDate.toISOString(),
            type: entry.type,
            category: entry.category,
            plugin: entry.plugin.title
          });
        }
      }
      
      return isInRange;
    });
    
    console.log('🔍 [MomentsRenderer] After date filtering:', filteredEntries.length);
    
    // Then filter by search query if provided
    if (searchQuery.trim()) {
      filteredEntries = filteredEntries.filter(entry => 
        entry.plugin.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
      console.log('🔍 [MomentsRenderer] After search filtering:', filteredEntries.length);
    }

    return filteredEntries;
  }, [realEntries, searchQuery, dateRange]);

  // Sort entries
  const sortedEntries = React.useMemo(() => {
    const sorted = [...generateMomentEntries];

    switch (sortBy) {
      case 'newest':
        return sorted.sort((a, b) => b.date.getTime() - a.date.getTime());
      case 'oldest':
        return sorted.sort((a, b) => a.date.getTime() - b.date.getTime());
      case 'category':
        return sorted.sort((a, b) => {
          if (a.category === b.category) {
            return b.date.getTime() - a.date.getTime();
          }
          return a.category.localeCompare(b.category);
        });
      case 'type':
        return sorted.sort((a, b) => {
          if (a.type === b.type) {
            return b.date.getTime() - a.date.getTime();
          }
          return a.plugin.title.localeCompare(b.plugin.title);
        });
      default:
        return sorted;
    }
  }, [generateMomentEntries, sortBy]);

  // Group entries with carousel support
  const groupedSections = React.useMemo((): GroupedSection[] => {
    if (groupBy === 'none') {
      // For 'none' grouping, create carousel groups by type within the single section
      const typeGroups: Record<string, MomentEntry[]> = {};
      
      sortedEntries.forEach((entry) => {
        const typeKey = entry.type;
        if (!typeGroups[typeKey]) {
          typeGroups[typeKey] = [];
        }
        typeGroups[typeKey].push(entry);
      });

      const carouselData = Object.values(typeGroups);
      
      return [{
        title: 'All Moments',
        data: carouselData,
        key: 'all',
      }];
    }

    const groups: Record<string, MomentEntry[]> = {};

    sortedEntries.forEach((entry) => {
      let groupKey: string;

      switch (groupBy) {
        case 'date':
          groupKey = format(entry.date, 'yyyy-MM-dd');
          break;
        case 'month':
          groupKey = format(startOfMonth(entry.date), 'yyyy-MM');
          break;
        case 'category':
          groupKey = entry.category;
          break;
        case 'type':
          groupKey = entry.type;
          break;
        default:
          groupKey = 'default';
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(entry);
    });

    // Convert to sections array with carousel support
    const sections = Object.entries(groups).map(([key, entries]) => {
      let title = key;

      // For date grouping, create groups by type within each date
      if (groupBy === 'date') {
        // Collect ALL entries per type for the date
        const typeGroups: Record<string, MomentEntry[]> = {};
        
        entries.forEach((entry) => {
          const typeKey = entry.type;
          if (!typeGroups[typeKey]) typeGroups[typeKey] = [];
          typeGroups[typeKey].push(entry);
        });

        // Build groups: devotional types keep all entries (carousel), non-devotional collapse to latest only
        const groupEntries: { type: string; items: MomentEntry[]; repr: MomentEntry }[] = Object.entries(typeGroups).map(([type, items]) => {
          const sorted = items.sort((a, b) => b.date.getTime() - a.date.getTime());
          const isDevotionalType = type.toLowerCase().includes('devotional');
          return {
            type,
            items: isDevotionalType ? sorted : [sorted[0]],
            repr: sorted[0],
          };
        });

        // Enforce ordering using the representative item for comparison
        const ordered = groupEntries.sort((a, b) => {
          const order = (t: string) => {
            const s = (t || '').toLowerCase();
            if (s.includes("today's focus") || s.includes('todays focus')) return 0; // highest priority
            if (s === 'todo' || s.includes('todo')) return 1;
            return 2;
          };
          const oa = order(a.type);
          const ob = order(b.type);
          if (oa !== ob) return oa - ob;
          // fallback by recency
          return b.repr.date.getTime() - a.repr.date.getTime();
        });

        // Finally, map into carouselData (each item is an array; devotional arrays can have multiple slides)
        const carouselData = ordered.map(group => group.items);
        
        // Get proper title for date grouping
        if (entries.length > 0) {
          const firstEntry = entries[0];
          const isCurrentYear = firstEntry.date.getFullYear() === new Date().getFullYear();
          title = format(firstEntry.date, isCurrentYear ? 'EEEE, MMMM d' : 'EEEE, MMMM d, yyyy');
        }
        
        return {
          title,
          data: carouselData,
          key,
        };
      }

      // For other grouping types, just wrap entries in array for consistency
      // Get proper title for the group
      if (entries.length > 0) {
        const firstEntry = entries[0];
        switch (groupBy) {
          case 'month':
            title = format(firstEntry.date, 'MMMM yyyy');
            break;
          case 'category':
            title = firstEntry.category.charAt(0).toUpperCase() + firstEntry.category.slice(1);
            break;
          case 'type':
            title = firstEntry.plugin.title;
            break;
        }
      }
      
      return {
        title,
        data: [entries],
        key,
      };
    });

    // Sort sections
    return sections.sort((a, b) => {
      if (groupBy === 'date' || groupBy === 'month') {
        // Sort by date (newest first for date grouping)
        const aFirstGroup = a.data[0];
        const bFirstGroup = b.data[0];
        const aDate = aFirstGroup && aFirstGroup.length > 0 ? aFirstGroup[0].date : new Date(0);
        const bDate = bFirstGroup && bFirstGroup.length > 0 ? bFirstGroup[0].date : new Date(0);
        return sortBy === 'oldest' ? aDate.getTime() - bDate.getTime() : bDate.getTime() - aDate.getTime();
      }
      // Sort alphabetically for category/type
      return a.title.localeCompare(b.title);
    });
  }, [sortedEntries, groupBy, sortBy]);

  const renderSectionHeader = ({ section }: { section: GroupedSection }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <Text style={styles.sectionCount}>
        {section.data.length} {section.data.length === 1 ? 'entry' : 'entries'}
      </Text>
    </View>
  );

  // Render carousel item (group of entries of the same type)
  const renderCarouselItem = ({ item: carouselGroup, index }: { item: MomentEntry[]; index: number }) => {
    if (!carouselGroup || carouselGroup.length === 0) return null;

    const firstEntry = carouselGroup[0];
    const isDevotional =
      (firstEntry.category && firstEntry.category.toLowerCase().includes('devotional')) ||
      (firstEntry.type && firstEntry.type.toLowerCase().includes('devotional'));
    
    // Special full-bleed carousel for Devotional
    if (isDevotional) {
      const { width } = Dimensions.get('window');
      const ITEM_WIDTH = Math.round(width); // Rounded to avoid sub-pixel gaps on iOS
      const JOURNAL_SIDE_PAD = 16; // matches devoHeaderContainer paddingHorizontal
      const baseLeftBreakout = (insets?.left || 0) + JOURNAL_SIDE_PAD;
      const baseRightBreakout = (insets?.right || 0) + JOURNAL_SIDE_PAD;
      const EDGE_OVERDRAW = 2; // eliminate tiny edges on high-DPI devices
      const leftBreakout = baseLeftBreakout + EDGE_OVERDRAW;
      const rightBreakout = baseRightBreakout + EDGE_OVERDRAW;

      return (
        <View style={styles.carouselContainer}>
          {/* Fixed header (time + tag) stays put and aligns with Prayer Journal */}
          <View style={styles.devoHeaderContainer}>
            <View style={styles.momentHeader}>
              <Text style={styles.momentDate}>{format(firstEntry.date, 'h:mm a')}</Text>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{firstEntry.category.toUpperCase()}</Text>
              </View>
            </View>
          </View>

          {/* True edge-to-edge carousel */}
          <View style={[styles.devoEdgeToEdge, { marginLeft: -leftBreakout, marginRight: -rightBreakout }]}>
            <FlatList
              horizontal
              data={carouselGroup}
              keyExtractor={(entry, idx) => `${entry.plugin.id}-${idx}`}
              showsHorizontalScrollIndicator={false}
              bounces={false}
              nestedScrollEnabled
              removeClippedSubviews={false}
              pagingEnabled
              decelerationRate="fast"
              snapToAlignment="start"
              disableIntervalMomentum
              contentInsetAdjustmentBehavior="never"
              automaticallyAdjustContentInsets={false}
              contentInset={{ left: 0, right: 0, top: 0, bottom: 0 }}
              scrollIndicatorInsets={{ left: 0, right: 0, top: 0, bottom: 0 }}
              ListHeaderComponent={<View style={{ width: leftBreakout }} />}
              ListFooterComponent={<View style={{ width: rightBreakout }} />}
              contentContainerStyle={{}}
              snapToOffsets={carouselGroup.map((_, i) => leftBreakout + i * ITEM_WIDTH)}
              getItemLayout={(_, index) => ({ length: ITEM_WIDTH, offset: ITEM_WIDTH * index, index })}
              renderItem={({ item: entry, index: entryIndex }) => (
                <View style={[
                  styles.devoCarouselItem,
                  { width: ITEM_WIDTH + leftBreakout + rightBreakout, marginLeft: -leftBreakout }
                ]}>
                  <View style={styles.devoFullWidthCard}>
                    <PluginRenderer
                      plugin={entry.plugin}
                      selectedDate={entry.date}
                      refreshKey={refreshKey}
                      viewMode="inline"
                    />
                  </View>
                </View>
              )}
              style={{ width: ITEM_WIDTH + leftBreakout + rightBreakout }}
            />
          </View>

          {carouselGroup.length > 1 && (
            <View style={styles.paginationContainer}>
              {carouselGroup.map((_, dotIndex) => (
                <View key={dotIndex} style={[styles.paginationDot, dotIndex === 0 && styles.paginationDotActive]} />
              ))}
            </View>
          )}
        </View>
      );
    }

    // Non-devotional: render as a single static card (no horizontal carousel)
    const entry = firstEntry;
    return (
      <View style={styles.carouselItem}>
        <View style={styles.momentItem}>
          <View style={styles.momentContent}>
            <View style={styles.momentHeader}>
              <Text style={styles.momentDate}>{format(entry.date, 'h:mm a')}</Text>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{entry.category.toUpperCase()}</Text>
              </View>
            </View>
            <PluginRenderer
              plugin={entry.plugin}
              selectedDate={entry.date}
              refreshKey={refreshKey}
              viewMode="inline"
            />
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No moments found</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery
          ? `No entries match "${searchQuery}" in the selected date range`
          : 'No journal entries found for the selected date range'
        }
      </Text>
    </View>
  );

  // Filter sections to only show those with content
  const sectionsWithContent = React.useMemo(() => {
    return groupedSections.map(section => ({
      ...section,
      data: section.data.filter(carouselGroup => {
        // Filter out empty carousel groups
        if (!carouselGroup || carouselGroup.length === 0) return false;
        
        // Show all entries that have valid plugins - don't filter by specific plugin IDs
        return carouselGroup.some(entry => 
          entry && entry.plugin && entry.plugin.id && entry.plugin.title
        );
      })
    })).filter(section => section.data.length > 0);
  }, [groupedSections]);

  if (sectionsWithContent.length === 0) {
    return (
      <View style={[styles.container, style]}>
        {/* Always show header components (filters) even in empty state */}
        {headerComponents.length > 0 && (
          <View>
            {headerComponents.map((component, index) => (
              <View key={index}>{component}</View>
            ))}
          </View>
        )}
        {renderEmptyState()}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <SectionList
        sections={sectionsWithContent}
        renderItem={renderCarouselItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item, index) => `carousel-${index}-${item.length > 0 ? item[0].plugin.id : 'empty'}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={true}
        ListHeaderComponent={
          headerComponents.length > 0 ? (
            <View>
              {headerComponents.map((component, index) => (
                <View key={index}>{component}</View>
              ))}
            </View>
          ) : undefined
        }
        refreshControl={refreshControl}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.anchorBlue,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.hopeWhite,
    fontFamily: Fonts.semiBold,
  },
  sectionCount: {
    fontSize: 12,
    color: Colors.mediumGray,
    fontFamily: Fonts.regular,
  },
  momentItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  timelineIndicator: {
    alignItems: 'center',
    marginRight: 16,
    paddingTop: 8,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.alertCoral,
    marginBottom: 8,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: 40,
  },
  momentContent: {
    flex: 1,
  },
  momentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  momentDate: {
    fontSize: 12,
    color: Colors.mediumGray,
    fontFamily: Fonts.regular,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    borderRadius: 10,
  },
  categoryText: {
    fontSize: 10,
    color: Colors.alertCoral,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.hopeWhite,
    fontFamily: Fonts.semiBold,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.mediumGray,
    textAlign: 'center',
    fontFamily: Fonts.regular,
  },
  carouselContainer: {
    marginBottom: 16,
  },
  carousel: {
    flexGrow: 0,
  },
  carouselContent: {
    paddingHorizontal: 8,
  },
  carouselItem: {
    width: screenWidth - 32,
    marginHorizontal: 8,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: Colors.alertCoral,
  },
  // Devotional-specific carousel styling (center-snap like onboarding)
  devoCarouselContent: {
    paddingVertical: 0,
  },
  devoCarouselItem: {
    marginVertical: 0,
    marginHorizontal: 0,
    paddingHorizontal: 0,
    alignSelf: 'stretch',
  },
  devoFullWidthCard: {
    width: '100%',
    flex: 1,
    paddingHorizontal: 0,
  },
  devoHeaderContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  devoEdgeToEdge: {
    // Break out of the header padding so the FlatList can render full-bleed
    marginHorizontal: -16,
    alignSelf: 'stretch',
    overflow: 'visible',
  },

});
