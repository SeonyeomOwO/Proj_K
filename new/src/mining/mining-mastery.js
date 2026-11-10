// 뉴 햄찌 광산 성장 지도(2026-11-04): 마을 건물마다 나무 하나. 레퍼런스(Hole Is Mine)처럼 같은 효과를
// 이름만 바꿔 단계별로 길게 잇는다. 햄찌 자체 능력치 나무는 해바라기씨, 특별한 효과 나무는 황금 해바라기씨로 배운다.
// 숫자는 전부 검토용 값 — 플레이하며 넣고 빼고 조정한다.
// 효과 이름표(화면 표시용). scale: 화면에 보일 때 곱하는 수(%는 100, 개수·초는 1).
export const MINE_EFFECTS={
 damage:{name:'채굴력',unit:'%',icon:'pickaxe'},
 speed:{name:'채굴 속도',unit:'%',icon:'fast'},
 stones:{name:'정산 씨앗',unit:'%',icon:'stone'},
 stamina:{name:'기운 최대치',unit:'',scale:1,icon:'mastery'},
 thrift:{name:'기운 아끼기',unit:'%',icon:'mastery'},
 walk:{name:'걷기 속도',unit:'%',icon:'fast'},
 wade:{name:'물길 걷기',unit:'%p',icon:'fast'},
 carry2:{name:'두 개 나르기',unit:'개',scale:1,icon:'cart'},
 feed:{name:'씨앗 회복량',unit:'',scale:1,icon:'stone'},
 ballCap:{name:'공 용량',unit:'개',scale:1,icon:'stone'},
 ballBounce:{name:'공 튕김',unit:'%p',icon:'amplify'},
 fullness:{name:'배부름 한도',unit:'칸',scale:1,icon:'stone'},
 digestFast:{name:'소화 속도',unit:'%',icon:'stone'},
 rattle:{name:'딸랑이 공(씨앗 없이 깨우기)',unit:' 기운',scale:1,icon:'mastery'},
 descendRest:{name:'내려갈 때 기운 회복',unit:'',scale:1,icon:'mastery'},
 throwRange:{name:'던지기 거리',unit:'%',icon:'fast'},
 impact:{name:'부딪힘 피해',unit:'%',icon:'pickaxe'},
 farHit:{name:'멀리 날수록 세게(100px마다)',unit:'%',icon:'pickaxe'},
 combo:{name:'연속 던지기 속도',unit:'%',icon:'fast'},
 bounce:{name:'던지기 튕김',unit:'번',scale:1,icon:'amplify'},
 pierce:{name:'던지기 관통',unit:'개',scale:1,icon:'lightning'},
 landShock:{name:'착지 충격',unit:'%',icon:'explosion'},
 shadow:{name:'그림자 햄찌',unit:'초',scale:1,icon:'focus'},
 leaderPower:{name:'대장 채굴력',unit:'%',icon:'pickaxe'},
 leaderThrow:{name:'대장 던지기 거리',unit:'%',icon:'fast'},
 leaderWake:{name:'대장의 함성(착지하면 깨우기)',unit:' 기운',scale:1,icon:'mastery'},
 leaderShadow:{name:'대장의 그림자',unit:'마리',scale:1,icon:'focus'},
 cartRange:{name:'수레 던지기 거리',unit:'%',icon:'cart'},
 cartRam:{name:'수레 박치기',unit:'타',scale:1,icon:'cart'},
 magnet:{name:'수레 자석',unit:'칸',scale:1,icon:'cart'},
 cartAura:{name:'수레 곁 채굴 속도',unit:'%',icon:'cart'},
 vacuum:{name:'수레 청소기(구멍이 열리면 바닥 조각을 수레로)',unit:'',scale:1,icon:'cart'},
 holeEase:{name:'구멍 조건 줄이기',unit:'개',scale:1,icon:'chest'},
 rare:{name:'희귀 광석',unit:'%p',icon:'chest'},
 crateChance:{name:'황금 상자 확률',unit:'%p',icon:'chest'},
 crateSeeds:{name:'상자 속 황금 씨앗',unit:'개',scale:1,icon:'chest'},
 descendSeeds:{name:'내려갈 때 씨앗',unit:'개',scale:1,icon:'stone'},
 windfall:{name:'떨어지는 씨앗',unit:'단계',scale:1,icon:'stone'},
 crit:{name:'반짝 일격 확률',unit:'%p',icon:'focus'},
 critDamage:{name:'반짝 일격 피해',unit:'%p',icon:'focus'},
 crew:{name:'햄찌 증원',unit:'마리',scale:1,icon:'mastery'},
 traitCharge:{name:'충전 곡괭이(새 특성)',unit:'',scale:1,icon:'pickaxe'},
 traitLevel:{name:'특성 숙련',unit:'단계',scale:1,icon:'mastery'},
 traitSlot:{name:'특성 칸',unit:'칸',scale:1,icon:'mastery'},
 // 층 도구(도구 놀이터 나무): 해금하면 바위 속에 묻혀 나오고, 깨면 튀어나와 던질 수 있다
 toolExtra:{name:'층마다 도구 더',unit:'개',scale:1,icon:'chest'},
 bomb:{name:'해바라기 폭탄',unit:'',scale:1,icon:'explosion'},
 bombPower:{name:'폭탄 피해',unit:'타',scale:1,icon:'explosion'},
 bombRadius:{name:'폭탄 범위',unit:'%',icon:'explosion'},
 honey:{name:'꿀물 병',unit:'',scale:1,icon:'fast'},
 honeyTime:{name:'꿀물 지속',unit:'초',scale:1,icon:'fast'},
 honeyRadius:{name:'꿀물 범위',unit:'%',icon:'fast'},
 honeyRest:{name:'꿀물 기운 회복',unit:'',scale:1,icon:'mastery'},
 mirror:{name:'거울 씨앗',unit:'',scale:1,icon:'focus'},
 mirrorCount:{name:'거울 그림자 수',unit:'마리',scale:1,icon:'focus'},
 mirrorTime:{name:'거울 그림자 시간',unit:'초',scale:1,icon:'focus'},
 sour:{name:'시큼 열매',unit:'',scale:1,icon:'lightning'},
 sourRadius:{name:'시큼 범위',unit:'%',icon:'lightning'},
 sourPower:{name:'무른 바위 추가 피해',unit:'%p',icon:'lightning'},
 flagRush:{name:'깃발로 달려가기',unit:'%',icon:'fast'},
 flagAura:{name:'깃발 곁 채굴 속도',unit:'%',icon:'fast'},
 flagReach:{name:'깃발 부르는 범위',unit:'%',icon:'fast'},
 woodpecker:{name:'딱따구리 장승',unit:'',scale:1,icon:'pickaxe'},
 peckSpeed:{name:'장승 쪼기 속도',unit:'%',icon:'pickaxe'},
 peckPower:{name:'장승 쪼기 힘',unit:'%',icon:'pickaxe'},
 pot:{name:'해바라기 화분',unit:'',scale:1,icon:'stone'},
 potHeal:{name:'화분 기운 회복',unit:'',scale:1,icon:'mastery'},
 potSeeds:{name:'화분 씨앗',unit:'개',scale:1,icon:'stone'}
};
// 나무 = 마을 건물(2026-11-10 사용자 결정): 성장은 두 건물에서만 한다.
//  · 마스터리(해바라기씨) = 햄찌 기본 능력. 예전 '햄찌의 집'·'쉼터' 나무를 합쳤다.
//  · 도구 놀이터(황금 해바라기씨) = 특별한 힘. 예전 '마스터리'·'도구 놀이터' 나무를 합쳤다. 단계마다 '황금 기운'이 쌓여
//    광산에서 확 세지고(GLORY) 햄찌·타격·던지기가 점점 화려해진다(renderer.js glory 연출).
// chain: [효과, 노드 이름, 단계당 값, 최대 단계, (노드 id)]. 앞 노드를 최고 단계까지 올려야 다음 노드가 열린다.
// 노드 id는 예전 나무 그대로(prefix_갈래_번호)라 저장된 배움이 이어진다. 예전 두 번째 나무의 뿌리는 갈래 첫 노드(id 지정)가 됐다.
export const MINE_TREES=[
 {id:'mastery',name:'마스터리',title:'햄찌 능력',currency:'seeds',
  root:{id:'home_root',name:'햄찌 기지개',effect:'damage',value:.02,max:3,cost:6},
  branches:[
   {id:'power',prefix:'home',name:'힘',color:'#eab45d',costs:[6,14,30,60,110,180],chain:[['damage','해바라기 아침밥',.04,5],['damage','볼빵빵 도시락',.06,4],['damage','든든한 점심',.08,4],['damage','챔피언 간식',.1,3],['damage','황금 만찬',.15,3],['damage','전설의 잔치',.2,3]]},
   {id:'hands',prefix:'home',name:'손놀림',color:'#74c6ea',costs:[6,14,30,60,110],chain:[['speed','기름칠한 앞발',.03,5],['speed','둥둥 북치기 손목',.04,4],['speed','번개 앞발',.05,4],['speed','쉬지 않는 발톱',.07,3],['speed','회오리 곡괭이질',.1,3]]},
   {id:'body',prefix:'home',name:'체력',color:'#9ecd87',costs:[6,14,30,60,110,180,260],chain:[['stamina','해바라기 커피 한 모금',5,4],['thrift','숨 고르기',.03,4],['stamina','피로 예방주사',8,3],['thrift','느긋한 호흡',.04,3],['stamina','강철 볼주머니',10,3],['thrift','명상하는 햄찌',.05,2],['stamina','무한 체력 운동',15,2]]},
   {id:'feet',prefix:'home',name:'발걸음',color:'#c3a0ea',costs:[6,14,30,60,110,180],chain:[['walk','가벼운 발',.05,3],['wade','물장구',.1,2],['walk','종종걸음',.06,3],['carry2','두 개 나르기',1,1],['wade','수영 선수',.15,1],['walk','질주 본능',.08,2]]},
   {id:'thrifty',prefix:'home',name:'알뜰',color:'#ef9699',costs:[6,14,30],chain:[['stones','꼼꼼한 정리',.03,5],['stones','반짝 감별',.04,4],['stones','정산의 달인',.05,3]]},
   {id:'seed',prefix:'care',name:'맛있는 씨앗',color:'#f2c14e',costs:[8,8,18,36],chain:[['feed','포근한 둥지',2,3,'care_root'],['feed','고소한 씨앗',4,4],['feed','볶은 씨앗',5,3],['feed','꿀 바른 씨앗',8,2]]},
   {id:'ball',prefix:'care',name:'등나무 공',color:'#9fc7e6',costs:[8,18,36,70,120],chain:[['ballCap','넉넉한 공',2,5],['ballBounce','통통 공',.04,3],['ballCap','더 넉넉한 공',2,3],['ballBounce','고무 공',.05,2],['rattle','딸랑이 공',15,2]]},
   {id:'belly',prefix:'care',name:'배',color:'#80cabc',costs:[8,18,36,70],chain:[['digestFast','꼭꼭 씹기',.08,3],['fullness','큰 배',1,1],['digestFast','소화 잘 되는 차',.1,2],['fullness','더 큰 배',1,1]]},
   {id:'rest',prefix:'care',name:'쉼',color:'#f2a65a',costs:[8,18],chain:[['descendRest','계단 쉼터',8,3],['descendRest','시원한 바람',10,2]]}
  ]},
 {id:'tools',name:'도구 놀이터',title:'황금 마스터리',currency:'golden',
  root:{id:'root',name:'햄찌 광산의 첫걸음',effect:'damage',value:.05,max:1,cost:5},
  branches:[
   {id:'throw',prefix:'mastery',name:'날아라 햄찌',color:'#eab45d',costs:[3,5,8,12,16,22],chain:[['throwRange','쿼터백',.1,3],['impact','단단한 머리',.5,2],['throwRange','투석기 발사',.12,2],['combo','연속 던지기',.15,3],['farHit','멀리 날수록 세게',.15,3],['impact','강철 헬멧',.5,2]]},
   {id:'trick',prefix:'mastery',name:'묘기',color:'#f2a65a',costs:[3,5,8,12],chain:[['bounce','통통 튀기',1,3],['landShock','착지 충격',.25,4],['pierce','관통',1,2],['shadow','그림자 햄찌',3,3]]},
   {id:'leader',prefix:'mastery',name:'대장 햄찌',color:'#e6c547',costs:[3,5,8,12],chain:[['leaderPower','대장의 힘',.3,3],['leaderThrow','대장 던지기',.3,2],['leaderWake','대장의 함성',20,2],['leaderShadow','대장의 그림자',1,2]]},
   {id:'cart',prefix:'mastery',name:'든든한 수레',color:'#c3a0ea',costs:[3,5,8,12,16],chain:[['cartRange','수레 던지기',.15,3],['cartRam','수레 박치기',1,3],['magnet','수레 자석',.5,3],['cartAura','수레 곁 일터',.1,3],['vacuum','수레 청소기',1,1]]},
   {id:'mine',prefix:'mastery',name:'반짝이는 광산',color:'#ef9699',costs:[3,5,8,12,16,22],chain:[['holeEase','구멍 조건 줄이기',1,3],['rare','희귀 광석 냄새',.04,5],['crateChance','황금 상자 냄새',.05,5],['crateSeeds','묵직한 상자',1,3],['descendSeeds','내려갈 때 씨앗',2,5],['windfall','떨어지는 씨앗',1,4]]},
   {id:'sparkle',prefix:'mastery',name:'반짝 일격',color:'#7fd3c4',costs:[3,5,8,12],chain:[['crit','반짝 감각',.05,3],['critDamage','아프게 콕',.25,2],['crit','행운의 일격',.07,2],['crit','대담한 햄찌',.08,2]]},
   {id:'gear',prefix:'mastery',name:'햄찌 장비',color:'#80cabc',costs:[3,5,8,12],chain:[['crew','햄찌 증원',1,2],['traitCharge','충전 곡괭이',1,1],['traitLevel','특성 숙련',1,3],['traitSlot','특성 칸',1,1]]},
   {id:'flag',prefix:'tools',name:'해바라기 깃발',color:'#f6d55c',costs:[4,4,6,9],chain:[['flagReach','도구 상자',.1,2,'tools_root'],['flagRush','깃발로 달려가기',.15,3],['flagAura','깃발 곁 일터',.1,3],['flagReach','넓게 부르기',.15,2]]},
   {id:'bomb',prefix:'tools',name:'해바라기 폭탄',color:'#f08a4b',costs:[4,6,9],chain:[['bomb','해바라기 폭탄',1,1],['bombPower','화약 듬뿍',1,3],['bombRadius','넓게 펑',.25,2]]},
   {id:'honey',prefix:'tools',name:'꿀물 병',color:'#f2c14e',costs:[4,6,9,13],chain:[['honey','꿀물 병',1,1],['honeyTime','오래 가는 꿀',2,3],['honeyRadius','넓게 뿌리기',.3,2],['honeyRest','달콤한 휴식',10,2]]},
   {id:'mirror',prefix:'tools',name:'거울 씨앗',color:'#9fc7e6',costs:[4,6,9],chain:[['mirror','거울 씨앗',1,1],['mirrorCount','겹거울',1,2],['mirrorTime','오래 비추기',3,2]]},
   {id:'sour',prefix:'tools',name:'시큼 열매',color:'#9ecd87',costs:[4,6,9],chain:[['sour','시큼 열매',1,1],['sourRadius','시큼 퍼짐',.3,2],['sourPower','물렁물렁',.3,2]]},
   {id:'peck',prefix:'tools',name:'딱따구리 장승',color:'#b48ee0',costs:[4,6,9],chain:[['woodpecker','딱따구리 장승',1,1],['peckSpeed','부지런한 부리',.25,3],['peckPower','단단한 부리',.5,2]]},
   {id:'pot',prefix:'tools',name:'해바라기 화분',color:'#ef9699',costs:[4,6,9,13],chain:[['pot','해바라기 화분',1,1],['potHeal','촉촉한 흙',10,2],['potSeeds','씨앗 주머니',1,2],['toolExtra','준비성',1,2]]}
  ]}
];
export const treeOf=id=>MINE_TREES.find(t=>t.id===id);
// 예전 저장: 두 번째 나무의 뿌리(쉼터 care_root·도구 상자 tools_root)가 이제 갈래 첫 노드라 새 뿌리 밑에 달린다.
// 그 노드를 배운 저장은 새 뿌리를 1단계 배운 것으로 이어 준다(배운 것을 잃지 않게).
export function migrateMineLevels(levels){
 if(!levels||typeof levels!=='object')return;
 if(levels.care_root>0&&!(levels.home_root>0))levels.home_root=1;
 if(levels.tools_root>0&&!(levels.root>0))levels.root=1;
}
// 지도: 나무마다 가운데(920,920)에 뿌리, 갈래를 고르게 펼쳐 지그재그 사슬로 놓는다(화면은 나무 하나씩만 보인다).
// 갈래가 많을수록 첫 노드를 조금 더 바깥에 둬서 이웃 갈래와 겹치지 않게 한다.
function build(){
 const nodes=[];
 for(const t of MINE_TREES){
  nodes.push({id:t.root.id,name:t.root.name,tree:t.id,currency:t.currency,branch:'root',x:920,y:920,parents:[],max:t.root.max,cost:t.root.cost,effect:t.root.effect,value:t.root.value,icon:MINE_EFFECTS[t.root.effect].icon});
  const base=Math.max(170,t.branches.length*24);
  t.branches.forEach((b,bi)=>{
   const a=(-90+bi*360/t.branches.length)*Math.PI/180;let k=0,parent=t.root.id;
   b.chain.forEach(([effect,name,value,max,fixed],i)=>{
    const r=base+i*88,side=i%2?40:-40,id=fixed??`${b.prefix}_${b.id}_${k++}`;
    nodes.push({id,name,tree:t.id,currency:t.currency,branch:b.id,x:Math.round(920+Math.cos(a)*r-Math.sin(a)*side),y:Math.round(920+Math.sin(a)*r+Math.cos(a)*side),
     parents:[parent],max,cost:b.costs[Math.min(i,b.costs.length-1)],effect,value,icon:MINE_EFFECTS[effect].icon});
    parent=id;
   });
  });
 }
 return nodes;
}
let built=null;
export const MINE_TREE={
 effects:Object.fromEntries(Object.entries(MINE_EFFECTS).map(([k,e])=>[k,{name:e.name,unit:e.unit,icon:e.icon,scale:e.scale??100}])),
 branches:MINE_TREES.flatMap(t=>t.branches.map(b=>({id:b.id,name:b.name,color:b.color,angle:0}))),
 nodes:()=>built??=build(),
 migrate:migrateMineLevels
};
// ── 황금 기운(도구 놀이터에서 황금 해바라기씨로 배운 단계 합) ──
// 단계마다 모든 햄찌의 채굴력·채굴 속도가 크게 오르고, 단계(tier)가 오를수록 광산 연출이 화려해진다(검토용 값).
export const GLORY={power:.06,speed:.02,tiers:[1,6,15,30,50]};
export const gloryTier=levels=>GLORY.tiers.filter(t=>levels>=t).length;
// 탐사를 시작할 때 마스터리 효과를 한 번에 모아 둔다(탐사 중에 배운 것은 다음 탐사부터).
// 채굴력·채굴 속도·정산 씨앗은 miningGrowth가 따로 합친다.
export function miningMods(bonus){
 const out={};for(const k of Object.keys(MINE_EFFECTS))if(!['damage','speed','stones'].includes(k))out[k]=bonus(k)||0;
 return out;
}
