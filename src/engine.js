import * as M from './mastery-state.js';
import {SHOP} from '../data/shop.js';
import * as P from './pass-state.js';
import * as SP from './season-state.js';
import * as D from './dungeon-state.js';
export {dungeonStatus, dungeonLife} from './dungeon-state.js';
export {seasonStatus,seasonQuests,seasonDaily,seasonRewardState,claimSeasonQuest,unlockSeasonPremium,syncSeason} from './season-state.js';
export {passStatus, hasAdFree, hasAutoUpgrade, syncPasses, toggleAutoUpgrade} from './pass-state.js';
import {MASTERY_RULES,UNLOCK_SKILLS} from '../data/mastery.js';
import {TUTORIAL} from '../data/tutorial.js';
import { CONFIG as C, TIERS, TIER_POWER, DRAW_WEIGHTS, ENHANCE, SKILLS, MASTERY, HAMSTERS, CREW_PER_TEAM, DAILY_REWARDS, ORE_POSITIONS, MINER_HOME, TEAM_HOMES, ORE_KINDS } from '../data/config.js';
import { CRYSTAL_BASES } from './scene-config.js';
import { exposed, standPoints, HAMSTER_WALK } from './vein-geometry.js';
export const dayKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
const clamp = (x, min, max) => Math.min(max, Math.max(min, x));
const finite = x => typeof x === 'number' && Number.isFinite(x);

const finishedTutorial = () => ({ done: true, step: 0, tips: [...TUTORIAL.tips], rb: -1 });
export function createState(now = Date.now(), demo = true) {
  const s = { version: C.version, wallet: { stone: demo ? 12800 : 0, ruby: demo ? 420 : 0, diamond: demo ? 860 : 0 }, floor: demo ? 12 : 1, runMax: demo ? 12 : 1, lifetimeMax: demo ? 12 : 1,
    skills: demo ? [{ id: 'chain', level: 4 }, { id: 'fast', level: 2 }, { id: 'amplify', level: 3 }] : [], draft: demo ? null : { step: 0, offers: ['chain', 'blast', 'focus'], rerolls:0 },
    inventory: [{ id: 1, tier: 0 }, { id: 2, tier: 0 }, { id: 3, tier: 0 }, { id: 4, tier: 0 }, { id: 5, tier: 1 }, { id: 6, tier: 1 }, { id: 7, tier: 2 }], gear: { miner: demo ? 5 : 1 }, nextItemId: 8,
    mastery: [], masteryBook:M.newMasteryBook(), hamsters: { miner: 1 }, crew: ['miner'], autoUpgrade: false, autoMine: true, rebirths: 0, totalMined: 0, missionClaims: [],
    purchases: {}, daily: { day: dayKey(now), free: 0, ads: 0, dungeons: 0, claimed: false, shopGift: false }, loginCount: 0, dungeon: null, rubyStage: null, ores: [], unitClocks: [], unitFocus: [], unitTargets: [], unitSpots: [], unitWaiting: [], lastSeen: now, settings: { motion: true, sfx: true, bgm: true, haptic: true }, seededDemo: demo };
  s.passes = P.newPassState(now);
  s.season = SP.newSeason(now);
  s.dungeonProgress = D.newDungeonProgress();
  // 튜토리얼 진행: step=지금 단계, tips=이미 본 상황별 안내, rb=환생 안내(2부) 진행: 0 시작 전, 1 이상 진행 중인 단계, -1 끝남. 예시 저장은 이미 끝난 것으로 둔다.
  s.tutorial = demo ? finishedTutorial() : { done: false, step: 0, tips: [], rb: 0 };
  if (!demo) {
    s.inventory = s.inventory.slice(0, 1);
    s.nextItemId = 2;
  }
  resetVein(s, () => 0);   // 시작 광맥은 항상 돌 층(예시 화면·첫 층이 매번 같게)
  return s;
}

export function refreshDay(s, now = Date.now()) {
  if (dayKey(now) > s.daily.day)
    s.daily = { day: dayKey(now), free: 0, ads: 0, dungeons: 0, claimed: false, shopGift: false };
}

export function claimShopGift(s, now = Date.now()) {
  refreshDay(s, now);
  if (s.daily.shopGift) return 0;
  const amount = Math.min(SHOP.dailyDiamonds, Math.max(0, C.walletCap - s.wallet.diamond));
  if (!amount) return 0;
  s.daily.shopGift = true;
  s.wallet.diamond += amount;
  return amount;
}

export const shopProduct = id => [SHOP.bundle, ...SHOP.passes, ...SHOP.packs].find(x => x.id === id) || null;

// 테스트 구매: 현금 결제는 연결되어 있지 않아서 돈은 오가지 않고 상품 내용만 지급한다(출시 전 검증된 결제로 교체).
// 초보 꾸러미는 계정당 한 번만 살 수 있다. 곡괭이가 들어가는 상품은 장비함 자리가 모자라면 거부한다.
export function buyShopProduct(s, id, now = Date.now()) {
  const p = shopProduct(id);
  if (p?.kind === 'pass') return P.buyPass(s, id, now);
  if (!p || (p.once && s.purchases?.[p.id]) || (p.pickaxes && s.inventory.length + p.pickaxes > 200))
    return null;
  addCurrency(s, 'diamond', p.diamonds);
  const items = Array.from({ length: p.pickaxes || 0 }, () => {
    const item = { id: s.nextItemId++, tier: p.pickaxeTier ?? 0 };
    s.inventory.push(item);
    return item;
  });
  if (p.once) {
    s.purchases ||= {};
    s.purchases[p.id] = true;
  }
  return { product: p, diamonds: p.diamonds, items };
}

export function level(s, id) {
  return s.skills.find(v => v.id === id)?.level || 0;
}

export function bonus(s, type) {
  return M.masteryBonus(s,type);
}

export function stats(s) {
  // 곡괭이의 힘은 여기 없다: 햄찌마다 자기 곡괭이를 들고 있어서 팀 배율(teamPower)에 들어간다.
  return { damage: C.baseDamage * (1 + bonus(s, 'damage')) * (1 + .07 * level(s, 'power')), interval: Math.max(MASTERY_RULES.minInterval,C.baseInterval / (1 + bonus(s, 'speed') + .06 * level(s, 'fast'))),
    crit: clamp(.05 + bonus(s, 'crit') + .01 * level(s, 'critical'), 0, .75), critDamage:2+bonus(s,'critDamage')+.06*level(s,'keen'), stone: 1 + bonus(s, 'stones') + .05 * level(s, 'lucky') + .06*level(s,'prospector'), offline: clamp(C.offlineEfficiency + bonus(s, 'offline'), 0, 1) };
}

export function oreHp(floor) {
  return Math.round(C.floorHpBase * C.floorHpGrowth ** (floor - 1));
}

// 광맥 층 종류별 돌 획득량. kind를 생략하면 기본(돌) 값이다.
export const oreKind = id => ORE_KINDS.find(k => k.id === id) || ORE_KINDS[0];
export function stoneReward(s, kind = 'stone') {
  return Math.floor(C.floorStoneBase * C.floorStoneGrowth ** (s.floor - 1) * stats(s).stone * oreKind(kind).stone);
}
// 층 종류를 섞은 평균 배율. 오프라인 보상이 온라인 평균과 어긋나지 않게 쓴다.
export const ORE_AVG_STONE = ORE_KINDS.reduce((n, k) => n + k.weight * k.stone, 0) / ORE_KINDS.reduce((n, k) => n + k.weight, 0);
// 루비 층을 모두 깼을 때 주는 루비: 환생 루비 공식(지금 최고층, 10층 미만은 10층 기준) × rubyRate, 최소 1.
export function rubyFloorReward(s) {
  const base = Math.floor(C.rubyPerFloor * Math.max(s.runMax, C.rebirthMinFloor) * (1 + bonus(s, 'ruby')));
  return Math.max(1, Math.round(base * oreKind('ruby').rubyRate));
}
export function rollOreKind(rng = Math.random) {
  const total = ORE_KINDS.reduce((n, k) => n + k.weight, 0);
  let roll = clamp(rng(), 0, 1 - Number.EPSILON) * total;
  for (const k of ORE_KINDS) {
    if (roll < k.weight)
      return k.id;
    roll -= k.weight;
  }
  return ORE_KINDS[0].id;
}

// 층의 종류를 새로 정하고(새 층·시간 초과 재도전·환생 모두 다시 굴림) 결정 16개를 전부 그 종류로 채운다.
export function resetVein(s, rng = Math.random) {
  const kind = rollOreKind(rng);
  s.floorKind = kind;
  s.ores = Array.from({ length: C.oreCount }, (_, id) => ({ id, hp: oreHp(s.floor), maxHp: oreHp(s.floor), kind }));
  s.floorElapsed = 0;
  s.unitFocus = [];
  s.unitTargets = [];
  s.unitWaiting = [];
}
D.setResetter(resetVein);

// 햄찌 한 마리 = 유닛 하나. 유닛 u는 팀 floor(u/3)에 속하고 팀 배율로 친다.
// 각자 공격 간격 × CREW_PER_TEAM마다 한 번 치므로 팀 3마리의 합은 예전 팀 한 번 치기와 같다.
export const unitTeam = u => Math.floor(u / CREW_PER_TEAM);
const unitPeriod = s => stats(s).interval * CREW_PER_TEAM;
const PHI = .6180339887;
const VEIN_CENTER = [500, 710];
// 유닛마다 광맥을 둘러싼 선호 방향이 있다(광맥을 한 바퀴). 같은 방향을 고르지 않게 황금비로 고르게 흩는다.
function unitHome(u) {
  const a = Math.PI * 2 * ((u * PHI + .13) % 1);
  return [VEIN_CENTER[0] + Math.cos(a) * 340, VEIN_CENTER[1] + Math.sin(a) * 230];
}
// 안쪽 둘레가 찼을 때 물러나는 바깥 둘레 간격(px)
const OUTER_RINGS = [0, 50, 100, 150];

// 저장하지 않는 임시 값(대기 햄찌가 마지막으로 자리를 찾은 시각 칸)
const probes = new WeakMap();
const probeClock = s => probes.get(s) || (probes.set(s, []), probes.get(s));

function needsTarget(s, u) {
  const t = s.unitTargets[u];
  return t == null || !(s.ores[t]?.hp > 0) || !exposed(s, t);
}

// 새 목표: 햄찌가 실제로 서서 칠 수 있는(보이는 쪽) 결정 중, 지금 서 있는 자리에서 가깝고 자기 방향이며 덜 몰린 곳.
// 설 자리(s.unitSpots[u])까지 엔진이 정해 화면은 그 자리로 걸어가기만 한다. 그래야 걸어가는 시간 추정이 실제와 맞는다.
// 돌아오는 값은 지금 자리에서 새 자리까지 걸어가는 시간(초) 추정.
export function retarget(s, u) {
  const living = s.ores.filter(o => o.hp > 0);
  if (!living.length)
    return 0;
  let options = living.filter(o => exposed(s, o.id));
  if (!options.length)
    options = living;
  const known = s.unitSpots[u], home = unitHome(u), from = known || home;
  const crowd = id => s.unitTargets.reduce((n, t, i) => n + (i !== u && t === id ? 1 : 0), 0);
  // 다른 햄찌가 이미 서 있는 자리(또는 그 목표 자리)와 너무 가까우면 못 쓴다
  const taken = p => s.unitSpots.some((q, i) => i !== u && q && s.unitTargets[i] != null && Math.hypot(q[0] - p[0], (q[1] - p[1]) * 1.4) < 46);
  const freeSpots = id => OUTER_RINGS.flatMap(extra => standPoints(s, id, extra).filter(p => !taken(p)));
  // 자리가 남은 결정을 먼저 고른다: 자리가 없는 결정에 햄찌를 더 보내면 서 있을 곳이 없어 걷기만 한다.
  const score = o => {
    const b = CRYSTAL_BASES[o.id];
    return Math.hypot(b[0] - home[0], b[1] - home[1]) * .5 + Math.hypot(b[0] - from[0], b[1] - from[1]) * .5 + 160 * crowd(o.id) + (freeSpots(o.id).length ? 0 : 600);
  };
  const best = options.reduce((a, o) => score(o) < score(a) ? o : a);
  s.unitTargets[u] = best.id;
  // 그 결정 둘레에서 비어 있는 자리 중 자기 방향(home)에 가깝고 걸어가기도 가까운 자리. 그래야 햄찌들이 한쪽에 몰리지 않고 둘러선다.
  // 안쪽 둘레가 차면 한 바퀴 바깥에서 서서 친다(기다리지 않는다).
  const cost = p => Math.hypot(p[0] - from[0], p[1] - from[1]) * .45 + Math.hypot(p[0] - home[0], p[1] - home[1]) * .55;
  const nearest = list => list.reduce((a, p) => cost(p) < cost(a) ? p : a);
  let spot;
  for (const extra of OUTER_RINGS) {
    const free = standPoints(s, best.id, extra).filter(p => !taken(p));
    if (free.length) {
      spot = nearest(free);
      break;
    }
  }
  if (!spot) {
    // 모든 둘레가 찼으면(결정이 거의 없고 햄찌가 아주 많을 때) 겹쳐 서더라도 가장 가까운 자리에서 친다
    const any = standPoints(s, best.id, OUTER_RINGS[1]);
    const [bx, by] = CRYSTAL_BASES[best.id];
    spot = any.length ? nearest(any) : [bx + (from[0] < bx ? -130 : 130), by + 60];
  }
  s.unitWaiting[u] = false;
  s.unitSpots[u] = [Math.round(spot[0]), Math.round(spot[1])];
  // 화면의 햄찌가 도착한 뒤에 치도록 넉넉히 잡는다: 가장 느린 걸음, 돌아가는 길(×1.5), 가감속·비켜 가기(+0.35초),
  // 직전 타격의 회복 자세(0.45초)가 끝난 뒤 출발. 처음 자리를 정할 때는 실제 위치를 모르므로 최소 1초.
  const walk = Math.hypot(spot[0] - from[0], spot[1] - from[1]) * 1.5 / HAMSTER_WALK.min + .35 + .45;
  return Math.min(3.5, known ? walk : Math.max(1, walk));
}

// 햄찌가 들고 있는 곡괭이(없으면 null). 곡괭이는 햄찌 종류마다 한 자루씩 따로 든다(s.gear = { 햄찌 id: 곡괭이 id }).
export function gearOf(s, hamsterId) {
  const id = s.gear?.[hamsterId];
  return id == null ? null : s.inventory.find(x => x.id === id) || null;
}
// 곡괭이 한 자루의 피해 배율: 등급 배율 × 강화(+12%씩). 곡괭이가 없으면 맨손 D급(1배).
export const pickPower = item => TIER_POWER[item?.tier || 0] * (1 + ENHANCE.bonus * (item?.enh || 0));

// 팀 k(장착 순서)의 피해 배율 = 햄찌 종류·레벨 배율 × 그 햄찌가 든 곡괭이 배율.
// 광부 햄찌 Lv.1이 D급 곡괭이를 들면 1이라 예전 한 마리 채굴과 같다.
export function teamPower(s, k) {
  const h = HAMSTERS.find(x => x.id === s.crew[k]);
  return h ? h.power * (1 + C.hamsterLevelPower * ((s.hamsters[h.id] || 1) - 1)) * pickPower(gearOf(s, h.id)) : 0;
}

export function totalPower(s) {
  return s.crew.reduce((n, _, k) => n + teamPower(s, k), 0);
}

export function addCurrency(s, key, amount) {
  if (!['stone', 'ruby', 'diamond'].includes(key) || !finite(amount) || amount < 0)
    throw Error('Invalid reward');
  s.wallet[key] = Math.min(C.walletCap, s.wallet[key] + Math.floor(amount));
}

export function upgradeCost(skill, s = null) {
  const base = { chain: 50, fast: 60, amplify: 85 }[skill.id] || C.upgradeBase;
  const full=10 * Math.floor(base * C.upgradeGrowth ** (skill.level - 1) / 10);
  return Math.max(10,Math.floor(full*(1-Math.min(.35,s?.skills ? .01*level(s,'thrift'):0))));
}

export function upgradeSkill(s, id) {
  const a = s.skills.find(x => x.id === id);
  if (!a || a.level >= C.maxSkillLevel)
    return false;
  const cost = upgradeCost(a,s);
  if (s.wallet.stone < cost)
    return false;
  s.wallet.stone -= cost;
  a.level++;
  return true;
}

export function draftPool(s) {
  const role=s.skills.length?'support':'core';
  return SKILLS.filter(k=>k.role===role&&!s.skills.some(v=>v.id===k.id)&&(!UNLOCK_SKILLS.some(u=>u.id===k.id)||s.masteryBook.active.includes(k.id))).map(k=>k.id);
}
export function draftOffers(s,rng=Math.random,avoid=[]) {
  const pool=draftPool(s), fresh=pool.filter(id=>!avoid.includes(id)), old=pool.filter(id=>avoid.includes(id)), chosen=[];
  for(const group of [fresh,old])while(group.length&&chosen.length<3){const i=Math.max(0,Math.min(group.length-1,Math.floor(rng()*group.length)));chosen.push(group.splice(i,1)[0]);}
  return chosen;
}
export function rerollDraft(s,rng=Math.random){
  if(!s.draft||s.draft.rerolls>=MASTERY_RULES.rerolls||draftPool(s).length<=3)return false;
  s.draft.offers=draftOffers(s,rng,s.draft.offers);s.draft.rerolls++;return true;
}
export function chooseSkill(s,id,rng=Math.random){
  if(!s.draft||!s.draft.offers.includes(id)||!draftPool(s).includes(id))return false;
  s.skills.push({id,level:1});
  s.draft=s.skills.length===3?null:{step:s.skills.length,offers:draftOffers(s,rng),rerolls:0};
  return true;
}

// 남은 광석을 햄찌 진입 지점에서 가까운 순으로. 첫 번째가 다음 타격 대상이고 화면도 같은 순서를 쓴다.
// team을 주면 그 팀의 진입 방향(TEAM_HOMES) 기준으로 정렬한다.
export function miningOrder(s, team = 0) {
  const home = TEAM_HOMES[team] || MINER_HOME;
  const d = o => (ORE_POSITIONS[o.id][0] - home[0]) ** 2 + (ORE_POSITIONS[o.id][1] - home[1]) ** 2;
  return s.ores.filter(x => x.hp > 0).sort((a, b) => d(a) - d(b));
}

// 햄찌 한 마리(유닛 u)의 타격 한 번. 자기 목표 결정을 치고, 목표가 없거나 깨졌으면 새로 고른다.
// 연쇄·폭발·집중 스킬은 모든 햄찌 타격에 적용되고, 피해는 그 햄찌 팀의 배율을 따른다.
export function attack(s, rng = Math.random, unit = 0, now = Date.now()) {
  if ((s.draft && !s.rubyStage) || !s.autoMine)
    return [];
  const team = unitTeam(unit);
  const st = stats(s);
  const crit = rng() < st.crit;
  let damage = st.damage * teamPower(s, team) * (crit ? st.critDamage : 1);
  const events = [];
  if (s.rubyStage) {
    const r = s.rubyStage;
    r.hp = Math.max(0, r.hp - damage);
    events.push({ type: 'hit', id: 0, damage: Math.round(damage), crit, dungeon: true, team, unit });
    if (r.hp === 0)
      events.push(endRubyStage(s));
    return events;
  }
  // 던전은 일반 광맥과 같은 결정 무대(s.ores가 던전 결정으로 바뀌어 있다). 시간이 다 됐으면 이번 타격은 무효.
  if (s.dungeon) {
    const ended=D.advanceDungeon(s,0,now);
    if(ended)return [ended];
  }
  const living = s.ores.filter(o => o.hp > 0);
  if (!living.length) {
    resetVein(s, rng);
    return events;
  }
  if (needsTarget(s, unit))
    retarget(s, unit);
  const target = s.ores[s.unitTargets[unit]];
  if(level(s,'execution')&&target.hp/target.maxHp<=.3)damage*=1+.05*level(s,'execution');
  const echo=1+.06*level(s,'echo');
  const focus = s.unitFocus[unit] ||= { target: -1, stacks: 0 };
  if (focus.target === target.id)
    focus.stacks = Math.min(5, focus.stacks + 1);
  else {
    focus.target = target.id;
    focus.stacks = 1;
  }
  if (level(s, 'focus'))
    damage *= 1 + focus.stacks * (.05 + .01 * level(s, 'focus'));
  const queue = [{ ore: target, damage, canBlast: true, crit }], dead = new Set();
  if (level(s, 'chain')) {
    const chainDamage = damage * (.3 + .05 * level(s, 'chain')) * (1 + .08 * level(s, 'amplify')) * (1 + bonus(s, 'chain')) * echo;
    // 번개는 맞은 결정에서 가까운 결정 3개로 튄다
    const [tx, ty] = CRYSTAL_BASES[target.id], d = o => Math.hypot(CRYSTAL_BASES[o.id][0] - tx, CRYSTAL_BASES[o.id][1] - ty);
    for (const ore of living.filter(o => o !== target).sort((a, b) => d(a) - d(b)).slice(0, 3))
      queue.push({ ore, damage: chainDamage, canBlast: false, chain: true });
  }
  if(level(s,'cleave')){const [tx,ty]=CRYSTAL_BASES[target.id];for(const ore of living.filter(o=>o!==target).sort((a,b)=>Math.hypot(CRYSTAL_BASES[a.id][0]-tx,CRYSTAL_BASES[a.id][1]-ty)-Math.hypot(CRYSTAL_BASES[b.id][0]-tx,CRYSTAL_BASES[b.id][1]-ty)).slice(0,2))queue.push({ore,damage:damage*(.22+.025*level(s,'cleave'))*echo,canBlast:false,blast:true,cleave:true});}
  for (let i = 0; i < queue.length; i++) {
    const hit = queue[i];
    if (hit.ore.hp <= 0)
      continue;
    hit.ore.hp = Math.max(0, hit.ore.hp - hit.damage);
    events.push({ type: 'hit', id: hit.ore.id, damage: Math.round(hit.damage), chain: hit.chain, blast: hit.blast, cleave: hit.cleave, crit: hit.crit, team, unit });
    if (hit.ore.hp === 0 && !dead.has(hit.ore.id)) {
      dead.add(hit.ore.id);
      // 깬 결정의 종류가 보상을 정한다: 돌 1배 · 구리 1.5배 · 에메랄드 2배 · 루비는 돌 1배 + 루비 조금
      const kind = hit.ore.kind || 'stone';
      if (s.dungeon) {
        // 던전: 돌·일반 임무·누적 채굴 수에는 포함하지 않는다. 광산은 다이아를 바로 지급한다.
        const gem = D.breakDungeonOre(s);
        events.push({ type: 'break', id: hit.ore.id, reward: gem, kind, dungeon: true });
        if (gem) events.push({ type: 'dungeonGem', amount: gem });
      }
      else {
        const reward = stoneReward(s, kind);
        addCurrency(s, 'stone', reward);
        s.totalMined++;
        SP.recordSeason(s, 'mined', 1, now);
        events.push({ type: 'break', id: hit.ore.id, reward, kind });
      }
      if (hit.canBlast && level(s, 'blast'))
        for (const ore of s.ores.filter(x => x.hp > 0).slice(0, 3))
          queue.push({ ore, damage: damage * (.4 + .05 * level(s, 'blast')) * echo, canBlast: false, blast: true });
    }
  }
  if (s.ores.every(x => x.hp === 0)) {
    // 던전 무대를 다 깼다: 광산은 더 단단하게 다시 솟고, 광산탑은 다음 층으로. 일반 층·시즌 임무는 그대로.
    if (s.dungeon) {
      events.push(...D.clearDungeonStage(s, rng));
      return events;
    }
    SP.recordSeason(s, 'stages', 1, now);
    // 루비 층을 모두 깨면 루비를 한 번 더 준다(돌 층·구리 층·에메랄드 층은 층 안의 돌 보상만). 층이 오르기 전 기준으로 계산한다.
    const cleared = s.floorKind;
    if (cleared === 'ruby') {
      const ruby = rubyFloorReward(s);
      addCurrency(s, 'ruby', ruby);
      events.push({ type: 'stageClear', kind: cleared, ruby });
    }
    s.floor = Math.min(C.maxFloor, s.floor + 1);
    s.runMax = Math.max(s.runMax, s.floor);
    s.lifetimeMax = Math.max(s.lifetimeMax, s.floor);
    resetVein(s, rng);
    events.push({ type: 'floor', floor: s.floor, kind: s.floorKind });
  }
  return events;
}

export function step(s, dt, rng = Math.random, now = Date.now()) {
  P.enforcePasses(s, now);
  SP.syncSeason(s, now);
  if (!finite(dt) || dt <= 0)
    return [];
  dt = Math.min(dt, 1);
  if(s.dungeon){const ended=D.advanceDungeon(s,dt,now);if(ended)return [ended];}
  if ((s.draft && !s.rubyStage) || !s.autoMine)
    return [];
  const events = [];
  if (s.rubyStage) {
    s.rubyStage.elapsed += dt;
    if (s.rubyStage.elapsed >= C.rubyStageSeconds)
      return [endRubyStage(s)];
  }
  syncUnitClocks(s);
  // 햄찌마다 자기 시계로 친다. 치고 나면 다음 간격이 ±15% 흔들려 박자가 서로 어긋난다.
  // 목표가 바뀌면(이전 결정이 깨졌거나 가려짐) 그 자리까지 걸어가는 시간만큼 다음 타격이 늦어진다.
  const period = unitPeriod(s), single = s.rubyStage;
  // 목표가 깨졌거나 아직 없으면 바로 다음 목표를 정하고, 걸어가는 시간만큼 다음 타격을 미룬다.
  // (다음 타격 시점까지 기다렸다 고르면 그사이 화면의 햄찌가 갈 곳 없이 서성이다 엉뚱한 곳에서 출발한다)
  // 빈자리를 기다리는 햄찌는 치지 않고, 자리가 나면 그때 걸어간다.
  if (!single && s.ores.some(o => o.hp > 0))
    for (let u = 0; u < s.unitClocks.length; u++) {
      if (!needsTarget(s, u) && !s.unitWaiting[u])
        continue;
      // 기다리는 햄찌는 0.25초마다만 자리를 다시 찾는다(매 프레임 바꾸면 이리저리 오가고 계산도 무거움)
      if (!needsTarget(s, u) && s.unitWaiting[u]) {
        const probe = probeClock(s), slot = Math.floor(s.floorElapsed * 4);
        if (probe[u] === slot) {
          s.unitClocks[u] = Math.min(s.unitClocks[u], period * .5);
          continue;
        }
        probe[u] = slot;
      }
      const travel = retarget(s, u);
      s.unitClocks[u] = Math.min(s.unitClocks[u], s.unitWaiting[u] ? period * .5 : period - travel);
    }
  for (let u = 0; u < s.unitClocks.length; u++) {
    s.unitClocks[u] += dt;
    let count = 0;
    while (s.unitClocks[u] >= period && count++ < 30) {
      if (!single && needsTarget(s, u) && s.ores.some(o => o.hp > 0)) {
        s.unitClocks[u] = period - retarget(s, u);
        break;
      }
      s.unitClocks[u] -= period * (.85 + .3 * rng());
      events.push(...attack(s, rng, u, now));
      if(events.some(e=>e.type==='dungeonEnd'))return events;
      if (!s.rubyStage && events.some(e => e.type === 'rubyStageEnd'))
        return events;
    }
  }
  // 층 제한 시간: 던전·루비 바위 중에는 멈춘다. 시간 안에 못 깨면 같은 층 광맥을 새로 채워 다시 도전한다(광맥 종류는 다시 굴린다).
  // 실패한 도전에서 이미 캔 돌은 돌려받지 않는다.
  if (!s.dungeon && !s.rubyStage) {
    s.floorElapsed += dt;
    if (s.floorElapsed >= C.floorSeconds) {
      resetVein(s, rng);
      s.unitClocks = [];
      syncUnitClocks(s);
      events.push({ type: 'floorFail', floor: s.floor });
    }
  }
  if (s.autoUpgrade && s.skills.length) {
    const a = [...s.skills].sort((a, b) => a.level - b.level)[0];
    upgradeSkill(s, a.id);
  }
  return events;
}

export function rebirthReward(s) {
  return s.runMax < C.rebirthMinFloor ? 0 : Math.max(1, Math.floor(C.rubyPerFloor * s.runMax * (1+bonus(s,'ruby'))));
}

// 장착 팀 수 × 3마리에 맞춰 시계를 맞춘다. 새 햄찌는 서로 다른 박자(황금비 위상)로 출발한다.
export function syncUnitClocks(s) {
  const n = s.crew.length * CREW_PER_TEAM, period = unitPeriod(s);
  s.unitClocks = s.unitClocks.slice(0, n);
  for (let u = s.unitClocks.length; u < n; u++)
    s.unitClocks.push(period * ((u * PHI + .37) % 1));
}

export function rubyStageChance(runMax) {
  if (runMax < C.rubyStageMinFloor)
    return 0;
  return Math.min(C.rubyStageMaxChance, C.rubyStageBaseChance + C.rubyStageChancePerFloor * (runMax - C.rubyStageMinFloor));
}

// 루비 바위 종료: 깨면 보너스 전부, 시간이 끝나면 깎은 비율만큼. 한 번만 지급하고 스테이지를 닫는다.
function endRubyStage(s) {
  const r = s.rubyStage, cleared = r.hp === 0;
  const reward = cleared ? r.bonus : Math.floor(r.bonus * (1 - r.hp / r.maxHp));
  if (reward > 0)
    addCurrency(s, 'ruby', reward);
  s.rubyStage = null;
  s.unitClocks = [];
  return { type: 'rubyStageEnd', reward, cleared };
}

export function rebirth(s, rng = Math.random, now = Date.now()) {
  const reward = rebirthReward(s);
  if (!reward || s.dungeon || s.draft || s.rubyStage)
    return false;
  const chance = rubyStageChance(s.runMax);
  addCurrency(s, 'ruby', reward);
  s.wallet.stone = 0;
  s.floor = 1;
  s.runMax = 1;
  s.skills = [];
  M.activateUnlocks(s);
  s.draft = {step:0,offers:draftOffers(s,rng),rerolls:0};
  s.rebirths++;
  SP.recordSeason(s, 'rebirth', 1, now);
  s.unitClocks = [];
  resetVein(s, rng);
  if (chance && rng() < chance) {
    const st = stats(s), hp = Math.max(1, Math.round(st.damage * totalPower(s) / st.interval * C.rubyStageHpSeconds));
    s.rubyStage = { hp, maxHp: hp, elapsed: 0, bonus: Math.max(1, Math.round(reward * C.rubyStageBonus)) };
  }
  return reward;
}

export const visibleMastery=M.visibleNodes;
export const buyMastery=M.buyNode;
export const absorbMastery=M.absorbPage;

// 곡괭이 id를 들고 있는 햄찌 id(없으면 null).
export const holderOf = (s, itemId) => Object.keys(s.gear || {}).find(h => s.gear[h] === itemId) || null;

// 곡괭이(itemId)를 햄찌(hamsterId)에게 쥐여 준다. 한 자루는 한 마리만 들 수 있어서, 이미 다른 햄찌가 들고 있으면
// 그 햄찌와 서로 바꾼다(받는 햄찌가 들고 있던 것이 그쪽으로 간다). 가진 햄찌에게만 줄 수 있다.
export function equip(s, itemId, hamsterId) {
  if (!s.inventory.some(x => x.id === itemId) || !s.hamsters[hamsterId])
    return false;
  const from = holderOf(s, itemId), old = s.gear[hamsterId];
  if (from === hamsterId)
    return true;
  if (from) {
    if (old != null)
      s.gear[from] = old;
    else
      delete s.gear[from];
  }
  s.gear[hamsterId] = itemId;
  return true;
}

// 햄찌가 든 곡괭이를 내려놓는다(곡괭이는 인벤토리에 남고 그 햄찌는 맨손 D급이 된다).
export function unequip(s, hamsterId) {
  if (s.gear[hamsterId] == null)
    return false;
  delete s.gear[hamsterId];
  return true;
}

// 합성: 같은 등급의 서로 다른 곡괭이 두 자루 → 한 등급 위 한 자루(새 곡괭이라 강화는 +0부터).
// 재료를 든 햄찌가 있으면 첫 번째 재료를 든 햄찌(없으면 둘째 재료를 든 햄찌)가 결과물을 든다. 나머지 햄찌는 빈손이 된다.
export function merge(s, ids) {
  if (ids.length !== 2 || new Set(ids).size !== 2)
    return null;
  const items = ids.map(id => s.inventory.find(x => x.id === id));
  if (items.some(x => !x) || items[0].tier !== items[1].tier || items[0].tier === TIERS.length - 1)
    return null;
  const result = { id: s.nextItemId++, tier: items[0].tier + 1 };
  const holders = ids.map(id => holderOf(s, id));
  for (const h of holders)
    if (h)
      delete s.gear[h];
  s.inventory = s.inventory.filter(x => !ids.includes(x.id));
  s.inventory.push(result);
  const heir = holders.find(Boolean);
  if (heir)
    s.gear[heir] = result.id;
  return result;
}

// 일괄 합성(2026-10-08): 지정한 등급(maxTier) 이하의 곡괭이를 같은 등급끼리 둘씩 짝지어 한 등급 위로 합친다.
// 새로 생긴 곡괭이가 maxTier 이하면 이어서 또 합친다(D→C→B …). maxTier보다 높은 등급이 결과로 나오는 것까지만 허용한다.
// 햄찌가 들고 있는 곡괭이와 강화한 곡괭이는 재료로 쓰지 않는다(들고 있는 장비·강화 단계를 실수로 잃지 않게).
// planBulkMerge는 계산만 하고, bulkMerge는 실제로 인벤토리를 바꾼다.
export function planBulkMerge(s, maxTier) {
  const top = Math.min(Math.floor(maxTier), TIERS.length - 2);
  const free = s.inventory.filter(x => !holderOf(s, x.id) && !(x.enh > 0));
  const have = Array.from({ length: TIERS.length }, (_, t) => free.filter(x => x.tier === t).length);
  const start = have.slice();
  const merges = [];
  for (let t = 0; t <= top; t++) {
    const pairs = Math.floor(have[t] / 2);
    if (!pairs)
      continue;
    merges.push({ from: t, pairs });
    have[t] -= pairs * 2;
    have[t + 1] += pairs;
  }
  // gained: 합친 결과로 새로 늘어난 곡괭이 수(등급별), used: 재료로 쓰는 곡괭이 수
  const gained = Array(TIERS.length).fill(0), used = merges.reduce((n, m) => n + m.pairs * 2, 0);
  for (const m of merges) gained[m.from + 1] += m.pairs;
  const skipped = s.inventory.filter(x => x.tier <= top && (holderOf(s, x.id) || x.enh > 0)).length;
  return { top, merges, used, gainedTotal: merges.reduce((n, m) => n + m.pairs, 0), gained, final: have, skipped, start };
}
export function bulkMerge(s, maxTier) {
  const plan = planBulkMerge(s, maxTier);
  if (!plan.merges.length)
    return null;
  const free = s.inventory.filter(x => !holderOf(s, x.id) && !(x.enh > 0)).sort((a, b) => a.id - b.id);
  const byTier = Array.from({ length: TIERS.length }, () => []);
  for (const x of free) byTier[x.tier].push(x);
  const removed = new Set(), created = [];
  for (let t = 0; t <= plan.top; t++) {
    const pool = byTier[t], pairs = Math.floor(pool.length / 2);
    for (let i = 0; i < pairs * 2; i++) removed.add(pool[i].id);
    for (let i = 0; i < pairs; i++) {
      const item = { id: s.nextItemId++, tier: t + 1 };
      created.push(item);
      byTier[t + 1].push(item);   // 새 곡괭이는 다음 등급에서 이어서 합칠 수 있다(maxTier 이하일 때)
    }
    byTier[t] = pool.slice(pairs * 2);
  }
  s.inventory = s.inventory.filter(x => !removed.has(x.id)).concat(created.filter(x => !removed.has(x.id)));
  return plan;
}
// 곡괭이 강화: 다음 단계 비용({stone, ruby}, 루비가 없는 단계는 ruby 0). 최대 단계면 null.
export const enhanceMax = ENHANCE.steps.length;
export function enhanceCost(item) {
  const step = item && ENHANCE.steps[item.enh || 0];
  return step ? { stone: step.stone, ruby: step.ruby || 0 } : null;
}
// 돌(5→6강부터는 루비도)을 내고 그 곡괭이를 한 단계 올린다. 부족하거나 최대면 false.
export function enhance(s, id) {
  const item = s.inventory.find(x => x.id === id), cost = enhanceCost(item);
  if (!cost || s.wallet.stone < cost.stone || s.wallet.ruby < cost.ruby)
    return false;
  s.wallet.stone -= cost.stone;
  s.wallet.ruby -= cost.ruby;
  item.enh = (item.enh || 0) + 1;
  return true;
}

export function rollTier(rng = Math.random) {
  const roll = clamp(rng(), 0, 1 - Number.EPSILON) * 10000;
  let sum = 0;
  for (let i = 0; i < DRAW_WEIGHTS.length; i++) {
    sum += DRAW_WEIGHTS[i];
    if (roll < sum)
      return i;
  }
  return TIERS.length - 1;
}

// 곡괭이 10연 뽑기: 다이아 10회분을 한 번에 내고 곡괭이 10자루를 받는다(무료·광고 횟수는 쓰지 않는다). 장비함 자리가 모자라면 아무것도 하지 않는다.
export function drawMany(s, rng = Math.random, count = C.multiDraw) {
  const cost = C.drawCost * count;
  if (s.wallet.diamond < cost || s.inventory.length + count > 200)
    return null;
  s.wallet.diamond -= cost;
  return Array.from({ length: count }, () => {
    const item = { id: s.nextItemId++, tier: rollTier(rng) };
    s.inventory.push(item);
    return item;
  });
}

export function draw(s, method, rng = Math.random, now = Date.now(), adVerified = false) {
  P.enforcePasses(s, now);
  refreshDay(s, now);
  if (s.inventory.length >= 200)
    return null;
  if (method === 'free') {
    if (s.daily.free >= C.dailyFreeDraws)
      return null;
    s.daily.free++;
  }
  else if (method === 'ad') {
    if ((!adVerified && !P.hasAdFree(s, now)) || s.daily.ads >= C.dailyAdDraws)
      return null;
    s.daily.ads++;
  }
  else if (method === 'diamond') {
    if (s.wallet.diamond < C.drawCost)
      return null;
    s.wallet.diamond -= C.drawCost;
  }
  else
    return null;
  const item = { id: s.nextItemId++, tier: rollTier(rng) };
  s.inventory.push(item);
  return item;
}

export function rollHamster(rng = Math.random) {
  const roll = clamp(rng(), 0, 1 - Number.EPSILON) * 10000;
  let sum = 0;
  for (const h of HAMSTERS) {
    sum += h.weight;
    if (roll < sum)
      return h.id;
  }
  return HAMSTERS[HAMSTERS.length - 1].id;
}

// 햄찌 뽑기: 새 종류면 Lv.1로 합류(팀에는 자동으로 넣지 않는다 — 유저가 햄찌단에서 직접 넣는다).
// 이미 있는 종류가 또 나오면 레벨은 오르지 않고 다이아 일부를 돌려준다. 레벨은 루비로 올린다(levelUpHamster).
export function drawHamster(s, rng = Math.random) {
  if (s.wallet.diamond < C.hamsterDrawCost)
    return null;
  s.wallet.diamond -= C.hamsterDrawCost;
  return grantHamster(s, rng);
}

// 햄찌 10연 뽑기: 다이아 10회분을 한 번에 내고 결과 10개를 차례로 돌려준다(중복 환급 규칙은 한 번 뽑기와 같다).
export function drawHamsterMany(s, rng = Math.random, count = C.multiDraw) {
  const cost = C.hamsterDrawCost * count;
  if (s.wallet.diamond < cost)
    return null;
  s.wallet.diamond -= cost;
  return Array.from({ length: count }, () => grantHamster(s, rng));
}

// 다이아를 이미 낸 뒤의 한 번 뽑기 결과 적용
function grantHamster(s, rng) {
  const id = rollHamster(rng), before = s.hamsters[id] || 0;
  if (!before) {
    s.hamsters[id] = 1;
    return { id, level: 1, isNew: true, refund: 0 };
  }
  addCurrency(s, 'diamond', C.hamsterDupRefund);
  return { id, level: before, isNew: false, refund: C.hamsterDupRefund };
}

// 햄찌 레벨업에 드는 루비(다음 레벨로 가는 비용). 최고 레벨이면 null.
export function hamsterLevelCost(s, id) {
  const lv = s.hamsters[id] || 0;
  return lv >= 1 && lv < C.hamsterMaxLevel ? C.hamsterLevelRuby[lv - 1] : null;
}

// 햄찌 레벨업: 루비를 내고 Lv +1. 없는 햄찌·최고 레벨·루비 부족이면 false.
export function levelUpHamster(s, id) {
  const cost = hamsterLevelCost(s, id);
  if (cost === null || s.wallet.ruby < cost)
    return false;
  s.wallet.ruby -= cost;
  s.hamsters[id]++;
  return true;
}

// Season crates use the existing shop draw tables and grant directly to the inventory/crew.
// Capacity is checked before consuming a reward so a full bag never loses the claim.
export function claimSeasonReward(s, track, level, token, now = Date.now(), rng = Math.random) {
  return SP.claimSeasonReward(s,track,level,token,reward=>{
    if (['diamond','ruby'].includes(reward.kind)) {
      if(s.wallet[reward.kind]+reward.amount>C.walletCap)return false;
      addCurrency(s,reward.kind,reward.amount);return {currency:reward.kind,amount:reward.amount};
    }
    if(reward.kind==='pickaxes') {
      if(s.inventory.length+reward.amount>200)return false;
      const items=Array.from({length:reward.amount},()=>({id:s.nextItemId++,tier:rollTier(rng)}));
      s.inventory.push(...items);return {items};
    }
    if(reward.kind==='hamsters') {
      if(s.wallet.diamond+reward.amount*C.hamsterDupRefund>C.walletCap)return false;
      return {hamsters:Array.from({length:reward.amount},()=>grantHamster(s,rng))};
    }
    return false;
  },now);
}
export function claimAllSeason(s, token, now = Date.now(), rng = Math.random) {
  const status=SP.seasonStatus(s,now);
  if(token!==status.token)return {xp:0,rewards:[],blocked:0};
  // 오늘의 임무: 받을 수 있는 단계(처음 받기·프리미엄 다시받기)를 모두 받는다
  let xp=0;
  for(const q of SP.seasonQuests(s,now))for(const tier of q.tiers){let got;while((got=SP.claimSeasonQuest(s,q.id,tier.index,token,now))>0)xp+=got;}
  const rewards=[];let blocked=0;
  for(const track of ['free','premium'])for(let level=1;level<=SP.seasonStatus(s,now).level;level++) {
    if(SP.seasonRewardState(s,track,level,now)!=='ready')continue;
    const result=claimSeasonReward(s,track,level,token,now,rng);
    if(result)rewards.push(result);else blocked++;
  }
  return {xp,rewards,blocked};
}

// 장착/해제. 최소 한 팀은 남기고, 최대 maxTeams 팀까지.
export function toggleCrew(s, id) {
  if (!s.hamsters[id])
    return false;
  if (s.crew.includes(id)) {
    if (s.crew.length === 1)
      return false;
    const k = s.crew.indexOf(id), from = k * CREW_PER_TEAM;
    s.crew.splice(k, 1);
    for (const list of [s.unitClocks, s.unitFocus, s.unitTargets, s.unitSpots, s.unitWaiting])
      list.splice(from, CREW_PER_TEAM);
    return true;
  }
  if (s.crew.length >= C.maxTeams)
    return false;
  s.crew.push(id);
  return true;
}

export function claimDaily(s, now = Date.now()) {
  refreshDay(s, now);
  if (s.daily.claimed)
    return 0;
  const reward = DAILY_REWARDS[s.loginCount % DAILY_REWARDS.length];
  s.daily.claimed = true;
  s.loginCount++;
  addCurrency(s, 'diamond', reward);
  return reward;
}

export function startDungeon(s, now = Date.now(), kind = 'mine', rng = Math.random) {
  refreshDay(s, now);
  return D.beginDungeon(s,kind,now,rng);
}

export const leaveDungeon = s => D.finishDungeon(s,'leave');

export function claimMission(s, id) {
  const mission = { mine50: { done: s.totalMined >= 50, reward: 50 }, floor15: { done: s.lifetimeMax >= 15, reward: 100 }, rebirth1: { done: s.rebirths >= 1, reward: 100 } }[id];
  if (!mission?.done || s.missionClaims.includes(id))
    return 0;
  s.missionClaims.push(id);
  addCurrency(s, 'diamond', mission.reward);
  return mission.reward;
}

export function claimOffline(s, now = Date.now()) {
  const elapsed = clamp((now - s.lastSeen) / 1000, 0, C.offlineCapSeconds);
  let amount = 0;
  if (elapsed >= 30 && !s.draft && s.autoMine && !s.dungeon) {
    const st = stats(s);
    amount = Math.floor(elapsed * (st.damage * totalPower(s) / st.interval) / oreHp(s.floor) * stoneReward(s) * ORE_AVG_STONE * st.offline);
    addCurrency(s, 'stone', amount);
  }
  // 이탈 시간에는 채굴하지 않는다. 광산에서 이미 캔 다이아는 유지하고 타워는 재도전한다.
  const dungeon = s.dungeon ? D.finishDungeon(s,'away') : null;
  // 루비 바위 도중 30초 이상 자리를 비우면 그때까지 깎은 비율만큼만 지급하고 끝낸다.
  // 잠깐 탭을 바꾼 정도면 그동안 시간도 멈춰 있었으므로 이어서 캔다.
  const ruby = s.rubyStage && elapsed >= 30 ? endRubyStage(s) : null;
  s.lastSeen = now;
  return { elapsed, amount, ruby, dungeon };
}

export function serialize(s, now = Date.now()) {
  s.lastSeen = now;
  return JSON.stringify(s);
}

export function parseState(raw, now = Date.now()) {
  if (!raw)
    return null;
  try {
    const s = JSON.parse(raw);
    if (s.version !== C.version)
      return null;
    if (!s.wallet || !['stone', 'ruby', 'diamond'].every(k => finite(s.wallet[k]) && s.wallet[k] >= 0 && s.wallet[k] <= C.walletCap))
      return null;
    if (!Number.isInteger(s.floor) || s.floor < 1 || s.floor > C.maxFloor || !finite(s.lastSeen) || s.lastSeen < 0)
      return null;
    if (!Array.isArray(s.inventory) || !s.inventory.length || s.inventory.length > 200 || s.inventory.some(x => !Number.isInteger(x.id) || !Number.isInteger(x.tier) || x.id < 1 || x.tier < 0 || x.tier >= TIERS.length) || new Set(s.inventory.map(x => x.id)).size !== s.inventory.length)
      return null;
    // 강화 단계: 합성 시절 저장에는 없으니 0으로 읽고, 범위를 벗어난 값은 가장 가까운 단계로 맞춘다
    for (const x of s.inventory)
      if (x.enh !== undefined)
        x.enh = Number.isInteger(x.enh) ? clamp(x.enh, 0, ENHANCE.steps.length) : 0;
    if (!Number.isInteger(s.nextItemId) || s.nextItemId <= Math.max(...s.inventory.map(x => x.id)))
      return null;
    if (!Array.isArray(s.skills) || s.skills.length > 3 || s.skills.some(x => !SKILLS.some(k => k.id === x.id) || !Number.isInteger(x.level) || x.level < 1 || x.level > C.maxSkillLevel) || new Set(s.skills.map(x => x.id)).size !== s.skills.length)
      return null;
    if (!Array.isArray(s.mastery) || s.mastery.some(x => !MASTERY.some(n => n.id === x)) || new Set(s.mastery).size !== s.mastery.length)
      return null;
    s.masteryBook ||= M.newMasteryBook();
    if(!M.validateBook(s))return null;
    if(s.draft){s.draft.rerolls??=0;if(!Number.isInteger(s.draft.rerolls)||s.draft.rerolls<0||s.draft.rerolls>3||new Set(s.draft.offers).size!==s.draft.offers.length||s.draft.offers.length!==3||s.draft.step!==s.skills.length||s.draft.offers.some(id=>!draftPool(s).includes(id)))return null;}
    // 의상 시절 저장: 가진 의상을 같은 id의 햄찌 Lv.1로 바꾸고 전부 팀에 넣는다(입던 의상이 앞 순서).
    if (!s.hamsters && Array.isArray(s.ownedCostumes)) {
      s.hamsters = Object.fromEntries(s.ownedCostumes.filter(id => HAMSTERS.some(h => h.id === id)).map(id => [id, 1]));
      s.hamsters.miner ||= 1;
      s.crew = [...new Set(['miner', s.costume, ...s.ownedCostumes].filter(id => s.hamsters[id]))].slice(0, C.maxTeams);
    }
    delete s.ownedCostumes;
    delete s.costume;
    if (!s.hamsters || typeof s.hamsters !== 'object' || Object.entries(s.hamsters).some(([id, lv]) => !HAMSTERS.some(h => h.id === id) || !Number.isInteger(lv) || lv < 1 || lv > C.hamsterMaxLevel))
      return null;
    if (!Array.isArray(s.crew) || !s.crew.length || s.crew.length > C.maxTeams || s.crew.some(id => !s.hamsters[id]) || new Set(s.crew).size !== s.crew.length)
      return null;
    // 곡괭이는 햄찌마다 따로 든다. 한 자루 장착 시절 저장(equipped)은 첫 팀 햄찌가 들고 나머지는 빈손으로 시작한다.
    // 모르는 햄찌·없는 곡괭이·한 자루를 둘이 든 항목은 버린다.
    {
      const raw = s.gear && typeof s.gear === 'object' && !Array.isArray(s.gear) ? s.gear : s.gear === undefined && s.equipped != null ? { [s.crew[0]]: s.equipped } : {};
      const used = new Set();
      s.gear = {};
      for (const [h, id] of Object.entries(raw))
        if (s.hamsters[h] && Number.isInteger(id) && s.inventory.some(x => x.id === id) && !used.has(id)) {
          s.gear[h] = id;
          used.add(id);
        }
      delete s.equipped;
    }
    if (s.rubyStage && (!finite(s.rubyStage.hp) || !finite(s.rubyStage.maxHp) || !finite(s.rubyStage.elapsed) || !Number.isInteger(s.rubyStage.bonus) || s.rubyStage.hp < 0 || s.rubyStage.maxHp <= 0 || s.rubyStage.bonus < 0))
      return null;
    // 루비 바위 도중에도 빌드 선택을 끝낼 수 있으므로(프로필·설정의 "현재 빌드") draft가 없어도 정상 저장이다.
    s.rubyStage ||= null;
    if (!s.daily || typeof s.daily.day !== 'string' || !['free', 'ads', 'dungeons'].every(k => Number.isInteger(s.daily[k]) && s.daily[k] >= 0))
      return null;
    if (s.daily.shopGift !== undefined && typeof s.daily.shopGift !== 'boolean') return null;
    s.daily.shopGift ??= false;
    // 구매 기록(테스트 구매): 합성·옛 저장에는 없다. 모르는 값은 버리고 true인 상품만 남긴다.
    s.purchases = s.purchases && typeof s.purchases === 'object' && !Array.isArray(s.purchases) ? Object.fromEntries(Object.entries(s.purchases).filter(([id, v]) => v === true && shopProduct(id))) : {};
    if (![s.runMax, s.lifetimeMax, s.rebirths, s.totalMined, s.loginCount].every(x => Number.isInteger(x) && x >= 0) || s.runMax < s.floor || s.lifetimeMax < s.runMax)
      return null;
    if (!Array.isArray(s.missionClaims) || s.missionClaims.some(x => !['mine50', 'floor15', 'rebirth1'].includes(x)))
      return null;
    if (s.draft && (!Array.isArray(s.draft.offers) || s.draft.offers.some(x => !SKILLS.some(k => k.id === x)) || s.skills.length >= 3))
      return null;
    if (!s.draft && s.skills.length !== 3)
      return null;
    if (!Array.isArray(s.ores) || s.ores.length !== C.oreCount || s.ores.some((x, i) => x.id !== i || !finite(x.hp) || !finite(x.maxHp) || x.hp < 0 || x.maxHp <= 0 || x.hp > x.maxHp))
      return null;
    // 층 종류가 생기기 전 저장, 결정마다 섞여 있던 저장(이전 시험판), 알 수 없는 종류는 돌 층으로 읽는다(다음 층부터 새 확률).
    {
      const first = s.ores[0].kind;
      const kind = ORE_KINDS.some(k => k.id === first) && s.ores.every(o => o.kind === first) ? first : 'stone';
      s.floorKind = kind;
      for (const o of s.ores)
        o.kind = kind;
    }
    D.restoreDungeons(s);
    // 튜토리얼 이전 저장에는 기록이 없다: 이미 끝난 것으로 읽어 갑자기 안내가 뜨지 않게 한다.
    {
      const t = s.tutorial;
      s.tutorial = t && typeof t === 'object' ? { done: t.done === true, step: Number.isInteger(t.step) && t.step >= 0 && t.step < 100 ? t.step : 0, tips: Array.isArray(t.tips) ? t.tips.filter(x => TUTORIAL.tips.includes(x)) : [], rb: s.rebirths >= 1 ? -1 : Number.isInteger(t.rb) && t.rb >= -1 && t.rb < 40 ? t.rb : 0 } : finishedTutorial();
    }
    // 햄찌별 시계·집중·목표. 예전 단일/팀 시계는 버리고 새 박자로 시작한다(진행·재화에는 영향 없음).
    s.unitClocks = Array.isArray(s.unitClocks) ? s.unitClocks.filter(finite).slice(0, s.crew.length * CREW_PER_TEAM) : [];
    s.unitFocus = Array.isArray(s.unitFocus) ? s.unitFocus : [];
    s.unitTargets = Array.isArray(s.unitTargets) ? s.unitTargets.map(t => Number.isInteger(t) && t >= 0 && t < C.oreCount ? t : null) : [];
    s.unitSpots = Array.isArray(s.unitSpots) ? s.unitSpots.map(p => Array.isArray(p) && p.length === 2 && p.every(finite) ? p : null) : [];
    s.unitWaiting = Array.isArray(s.unitWaiting) ? s.unitWaiting.map(x => x === true) : [];
    delete s.teamClocks;
    delete s.teamFocus;
    delete s.attackClock;
    delete s.focusTarget;
    delete s.focusStacks;
    // 제한 시간 도입 전 저장에는 값이 없다. 이상한 값이면 이번 층 도전을 처음부터.
    if (!finite(s.floorElapsed) || s.floorElapsed < 0 || s.floorElapsed >= C.floorSeconds)
      s.floorElapsed = 0;
    // 설정에는 소리·진동 켜고 끄기만 남았다. 타격 모션과 자동 채굴을 끄는 버튼은 없어졌으므로, 예전에 꺼 둔 저장도 켜진 채로 읽는다(되돌릴 길이 없다).
    s.settings = { motion: true, sfx: s.settings?.sfx !== false, bgm: s.settings?.bgm !== false, haptic: s.settings?.haptic !== false };
    s.autoMine = true;
    s.autoUpgrade = s.autoUpgrade === true;
    P.restorePasses(s, now);
    SP.restoreSeason(s, now);
    refreshDay(s, now);
    return s;
  }
  catch {
    return null;
  }
}
