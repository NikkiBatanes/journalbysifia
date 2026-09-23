import {clearReviewQAData,getActiveReviewQAContext,getReviewQAEligibilityOptions,loadReviewQAScenario} from '../reviewQALoader';
import {getReviewCapture} from '../../../services/reviewCaptureService';
import {getLocalReviewForPeriod} from '../../../storage/reviewStorage';
import {GUIDED_PROMPTS} from '../../../components/journal/reflectionConstants';
import {REFLECTION_NOTE_TYPES, parseGuidedReflection} from '../../../types/guidedReflection';
import {buildWeeklyReviewQAPrayerFixtures} from '../reviewQAWeeklyPrayerData';

const mockData=new Map<string,string>();
jest.mock('@react-native-async-storage/async-storage',()=>({getItem:jest.fn(async(key:string)=>mockData.get(key)??null),setItem:jest.fn(async(key:string,value:string)=>{mockData.set(key,value);}),getAllKeys:jest.fn(async()=>[...mockData.keys()]),multiGet:jest.fn(async(keys:string[])=>keys.map(key=>[key,mockData.get(key)??null])),multiRemove:jest.fn(async(keys:string[])=>keys.forEach(key=>mockData.delete(key))),removeItem:jest.fn(async(key:string)=>mockData.delete(key))}));
jest.mock('../../../services/reviewCaptureService',()=>({getReviewCapture:jest.fn(async(start:string,end:string)=>({periodStart:start,periodEnd:end,items:[],summary:{sermon:0,prayer:0,reflection:0,scripture:0,journal:0,gratitude:0,win:0,morning:0,evening:0},prayerStats:{total:0,answered:0,pending:0}}))}));
jest.mock('../../../storage/reviewStorage',()=>({getLocalReviewForPeriod:jest.fn(async()=>null),deleteLocalReview:jest.fn(async()=>undefined)}));

describe('Review QA loader isolation',()=>{
  beforeEach(()=>{mockData.clear();jest.clearAllMocks();});
  it('loads canonical routine and direct Heart Journal data for the Monday-start Weekly period',async()=>{
    const result=await loadReviewQAScenario('weekly');
    expect(result.review).toBeNull();
    expect([...mockData.keys()].filter(key=>key.startsWith('journal_local_singleton:morning_check_in:'))).toHaveLength(7);
    expect([...mockData.keys()].filter(key=>key.startsWith('journal_local_singleton:todays_focus:'))).toHaveLength(7);
    expect([...mockData.keys()].filter(key=>key.startsWith('reflection_local:scripture:'))).toHaveLength(21);
    expect([...mockData.keys()].filter(key=>key.startsWith('journal_local:todo:'))).toHaveLength(21);
    expect([...mockData.keys()].filter(key=>key.startsWith('journal_local:gratitude:'))).toHaveLength(7);
    expect([...mockData.keys()].filter(key=>key.startsWith('journal_local_singleton:today_win:'))).toHaveLength(7);
    expect([...mockData.keys()].filter(key=>key.startsWith('journal_local_singleton:looking_forward:'))).toHaveLength(7);
    expect([...mockData.keys()].filter(key=>key.startsWith('reflection_local:free:'))).toHaveLength(17);
    expect([...mockData.keys()].filter(key=>key.startsWith('reflection_local:guided:'))).toHaveLength(14);
    expect([...mockData.keys()].filter(key=>key.startsWith('journal_local:todo:2026-09-14:'))).toHaveLength(7);
    expect([...mockData.keys()].filter(key=>key.startsWith('routine_state:morning:'))).toHaveLength(7);
    expect([...mockData.keys()].filter(key=>key.startsWith('prayer_local:'))).toHaveLength(buildWeeklyReviewQAPrayerFixtures().length);
    expect([...mockData.keys()].some(key=>key.startsWith('bible_study_session:dev-review-v2:weekly:prayer-v2:'))).toBe(true);
    expect([...mockData.keys()].filter(key=>key.startsWith('routine_state:evening:'))).toHaveLength(7);
    expect([...mockData.keys()].some(key=>key.startsWith('review_local:'))).toBe(false);
    expect(JSON.parse(mockData.get('dev-review-v2:manifest')!).datasetVersion).toBe('weekly-routines-heart-journal-prayer-v2-scripture-notes-v9');
    const monday=JSON.parse(mockData.get('journal_local_singleton:morning_check_in:2026-09-14')!);
    expect(JSON.parse(monday.content)).toMatchObject({feeling:'Hopeful',underneathIt:expect.any(String)});
    const mondayPsalm=JSON.parse(mockData.get('reflection_local:scripture:2026-09-14:dev-review-v2:weekly:morning-psalm:2026-09-14')!);
    expect(mondayPsalm).toMatchObject({title:'Psalm 1',content:'Righteous · Knows His people',metadata:{psalmNumber:1,selectedAttributes:['Righteous','Knows His people']}});
    const saturdayPsalm=JSON.parse(mockData.get('reflection_local:scripture:2026-09-19:dev-review-v2:weekly:morning-psalm:2026-09-19')!);
    expect(saturdayPsalm).toMatchObject({
      title:'Psalm 6',
      content:'Merciful · Patient with me when I am worn down',
      metadata:{
        psalmNumber:6,
        selectedAttributes:['Merciful'],
        customAttribute:'Patient with me when I am worn down',
      },
    });
    const sundayPsalm=JSON.parse(mockData.get('reflection_local:scripture:2026-09-20:dev-review-v2:weekly:morning-psalm:2026-09-20')!);
    expect(sundayPsalm).toMatchObject({title:'Psalm 7',metadata:{psalmNumber:7,selectedAttributes:['Refuge','Righteous Judge']}});
    const mondayGratitude=JSON.parse(mockData.get('journal_local:gratitude:2026-09-14:dev-review-v2:weekly:gratitude:2026-09-14')!);
    expect(JSON.parse(mondayGratitude.content).items).toHaveLength(7);
    const mondayProverb=JSON.parse(mockData.get('reflection_local:scripture:2026-09-14:dev-review-v2:weekly:evening-proverb:2026-09-14')!);
    expect(mondayProverb).toMatchObject({title:'Proverbs 1',metadata:{proverbNumber:1,proverbRead:true,selectedWisdomIds:['1-1']}});
    const fridayProverb=JSON.parse(mockData.get('reflection_local:scripture:2026-09-18:dev-review-v2:weekly:evening-proverb:2026-09-18')!);
    expect(fridayProverb).toMatchObject({title:'Proverbs 5',metadata:{proverbNumber:5,proverbRead:false}});
    const scriptureNotes=[...mockData.entries()]
      .filter(([key])=>key.includes(':weekly:scripture-note:'))
      .map(([,value])=>JSON.parse(value));
    expect(scriptureNotes).toHaveLength(7);
    expect(scriptureNotes.map(entry=>entry.selected_date)).toEqual([
      '2026-09-14','2026-09-15','2026-09-16','2026-09-17','2026-09-18','2026-09-19','2026-09-20',
    ]);
    expect(scriptureNotes.every(entry=>entry.type==='scripture'&&entry.source==='scripture_note')).toBe(true);
    const sundayRoutine=JSON.parse(mockData.get('routine_state:morning:2026-09-20')!);
    expect(sundayRoutine).toMatchObject({completed:true,completed_steps:['emotion','underneath','psalm','carry','todays_focus','todos']});
    const sundayEveningRoutine=JSON.parse(mockData.get('routine_state:evening:2026-09-20')!);
    expect(sundayEveningRoutine).toMatchObject({completed:true,completed_steps:['gratitude','win','proverbs','wisdom','looking_forward']});
    const heartJournalEntries=[...mockData.entries()]
      .filter(([key])=>key.startsWith('reflection_local:free:'))
      .map(([,value])=>JSON.parse(value));
    expect(new Set(heartJournalEntries.map(entry=>entry.metadata.journalClassification))).toEqual(new Set([
      'thoughts','notes','reflection','brain_dump','lesson','idea','letter',
    ]));
    expect(heartJournalEntries.filter(entry=>entry.metadata.journalClassification==='thoughts')).toHaveLength(5);
    expect(heartJournalEntries.filter(entry=>entry.metadata.journalClassification==='notes')).toHaveLength(3);
    expect(heartJournalEntries.every(entry=>entry.type==='free'&&entry.source==='freeform')).toBe(true);
    expect(heartJournalEntries.some(entry=>entry.type==='guided'||entry.source==='guided'||entry.source==='guided_prompt')).toBe(false);
    const structuredEntries=heartJournalEntries.filter(entry=>entry.metadata.journalBlocks?.length);
    expect(structuredEntries).toHaveLength(3);
    expect(new Set(structuredEntries.map(entry=>entry.metadata.journalClassification))).toEqual(new Set(['notes','thoughts','brain_dump']));
    expect(new Set(structuredEntries.flatMap(entry=>entry.metadata.journalBlocks.map((block:any)=>block.kind)))).toEqual(
      new Set(['text',...REFLECTION_NOTE_TYPES.filter(item=>item.kind!=='column').map(item=>item.kind)]),
    );
    expect(structuredEntries.flatMap(entry=>entry.metadata.journalBlocks).find((block:any)=>block.kind==='photo')?.uri).toBeTruthy();
    expect(structuredEntries.flatMap(entry=>entry.metadata.journalBlocks).find((block:any)=>block.kind==='voice')?.uri).toBeTruthy();
    const guidedEntries=[...mockData.entries()]
      .filter(([key])=>key.startsWith('reflection_local:guided:'))
      .map(([,value])=>JSON.parse(value));
    const chosenQuestionEntries=guidedEntries.filter(entry=>entry.metadata.guidedJourney===undefined);
    const structuredGuidedEntries=guidedEntries.filter(entry=>entry.metadata.guidedJourney!==undefined);
    expect(chosenQuestionEntries).toHaveLength(4);
    expect(chosenQuestionEntries.every(entry=>
      entry.type==='guided'
      &&entry.source==='guided'
      &&entry.title===entry.metadata.prompt
      &&GUIDED_PROMPTS.includes(entry.metadata.prompt)
      &&['With God','My Heart','Health','Rest & Rhythms'].includes(entry.metadata.questionTopic)
      &&typeof entry.content==='string'
      &&entry.content.length>0
      &&entry.metadata.guidedJourney===undefined
    )).toBe(true);
    expect(chosenQuestionEntries.some(entry=>entry.source==='guided_prompt')).toBe(false);
    expect(chosenQuestionEntries.map(entry=>entry.metadata.questionTopic)).toEqual([
      'With God','My Heart','Health','Rest & Rhythms',
    ]);
    expect(structuredGuidedEntries).toHaveLength(10);
    expect(structuredGuidedEntries.every(entry=>
      entry.id.startsWith('dev-review-v2:weekly:guided-reflection:')
      &&entry.type==='guided'
      &&entry.source==='guided'
      &&parseGuidedReflection(entry.content)?.pathId===entry.metadata.guidedJourney.pathId
      &&entry.metadata.journalBlocks.length===entry.metadata.guidedJourney.answers.flatMap((answer:any)=>answer.notes).length
    )).toBe(true);
    expect(new Set(structuredGuidedEntries.map(entry=>entry.metadata.guidedJourney.pathId))).toEqual(new Set([
      'mind-feels-full','something-bothering-me','decision-to-make',
    ]));
    expect(new Set(structuredGuidedEntries.flatMap(entry=>entry.metadata.journalBlocks.map((block:any)=>block.kind)))).toEqual(
      new Set(['text',...REFLECTION_NOTE_TYPES.map(item=>item.kind)]),
    );
    expect(getReviewCapture).toHaveBeenCalledWith('2026-09-14','2026-09-20','weekly');
  });
  it('exposes Weekly-only eligibility for the loaded Monday-start scenario',async()=>{
    await loadReviewQAScenario('weekly');
    const context=await getActiveReviewQAContext();
    expect(context).toEqual({scenarioId:'weekly',referenceDate:'2026-09-21',historyStart:'2026-09-14'});
    const options=getReviewQAEligibilityOptions(context!);
    expect(options.settingsOverride).toMatchObject({
      weekEndsOn:0,
      enabledCadences:{weekly:true,monthly:false,quarterly:false,year_end:false,begin_year:false},
    });
    expect(options.historyStartOverride).toBe('2026-09-14');
  });
  it('automatically purges a previously seeded QA manifest and its records',async()=>{
    mockData.set('dev-review-v2:manifest',JSON.stringify({keys:['journal_local:gratitude:2026-09-16:dev-review-v2:old'],protectedReviewIds:[],periods:[],scenarioId:'weekly',referenceDate:'2026-09-21',historyStart:'2026-01-02'}));
    mockData.set('journal_local:gratitude:2026-09-16:dev-review-v2:old','{"id":"dev-review-v2:old"}');
    await expect(getActiveReviewQAContext()).resolves.toBeNull();
    expect(mockData.has('journal_local:gratitude:2026-09-16:dev-review-v2:old')).toBe(false);
    expect(mockData.has('dev-review-v2:manifest')).toBe(false);
  });
  it('clears QA keys while preserving normal Journal, Prayer, Review, Bible, Gospel, and Prayer V2 data',async()=>{
    const protectedKeys=['journal_local:gratitude:2026-09-16:user','prayer_local:2026-09-16:user','review_local:weekly:user','bible_study_session:user','gospel:user','prayer_local:2026-09-16:dev-prayer-v2:fixture','routine_state:morning:2026-09-16','journal_local_singleton:morning_check_in:2026-09-16'];
    protectedKeys.forEach(key=>mockData.set(key,'{"id":"user"}'));
    await loadReviewQAScenario('weekly'); await clearReviewQAData();
    protectedKeys.forEach(key=>expect(mockData.has(key)).toBe(true));
    expect([...mockData.keys()].some(key=>key.includes('dev-review-v2:'))).toBe(false);
  });
  it('isolates and restores a saved Review without overwriting its content',async()=>{
    const saved={id:'real',type:'weekly',status:'draft',memorableItems:[{kind:'gratitude',id:'g',selectedDate:'2026-09-16'}],answers:{notice:'My real answer'},periodStart:'2026-09-14',periodEnd:'2026-09-20',createdAt:'original',updatedAt:'original'};
    mockData.set('review_local:weekly:real',JSON.stringify(saved));
    mockData.set('review_local_index:weekly',JSON.stringify(['real']));
    (getLocalReviewForPeriod as jest.Mock).mockResolvedValueOnce(saved);
    await expect(loadReviewQAScenario('weekly')).resolves.toMatchObject({review:null});
    const manifest=JSON.parse(mockData.get('dev-review-v2:manifest')!);
    expect(manifest.hiddenReviews).toEqual([saved]);
    await clearReviewQAData();
    expect(JSON.parse(mockData.get('review_local:weekly:real')!)).toEqual(saved);
  });
  it('temporarily hides an empty legacy draft so the ready QA card can render',async()=>{
    const empty={id:'empty',type:'weekly',status:'draft',memorableItems:[],answers:{},periodStart:'2026-09-14',periodEnd:'2026-09-20'};
    mockData.set('review_local:weekly:empty',JSON.stringify(empty));
    mockData.set('review_local_index:weekly',JSON.stringify(['empty']));
    (getLocalReviewForPeriod as jest.Mock).mockResolvedValueOnce(empty);
    await expect(loadReviewQAScenario('weekly')).resolves.toMatchObject({review:null});
    const {deleteLocalReview}=jest.requireMock('../../../storage/reviewStorage');
    expect(deleteLocalReview).toHaveBeenCalledWith('weekly','empty');
  });
});
