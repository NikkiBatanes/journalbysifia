import {eachDayOfInterval, format, parseISO} from 'date-fns';
import {getLocalJournalSingleton} from '../storage/journalStorage';
import {safeJsonParse} from '../utils/safeJsonParse';

export interface WeeklyCheckInFeeling {
  name:string;
  count:number;
  dates:string[];
}

/** Summarizes the canonical Morning "How are you feeling?" choices for a week. */
export const getWeeklyCheckInFeelings=async(periodStart:string,periodEnd:string):Promise<WeeklyCheckInFeeling[]>=>{
  const days=eachDayOfInterval({start:parseISO(periodStart),end:parseISO(periodEnd)});
  const entries=await Promise.all(days.map(async day=>{
    const date=format(day,'yyyy-MM-dd');
    const record=await getLocalJournalSingleton('morning_check_in',date);
    const content=record?safeJsonParse<Record<string,unknown>>(record.content,{fallback:{}}):{};
    const feeling=typeof content?.feeling==='string'?content.feeling.trim():'';
    return feeling?{date,feeling}:null;
  }));
  const grouped=new Map<string,WeeklyCheckInFeeling&{firstIndex:number}>();
  entries.forEach((entry,index)=>{
    if(!entry)return;
    const key=entry.feeling.toLocaleLowerCase();
    const existing=grouped.get(key);
    if(existing){existing.count+=1;existing.dates.push(entry.date);return;}
    grouped.set(key,{name:entry.feeling,count:1,dates:[entry.date],firstIndex:index});
  });
  return [...grouped.values()]
    .sort((a,b)=>b.count-a.count||a.firstIndex-b.firstIndex)
    .map(({firstIndex:_,...feeling})=>feeling);
};
