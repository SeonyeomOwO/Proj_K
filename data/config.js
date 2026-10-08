import {UNLOCK_SKILLS} from './mastery.js';
export const CONFIG = Object.freeze({
  version:1, designWidth:941, designHeight:1672, maxFloor:200,
  baseDamage:28, baseInterval:0.8, oreCount:16,
  floorSeconds:60, floorHpBase:50, floorHpGrowth:1.17, floorStoneBase:24, floorStoneGrowth:1.08,
  upgradeBase:40, upgradeGrowth:1.35, maxSkillLevel:100,
  rebirthMinFloor:10, rubyPerFloor:1,   // 환생 루비 = 이번 회차 최고 층 × rubyPerFloor (층당 1개, 마스터리 '환생 루비'가 곱해짐)
  offlineCapSeconds:28800, offlineEfficiency:0.4,
  drawCost:100, dailyFreeDraws:1, dailyAdDraws:2,   // 던전 규칙·수치는 data/dungeons.js
  multiDraw:10,   // 10연 뽑기 횟수(비용 = 한 번 비용 × 횟수, 할인 없음)
  maxTeams:6, hamsterDrawCost:150, hamsterMaxLevel:10, hamsterLevelPower:.15,
  hamsterDupRefund:50,   // 이미 있는 햄찌가 또 나오면 레벨은 오르지 않고 다이아를 이만큼 돌려받는다
  hamsterLevelRuby:Object.freeze([5,10,20,35,55,80,115,160,220]),   // 햄찌 레벨업 루비 비용: 현재 레벨 n → n+1 은 [n-1]번째 값(Lv.1→2 = 5)
  // 환생 직후 확률로 루비 바위 스테이지. 확률 = min(max, base + perFloor × (이번 회차 최고층 − minFloor)).
  // 바위 체력은 스킬 없는 현재 초당 피해 × hpSeconds, 보너스 루비는 환생 루비 × bonus × 깎은 비율.
  rubyStageMinFloor:20, rubyStageBaseChance:.05, rubyStageChancePerFloor:.01, rubyStageMaxChance:.35,
  rubyStageSeconds:15, rubyStageHpSeconds:10, rubyStageBonus:.5,
  walletCap:1e12, saveKey:'hamster-mining-web-v2', saveInterval:5000
});
// 광맥 층 종류. 새 층이 열릴 때 한 번 확률로 정해지고, 그 층의 결정 16개가 전부 같은 종류다(층 안에서 섞이지 않는다).
// 돌 층이 기본이고 구리 → 에메랄드 → 루비 순으로 드물다. weight 합 10000(= 100%).
// stone: 그 층의 결정을 깼을 때 돌 획득량 배율. 루비 층은 돌 1배이고, 층을 모두 깨면 루비를 한 번 더 준다:
// 루비 = max(1, round(rubyRate × 지금 최고층 기준 환생 루비)). 다이아몬드는 광맥 층에 나오지 않고 보석 던전 바위로만 나온다.
// 시간 초과로 같은 층을 다시 도전할 때는 같은 종류를 유지한다.
export const ORE_KINDS=[
 {id:'stone',name:'돌',weight:7000,stone:1},
 {id:'copper',name:'구리',weight:1800,stone:1.5},
 {id:'emerald',name:'에메랄드',weight:900,stone:2},
 {id:'ruby',name:'루비',weight:300,stone:1,rubyRate:.12}
];export const TIERS=['D','C','B','A','S','SS'];
export const TIER_POWER=[1,2,4,8,16,32];
export const DRAW_WEIGHTS=[6000,2500,1000,400,90,10];
// 곡괭이 강화(합성 대신). 곡괭이마다 강화 단계(item.enh, 0~최대)가 있고 환생해도 유지된다.
// bonus = 한 단계마다 채굴력 +12%(그 곡괭이 등급 위에 곱한다). steps[n] = n강 → n+1강 비용.
// 5강까지(0→1 … 4→5)는 돌만, 5→6강부터는 루비도 든다.
export const ENHANCE={bonus:.12,steps:[
 {stone:300},{stone:700},{stone:1500},{stone:3200},{stone:7000},
 {stone:15000,ruby:5},{stone:30000,ruby:8},{stone:60000,ruby:12},{stone:120000,ruby:18},{stone:250000,ruby:25}
]};
export const SKILLS=[
 ...UNLOCK_SKILLS,
 {id:'chain',name:'연쇄 번개',icon:'lightning',color:'gold',role:'core',desc:'주변 광석 3개에 번개가 이어져요'},
 {id:'blast',name:'폭발 채굴',icon:'explosion',color:'red',role:'core',desc:'광석 파괴 시 주변에 피해'},
 {id:'focus',name:'집중 채굴',icon:'focus',color:'blue',role:'core',desc:'같은 광석을 점점 강하게'},
 {id:'fast',name:'빠른 손',icon:'fast',color:'blue',role:'support',desc:'레벨마다 채굴 속도 6% 증가'},
 {id:'amplify',name:'번개 증폭',icon:'amplify',color:'green',role:'support',desc:'레벨마다 연쇄 피해 8% 증가'},
 {id:'lucky',name:'알뜰 채굴',icon:'stone',color:'gold',role:'support',desc:'레벨마다 돌 획득량 5% 증가'},
 {id:'power',name:'묵직한 손',icon:'pickaxe',color:'red',role:'support',desc:'레벨마다 기본 채굴력 7% 증가'},
 {id:'critical',name:'정확한 타격',icon:'focus',color:'green',role:'support',desc:'레벨마다 치명타 확률 1% 증가'}
];
export const MASTERY=[
 {id:'root',name:'첫 곡괭이',cost:5,parents:[],x:0,y:0,icon:'pickaxe',effect:'damage',value:.1,desc:'채굴력 +10%'},
 {id:'power1',name:'단단한 손',cost:10,parents:['root'],x:-1,y:1,icon:'focus',effect:'damage',value:.15,desc:'채굴력 +15%'},
 {id:'yield1',name:'광석 감별',cost:10,parents:['root'],x:1,y:1,icon:'stone',effect:'stones',value:.1,desc:'돌 획득량 +10%'},
 {id:'speed1',name:'익숙한 손',cost:20,parents:['power1'],x:-2,y:2,icon:'fast',effect:'speed',value:.1,desc:'채굴 속도 +10%'},
 {id:'crit1',name:'약점 찾기',cost:20,parents:['power1'],x:0,y:2,icon:'focus',effect:'crit',value:.05,desc:'치명타 확률 +5%p'},
 {id:'offline1',name:'꾸준한 작업',cost:20,parents:['yield1'],x:2,y:2,icon:'cart',effect:'offline',value:.1,desc:'오프라인 효율 +10%p'},
 {id:'power2',name:'강철 손목',cost:40,parents:['speed1'],x:-2,y:3,icon:'pickaxe',effect:'damage',value:.2,desc:'채굴력 +20%'},
 {id:'chain1',name:'이어지는 광맥',cost:40,parents:['crit1'],x:0,y:3,icon:'lightning',effect:'chain',value:.2,desc:'연쇄 피해 +20%'},
 {id:'yield2',name:'자투리 수집',cost:40,parents:['offline1'],x:2,y:3,icon:'stone',effect:'stones',value:.2,desc:'돌 획득량 +20%'},
 {id:'speed2',name:'가벼운 곡괭이',cost:80,parents:['power2'],x:-2,y:4,icon:'fast',effect:'speed',value:.15,desc:'채굴 속도 +15%'},
 {id:'power3',name:'광맥 전문가',cost:80,parents:['chain1'],x:0,y:4,icon:'amplify',effect:'damage',value:.3,desc:'채굴력 +30%'},
 {id:'offline2',name:'밤새 채굴',cost:80,parents:['yield2'],x:2,y:4,icon:'cart',effect:'offline',value:.1,desc:'오프라인 효율 +10%p'}
];
// 장착형 햄찌단. 예전 의상 6종을 햄스터 종류로 바꿨다(원화 재사용, id는 이전 저장 호환을 위해 그대로).
// 한 종류를 장착하면 3마리 한 팀이 나와 따로 타격한다. power는 곡괭이·스킬이 반영된 채굴력에 곱하는 팀 배율.
// weight는 햄찌 뽑기 확률(합 10000). 레벨은 루비로 올리고(hamsterLevelRuby), 레벨마다 팀 배율 +hamsterLevelPower. 중복으로 뽑으면 다이아 환급.
export const HAMSTERS=[
 {id:'miner',name:'광부 햄찌',asset:'costume_miner',grade:'D',power:1,weight:3500},
 {id:'farmer',name:'새싹 햄찌',asset:'costume_farmer',grade:'C',power:.45,weight:2600},
 {id:'rain',name:'우비 햄찌',asset:'costume_rain',grade:'C',power:.45,weight:2600},
 {id:'pink',name:'잠꾸러기 햄찌',asset:'costume_pink',grade:'B',power:.6,weight:900},
 {id:'explorer',name:'탐험가 햄찌',asset:'costume_explorer',grade:'A',power:.8,weight:320},
 {id:'star',name:'별빛 햄찌',asset:'costume_star',grade:'S',power:1.1,weight:80}
];
export const CREW_PER_TEAM=3;
export const DAILY_REWARDS=[70,100,150,200,250,300,500];
// 광맥 타일 중심. main-approved.png의 이어진 광맥(가로 약 150~850, 세로 약 340~940)을 따라 잡았다.
// 각 타일은 이 점들의 보로노이 칸을 VEIN_TILE_RADIUS 원으로 자른 모양이다.
export const ORE_POSITIONS=[
 [445,430],[560,410],[685,435],
 [325,490],[565,525],[760,565],
 [215,570],[435,575],
 [320,635],[580,655],[730,690],
 [445,715],[590,780],[720,805],
 [340,745],[520,855]
];
export const VEIN_TILE_RADIUS=88;
// 햄찌가 광맥에 들어오는 쪽. 가장 가까운 광석부터 캔다.
export const MINER_HOME=[250,760];
// 팀마다 다른 방향에서 들어온다(장착 순서대로 왼아래·오른아래·아래·왼위·오른위·위). 18마리가 광맥을 둘러싼다.
export const TEAM_HOMES=[MINER_HOME,[790,760],[520,930],[180,480],[830,470],[520,330]];
