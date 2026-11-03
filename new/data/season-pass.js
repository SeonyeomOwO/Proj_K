export const SEASON = Object.freeze({days:30, maxLevel:50, xpPerLevel:500, price:20000, title:'반짝이는 갱도'});
// 일일 임무(2026-10-07): 도전 3종, 오늘의 단계 3개씩. 하루(한국 시간 오전 9시 = UTC 00시)마다 처음부터 다시 시작하고,
// 그날 마지막 단계까지 채우면 오늘 임무는 더 늘지 않는다(더 해도 진행에 안 들어감). 못 받은 완료 보상은 하루가 지나면 사라진다.
// 프리미엄 이용자는 각 단계를 받은 뒤 같은 XP를 한 번 더("다시받기") 받는다.
// 기준치는 tools/simulate-season.mjs(하루 30분 자동 플레이)로 계산했다: 가장 약한 D급 1팀의 첫날 30분 진행량(광석 940·스테이지 55·환생 4) 이하,
// XP는 하루 990(무료) → 25일째 50레벨(시즌 종료 5일 전), 프리미엄은 하루 1,980 → 13일째.
const tier=(target,xp)=>Object.freeze({target,xp});
export const SEASON_QUESTS = Object.freeze([
  {id:'rebirth', title:'환생하기', short:'환생', icon:'rebirth', unit:'회', text:'{n}회 이상 환생하세요!', tiers:Object.freeze([tier(1,100),tier(2,110),tier(3,120)])},
  {id:'mined', title:'광석 채굴', short:'채굴', icon:'mineral_stone', unit:'개', text:'광석을 {n}개 이상 채굴하세요!', tiers:Object.freeze([tier(300,100),tier(600,110),tier(900,120)])},
  {id:'stages', title:'스테이지 클리어', short:'스테이지', icon:'pickaxe', unit:'회', text:'스테이지를 {n}번 이상 클리어하세요!', tiers:Object.freeze([tier(20,100),tier(35,110),tier(50,120)])}
].map(q=>Object.freeze(q)));
export const SEASON_DAILY_XP = SEASON_QUESTS.reduce((n,q)=>n+q.tiers.reduce((m,t)=>m+t.xp,0),0);const reward=(kind,amount,art,label)=>Object.freeze({kind,amount,art,label});
const diamond=n=>reward('diamond',n,n>=200?'shop_gem_chest':n>=100?'shop_gem_bag':'shop_gems','다이아');
const ruby=n=>reward('ruby',n,'ruby','루비');
const picks=n=>reward('pickaxes',n,'shop_pickaxe_box','곡괭이 뽑기');
const hamsters=n=>reward('hamsters',n,'shop_hamster_box','햄찌단 모집');
// Each ten-level chapter repeats the same recognizable reward types; five chapters total.
const free=[diamond(30),diamond(50),ruby(20),picks(1),diamond(100),diamond(50),picks(1),diamond(80),diamond(100),hamsters(1)];
const premium=[diamond(150),picks(2),ruby(100),hamsters(2),diamond(300),diamond(200),picks(2),hamsters(5),ruby(100),diamond(500)];
export const SEASON_REWARDS=Object.freeze(Array.from({length:SEASON.maxLevel},(_,i)=>Object.freeze({level:i+1,free:free[i%10],premium:premium[i%10]})));
