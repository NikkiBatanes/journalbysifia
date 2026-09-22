import {getLocalJournalSingleton} from '../../storage/journalStorage';
import {getWeeklyCheckInFeelings} from '../weeklyFeelingService';

jest.mock('../../storage/journalStorage',()=>({getLocalJournalSingleton:jest.fn()}));

describe('weekly check-in feelings',()=>{
  beforeEach(()=>jest.resetAllMocks());

  it('collects canonical Morning feeling choices and orders them by frequency',async()=>{
    const byDate:Record<string,string>={
      '2026-12-28':'Hopeful',
      '2026-12-29':'Overwhelmed',
      '2026-12-30':'Hopeful',
      '2027-01-01':'Tired',
    };
    (getLocalJournalSingleton as jest.Mock).mockImplementation(async(_type:string,date:string)=>byDate[date]?{content:JSON.stringify({feeling:byDate[date]})}:null);
    await expect(getWeeklyCheckInFeelings('2026-12-28','2027-01-03')).resolves.toEqual([
      {name:'Hopeful',count:2,dates:['2026-12-28','2026-12-30']},
      {name:'Overwhelmed',count:1,dates:['2026-12-29']},
      {name:'Tired',count:1,dates:['2027-01-01']},
    ]);
    expect(getLocalJournalSingleton).toHaveBeenCalledTimes(7);
  });

  it('ignores missing, blank, and malformed check-ins',async()=>{
    (getLocalJournalSingleton as jest.Mock).mockResolvedValueOnce({content:'not-json'}).mockResolvedValueOnce({content:JSON.stringify({feeling:'  '})}).mockResolvedValue(null);
    await expect(getWeeklyCheckInFeelings('2026-12-28','2027-01-03')).resolves.toEqual([]);
  });
});
