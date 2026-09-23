import {FILTER_OPTIONS} from '../../components/moments/momentFilterOptions';
import {matchesMomentCategoryFilter, narrowRoutineMomentToFilters, narrowRoutineMomentToRemembered} from '../momentFilterService';
import type {MomentTimelineItem} from '../momentTimelineService';

describe('Moments category filters', () => {
  it('includes weekly Looking Forward under Looking Forward without treating it as an evening routine', () => {
    expect(matchesMomentCategoryFilter({kind: 'weekly_looking_forward', pluginId: 'weeklylookingforward'}, 'lookingForward')).toBe(true);
    expect(matchesMomentCategoryFilter({kind: 'weekly_looking_forward'}, 'eveningProverbs')).toBe(false);
  });
  it('offers every routine and journal category users need to find', () => {
    expect(FILTER_OPTIONS.map(option => option.key)).toEqual(expect.arrayContaining([
      'morningCheckIns', 'morningPsalms', 'todaysFocus', 'todos', 'gratitude',
      'todaysWin', 'eveningProverbs', 'lookingForward', 'reflectionJournals',
      'bibleStudy', 'scriptureNotes', 'sessionNotes', 'prayers', 'prayerRequests',
      'remembered',
    ]));
  });

  it('matches moments deliberately remembered in a review', () => {
    expect(matchesMomentCategoryFilter({isRemembered: true},'remembered')).toBe(true);
    expect(matchesMomentCategoryFilter({isRemembered: false},'remembered')).toBe(false);
  });

  it('finds canonical Morning and Evening sections inside routine moments', () => {
    const morning = {kind:'morning' as const,pluginId:'morning',sectionKinds:['check_in','psalm','focus','priorities'] as const};
    const evening = {kind:'evening' as const,pluginId:'evening',sectionKinds:['gratitude','win','proverbs','looking_forward'] as const};
    expect(matchesMomentCategoryFilter({...morning,sectionKinds:[...morning.sectionKinds]},'morningPsalms')).toBe(true);
    expect(matchesMomentCategoryFilter({...morning,sectionKinds:[...morning.sectionKinds]},'todos')).toBe(true);
    expect(matchesMomentCategoryFilter({...evening,sectionKinds:[...evening.sectionKinds]},'eveningProverbs')).toBe(true);
    expect(matchesMomentCategoryFilter({...evening,sectionKinds:[...evening.sectionKinds]},'lookingForward')).toBe(true);
  });

  it('keeps Heart Journal, Bible Study, Scripture Notes, and Session Notes distinct', () => {
    expect(matchesMomentCategoryFilter({kind:'reflection',pluginId:'reflection'},'reflectionJournals')).toBe(true);
    expect(matchesMomentCategoryFilter({kind:'bible_study',pluginId:'biblestudy'},'bibleStudy')).toBe(true);
    expect(matchesMomentCategoryFilter({kind:'scripture_note',pluginId:'scripturenote'},'scriptureNotes')).toBe(true);
    expect(matchesMomentCategoryFilter({kind:'sermon',pluginId:'sermon'},'sessionNotes')).toBe(true);
    expect(matchesMomentCategoryFilter({kind:'morning',pluginId:'morning',sectionKinds:['psalm']},'reflectionJournals')).toBe(false);
  });

  it('shows only the Psalm section when Morning Psalms is selected', () => {
    const item: MomentTimelineItem = {
      key:'morning:2026-09-14',kind:'morning',selectedDate:'2026-09-14',canonicalSource:'journal',
      canonicalIds:['check-in','psalm','focus'],savedAt:'2026-09-14T07:00:00.000Z',searchText:'morning hopeful psalm 1 work',
      preview:{title:'Morning',lines:['Hopeful','Righteous','Work'],sections:[
        {kind:'check_in',label:'Check-In',canonicalSource:'journal',canonicalIds:['check-in'],lines:['Hopeful']},
        {kind:'psalm',label:'Psalm 1',canonicalSource:'reflection',canonicalIds:['psalm'],lines:['Righteous']},
        {kind:'focus',label:'Set Focus',canonicalSource:'journal',canonicalIds:['focus'],lines:['Work']},
      ]},metadata:{sectionKinds:['check_in','psalm','focus']},
    };
    const narrowed=narrowRoutineMomentToFilters(item,['morningPsalms']);
    expect(narrowed.preview.sections?.map(section=>section.kind)).toEqual(['psalm']);
    expect(narrowed.canonicalIds).toEqual(['psalm']);
    expect(narrowed.preview.lines).toEqual(['Righteous']);
    expect(narrowed.searchText).not.toContain('hopeful');
    expect(narrowed.searchText).not.toContain('work');
  });

  it('shows only remembered sections inside an aggregated routine moment', () => {
    const item: MomentTimelineItem = {
      key:'evening:2026-09-14',kind:'evening',selectedDate:'2026-09-14',canonicalSource:'journal',
      canonicalIds:['gratitude','win'],savedAt:'2026-09-14T20:00:00.000Z',searchText:'evening grateful finished',
      preview:{title:'Evening',lines:['Grateful','Finished'],sections:[
        {kind:'gratitude',label:'Gratitude',canonicalSource:'journal',canonicalIds:['gratitude'],lines:['Grateful']},
        {kind:'win',label:'Win',canonicalSource:'journal',canonicalIds:['win'],lines:['Finished']},
      ]},metadata:{sectionKinds:['gratitude','win']},
    };
    const narrowed = narrowRoutineMomentToRemembered(item,['win']);
    expect(narrowed.preview.sections?.map(section => section.kind)).toEqual(['win']);
    expect(narrowed.canonicalIds).toEqual(['win']);
  });
});
