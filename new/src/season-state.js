import {SEASON,SEASON_QUESTS,SEASON_REWARDS} from '../data/season-pass.js';
export const SEASON_DAY=86400000;
const duration=SEASON.days*SEASON_DAY, maxXp=(SEASON.maxLevel-1)*SEASON.xpPerLevel;
const count=n=>Number.isSafeInteger(n)&&n>=0;
const validTime=n=>count(n)&&n<8e15;
const dayOf=t=>new Date(t).toISOString().slice(0,10);
const cap=q=>q.tiers[q.tiers.length-1].target;
const counts=()=>Object.fromEntries(SEASON_QUESTS.map(q=>[q.id,0]));
const lists=()=>Object.fromEntries(SEASON_QUESTS.map(q=>[q.id,[]]));
// 오늘의 임무 상태: progress(오늘 세어진 양, 마지막 단계 기준치에서 멈춤), claims(처음 받은 단계), again(프리미엄 다시받기한 단계)
const newDaily=t=>({day:dayOf(t),progress:counts(),claims:lists(),again:lists()});
export function newSeason(now=Date.now()){
  return {version:2,origin:now,index:1,startedAt:now,endsAt:now+duration,clock:now,xp:0,premium:false,daily:newDaily(now),claims:{free:[],premium:[]}};
}
export const seasonToken=s=>s.season.origin+':'+s.season.index;
export function syncSeason(s,now=Date.now()){
  s.season ||= newSeason(validTime(now)?now:Date.now());
  const p=s.season,t=Math.max(validTime(now)?now:Date.now(),p.clock);
  p.clock=t;
  let rolled=false;
  if(t>=p.endsAt){
    const index=Math.floor((t-p.origin)/duration)+1;
    s.season={...newSeason(p.origin+(index-1)*duration),origin:p.origin,index,clock:t};
    rolled=true;
  }
  // 하루가 바뀌면 오늘의 임무를 새로 시작한다(못 받은 완료 보상은 여기서 사라진다)
  if(!s.season.daily||s.season.daily.day!==dayOf(t))s.season.daily=newDaily(t);
  return rolled;
}
// 오늘의 임무 기록이 망가졌으면 그것만 새로 시작한다(시즌 XP·보상 수령은 건드리지 않는다)
function dailyValid(p){
  const d=p.daily;
  if(!d||typeof d.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d.day))return false;
  return SEASON_QUESTS.every(q=>{
    const n=d.progress?.[q.id],first=d.claims?.[q.id],again=d.again?.[q.id];
    if(!count(n)||n>cap(q)||!Array.isArray(first)||!Array.isArray(again))return false;
    const ok=list=>new Set(list).size===list.length&&list.every(i=>Number.isInteger(i)&&i>=0&&i<q.tiers.length);
    return ok(first)&&ok(again)&&first.every(i=>n>=q.tiers[i].target)&&again.every(i=>first.includes(i))&&(p.premium||again.length===0);
  });
}export function restoreSeason(s,now=Date.now()){
  const p=s.season;
  // 처음 버전(반복 도전)의 저장: 시즌 XP·보상·프리미엄은 그대로 두고 오늘의 임무만 새로 시작한다
  if(p&&p.version===1&&!p.daily){p.version=2;p.daily=newDaily(validTime(p.clock)?p.clock:now);delete p.progress;delete p.questClaims;}
  const valid=p?.version===2&&validTime(p.origin)&&count(p.index)&&p.index>=1&&validTime(p.startedAt)&&p.startedAt===p.origin+(p.index-1)*duration&&p.endsAt===p.startedAt+duration&&validTime(p.clock)&&p.clock>=p.startedAt&&count(p.xp)&&p.xp<=maxXp&&typeof p.premium==='boolean'
    &&['free','premium'].every(track=>Array.isArray(p.claims?.[track])&&new Set(p.claims[track]).size===p.claims[track].length&&p.claims[track].every(n=>Number.isInteger(n)&&n>=1&&n<=Math.min(SEASON.maxLevel,1+Math.floor(p.xp/SEASON.xpPerLevel))))
    &&(p.premium||p.claims.premium.length===0);
  if(!valid)s.season=newSeason(validTime(now)?now:Date.now());
  else if(!dailyValid(s.season))s.season.daily=newDaily(validTime(s.season.clock)?s.season.clock:now);
  syncSeason(s,now);
}
export function recordSeason(s,id,amount=1,now=Date.now()){
  syncSeason(s,now);
  const q=SEASON_QUESTS.find(q=>q.id===id);
  if(!q||!count(amount))return;
  // 오늘 기준치(마지막 단계)를 넘으면 더는 세지 않는다: 더 해도 오늘 임무는 늘지 않는다
  s.season.daily.progress[id]=Math.min(cap(q),s.season.daily.progress[id]+amount);
}export function seasonStatus(s,now=Date.now()){
  syncSeason(s,now);const p=s.season;
  const level=Math.min(SEASON.maxLevel,1+Math.floor(p.xp/SEASON.xpPerLevel));
  return {token:seasonToken(s),index:p.index,level,xp:level===SEASON.maxLevel?SEASON.xpPerLevel:p.xp%SEASON.xpPerLevel,maxed:level===SEASON.maxLevel,premium:p.premium,days:Math.ceil((p.endsAt-p.clock)/SEASON_DAY),remainingMs:p.endsAt-p.clock};
}
// 오늘의 임무 단계 상태: locked(진행 중) · ready(받기) · claimed(받음, 프리미엄이 아니면 다시받기는 잠김) · again(프리미엄 다시받기 가능) · done(둘 다 받음) · maxed(50레벨이라 받을 XP 없음)
function tierState(s,q,i,status){
  const d=s.season.daily;
  if(d.progress[q.id]<q.tiers[i].target)return 'locked';
  const first=d.claims[q.id].includes(i),again=d.again[q.id].includes(i);
  if(status.maxed)return first&&(again||!status.premium)?'done':'maxed';
  if(!first)return 'ready';
  if(!status.premium)return 'claimed';
  return again?'done':'again';
}
export function seasonQuests(s,now=Date.now()){
  const status=seasonStatus(s,now);
  return SEASON_QUESTS.map(q=>{
    const value=s.season.daily.progress[q.id],tiers=q.tiers.map((t,i)=>({index:i,target:t.target,xp:t.xp,state:tierState(s,q,i,status)}));
    return {...q,value,cap:cap(q),tiers,reached:value>=cap(q),claimable:tiers.filter(t=>t.state==='ready'||t.state==='again').length};
  });
}
// 오늘 요약: 달성한 단계 수 / 전체, 받을 수 있는 수, 오늘 임무를 모두 달성했는지, 다음 초기화까지 남은 시간(ms)
export function seasonDaily(s,now=Date.now()){
  const status=seasonStatus(s,now),quests=seasonQuests(s,now),t=s.season.clock;
  const total=quests.reduce((n,q)=>n+q.tiers.length,0),reached=quests.reduce((n,q)=>n+q.tiers.filter(x=>x.state!=='locked').length,0);
  const next=Math.floor(t/SEASON_DAY)*SEASON_DAY+SEASON_DAY;
  return {total,reached,claimable:quests.reduce((n,q)=>n+q.claimable,0),complete:reached===total,resetInMs:next-t,maxed:status.maxed};
}
export function claimSeasonQuest(s,id,tierIndex,token,now=Date.now()){
  if(token!==seasonToken(s))return 0;
  const q=seasonQuests(s,now).find(q=>q.id===id),t=q?.tiers[tierIndex];
  if(!t||(t.state!=='ready'&&t.state!=='again'))return 0;
  const xp=Math.min(maxXp-s.season.xp,t.xp);
  if(xp<=0)return 0;
  (t.state==='ready'?s.season.daily.claims:s.season.daily.again)[id].push(tierIndex);
  s.season.xp+=xp;return xp;
}export function seasonRewardState(s,track,level,now=Date.now()){
  const status=seasonStatus(s,now);
  if(!['free','premium'].includes(track)||!Number.isInteger(level)||!SEASON_REWARDS[level-1])return 'invalid';
  if(s.season.claims[track].includes(level))return 'claimed';
  if(status.level<level)return 'level-locked';
  if(track==='premium'&&!status.premium)return 'premium-locked';
  return 'ready';
}
// The grant callback must preflight capacity and either grant everything or return false.
export function claimSeasonReward(s,track,level,token,grant,now=Date.now()){
  if(seasonRewardState(s,track,level,now)!=='ready'||token!==seasonToken(s))return null;
  const reward=SEASON_REWARDS[level-1][track], result=grant(reward);
  if(!result)return null;
  s.season.claims[track].push(level);return {reward,result,level,track};
}
export function unlockSeasonPremium(s,token,now=Date.now()){
  syncSeason(s,now);
  if(token!==seasonToken(s)||s.season.premium)return false;
  s.season.premium=true;return true;
}
