import {CONFIG as C, ORE_KINDS} from '../data/config.js';
import {DUNGEONS, mineHp, towerHp, towerRewards} from '../data/dungeons.js';

// 던전은 일반 광맥과 같은 결정 16개 무대다. 들어갈 때 원래 광맥(s.ores 등)을 d.stash에 맡기고 던전 결정으로 바꿔 끼우며,
// 끝나면 되돌린다. 그래서 채굴·스킬·햄찌 배치 로직은 일반 층과 똑같이 돌고, 일반 층수·임무는 건드리지 않는다.
export const newDungeonProgress = () => ({towerBest:0,mineBest:0,lastResult:null});
const integer = n => Number.isSafeInteger(n) && n >= 0;
const finite = n => Number.isFinite(n) && n >= 0;
const pay = (s,key,amount) => {const paid=Math.min(C.walletCap-s.wallet[key],Math.floor(amount));s.wallet[key]+=paid;return paid;};
const day = now => new Date(now).toISOString().slice(0,10);
const levelHp = (kind,level) => kind==='mine'?mineHp(level):towerHp(level);

// engine.js가 resetVein을 넘겨 준다(서로 불러오면 순환이 되므로). 맡긴 광맥이 망가졌을 때만 쓴다.
let resetVein = null;
export const setResetter = fn => {resetVein = fn;};

const mixKinds = Object.entries(DUNGEONS.tower.mix);
const mixTotal = mixKinds.reduce((n,[,w]) => n + w, 0);
function pickMix(rng) {
  let roll = Math.min(.999999, Math.max(0, rng())) * mixTotal;
  for (const [id,w] of mixKinds) if ((roll -= w) < 0) return id;
  return mixKinds[0][0];
}

// 던전 결정 16개를 새로 채운다: 광산은 다이아 결정, 광산탑은 결정마다 섞인 종류.
function fillStage(s,kind,level,rng) {
  const hp = levelHp(kind,level);
  s.ores = Array.from({length:C.oreCount},(_,id) => ({id,hp,maxHp:hp,kind:kind==='mine'?'diamond':pickMix(rng)}));
  s.unitFocus = [];s.unitTargets = [];s.unitWaiting = [];
}

const validStash = st => !!st && Array.isArray(st.ores) && st.ores.length===C.oreCount
  && st.ores.every((o,i) => o && o.id===i && Number.isFinite(o.hp) && Number.isFinite(o.maxHp) && o.maxHp>0 && o.hp>=0 && o.hp<=o.maxHp)
  && ORE_KINDS.some(k => k.id===st.floorKind) && finite(st.floorElapsed);

// 맡겨 둔 일반 광맥을 되돌린다. 맡긴 것이 없거나 망가졌으면 일반 광맥을 새로 만든다.
function leaveStage(s,d) {
  const st = d?.stash;
  if (validStash(st)) {
    s.ores = st.ores;
    for (const o of s.ores) o.kind = st.floorKind;
    s.floorKind = st.floorKind;
    s.floorElapsed = st.floorElapsed;
  }
  else resetVein?.(s);
  s.unitFocus = [];s.unitTargets = [];s.unitWaiting = [];s.unitClocks = [];
}

// 지금 던전 결정들의 남은 체력 합과 최대 체력 합(진행 막대용)
export function dungeonLife(s) {
  return {hp:s.ores.reduce((n,o) => n + o.hp,0),max:s.ores.reduce((n,o) => n + o.maxHp,0)};
}

export function restoreDungeons(s) {
  const p=s.dungeonProgress;
  s.dungeonProgress={towerBest:integer(p?.towerBest)?Math.min(p.towerBest,Number.MAX_SAFE_INTEGER-2):0,mineBest:integer(p?.mineBest)?Math.min(p.mineBest,C.walletCap):0,lastResult:null};
  // 완료 화면도 재접속 후 다시 볼 수 있다. 보상은 지급 시 이미 지갑에 들어가므로 다시 지급하지 않는다.
  const r=p?.lastResult;
  if(r && ['mine','tower'].includes(r.kind) && ['complete','leave','away'].includes(r.reason) && integer(r.floor) && integer(r.diamond) && integer(r.ruby) && integer(r.rocks) && finite(r.elapsed))
    s.dungeonProgress.lastResult={kind:r.kind,reason:r.reason,floor:r.floor,cleared:integer(r.cleared)?r.cleared:0,diamond:Math.min(r.diamond,C.walletCap),ruby:Math.min(r.ruby,C.walletCap),rocks:r.rocks,elapsed:r.elapsed};
  const d=s.dungeon;
  if(!d)return;
  // 이전 판(20초 보석 던전·결정 하나짜리 던전)은 광맥을 바꿔 끼우지 않았으므로 종료만 시킨다. 이미 사용한 당일 입장권은 유지한다.
  const bad = () => {
    s.dungeon=null;
    if (d.stash!==undefined) leaveStage(s,d);
  };
  if(!['mine','tower'].includes(d.kind) || !integer(d.level) || d.level<1 || !finite(d.elapsed) || !finite(d.startedAt) || !integer(d.earned) || d.earned>C.walletCap
    || !integer(d.ruby) || d.ruby>C.walletCap || !integer(d.rocks) || !integer(d.cleared) || !validStash(d.stash)
    || (d.kind==='tower' && d.level!==s.dungeonProgress.towerBest+1)) return bad();
  const hp=levelHp(d.kind,d.level);
  if(s.ores.some(o => o.maxHp!==hp)) return bad();
  s.dungeon={kind:d.kind,level:d.level,elapsed:d.elapsed,startedAt:d.startedAt,earned:d.earned,ruby:d.ruby,rocks:d.rocks,cleared:d.cleared,stash:d.stash};
}

export function dungeonStatus(s,now=Date.now()) {
  const p=s.dungeonProgress || newDungeonProgress();
  const used=day(now)>s.daily.day?0:s.daily.dungeons;
  const floor=p.towerBest+1;
  return {remaining:Math.max(0,DUNGEONS.mine.entries-used),best:p.towerBest,floor,mineBest:p.mineBest,rewards:towerRewards(floor),result:p.lastResult};
}

export function beginDungeon(s,kind,now=Date.now(),rng=Math.random) {
  if(!['mine','tower'].includes(kind) || s.dungeon || s.draft || s.rubyStage)return false;
  s.dungeonProgress ||= newDungeonProgress();
  if(kind==='mine'){
    if(!dungeonStatus(s,now).remaining)return false;
    s.daily.dungeons++;
  }
  const level=kind==='tower'?s.dungeonProgress.towerBest+1:1;
  s.dungeon={kind,level,elapsed:0,startedAt:now,earned:0,ruby:0,rocks:0,cleared:0,stash:{ores:s.ores,floorKind:s.floorKind,floorElapsed:s.floorElapsed}};
  fillStage(s,kind,level,rng);
  s.dungeonProgress.lastResult=null;
  s.unitClocks=[];
  s.autoMine=true;
  return true;
}

export function finishDungeon(s,reason='complete') {
  const d=s.dungeon;if(!d)return null;
  const p=s.dungeonProgress;
  // floor: 광산탑은 이번 도전에서 돌파한 가장 높은 층(없으면 0), 광산은 도달한 회차
  const result={kind:d.kind,reason,floor:d.kind==='tower'?(d.cleared?d.level-1:0):d.level,cleared:d.cleared,diamond:d.earned,ruby:d.ruby,rocks:d.rocks,elapsed:d.elapsed};
  if(d.kind==='mine')p.mineBest=Math.max(p.mineBest,d.earned);
  p.lastResult=result;
  leaveStage(s,d);
  s.dungeon=null;
  return {type:'dungeonEnd',...result};
}

export function advanceDungeon(s,dt,now=Date.now()) {
  const d=s.dungeon;if(!d)return null;
  d.elapsed=Math.max(d.elapsed+dt,(now-d.startedAt)/1000);
  if(d.kind==='mine' && d.elapsed>=DUNGEONS.mine.seconds){d.elapsed=DUNGEONS.mine.seconds;return finishDungeon(s);}
  return null;
}

// 결정 하나가 깨졌다. 광산은 다이아를 바로 지급한다(지갑 상한까지). 돌려주는 값은 실제 지급량.
export function breakDungeonOre(s) {
  const d=s.dungeon;if(!d)return 0;
  d.rocks=Math.min(Number.MAX_SAFE_INTEGER,d.rocks+1);
  if(d.kind!=='mine')return 0;
  const paid=pay(s,'diamond',DUNGEONS.mine.diamondsPerRock);
  d.earned+=paid;
  return paid;
}

// 결정 16개를 다 깼다. 광산은 더 단단하게 다시 솟고, 광산탑은 보상을 주고 다음 층으로 올라간다(층마다 한 번만 지급).
export function clearDungeonStage(s,rng=Math.random) {
  const d=s.dungeon;if(!d)return [];
  if(d.kind==='mine'){
    d.level++;
    fillStage(s,'mine',d.level,rng);
    return [{type:'dungeonRefill',kind:'mine',level:d.level}];
  }
  const floor=d.level,rewards=towerRewards(floor),p=s.dungeonProgress;
  const diamond=pay(s,'diamond',rewards.diamond),ruby=pay(s,'ruby',rewards.ruby);
  d.earned+=diamond;d.ruby+=ruby;d.cleared++;
  p.towerBest=Math.max(p.towerBest,floor);
  d.level=floor+1;
  fillStage(s,'tower',d.level,rng);
  return [{type:'towerFloor',kind:'tower',floor,diamond,ruby}];
}
