// 뉴 햄찌 광산 마스터리 지도(2026-11-04, 황금 해바라기씨로 배움). 기존판 지도(data/mastery.js) 대신 끼운다.
// 효과 31종을 6갈래(던지기·햄찌·공과 돌봄·수레·광산과 보상·특성)에 사슬로 놓는다. 숫자는 전부 검토용 값 —
// 실제로 플레이하며 넣고 빼고 조정한다. 레퍼런스(Hole Is Mine)에서 확인한 것: 던지기 거리, 튕김, 복제(그림자 햄찌),
// 시간마다 쌓이는 피해(충전 곡괭이), 일정 시간마다 생기는 보상.
// scale: 화면에 보일 때 곱하는 수(%는 100, 개수·초는 1). value: 한 단계당 오르는 값(게임 안에서 그대로 더해 쓴다).
export const MINE_EFFECTS={
 throwRange:{name:'던지기 거리',unit:'%',icon:'fast',value:.1,max:5},
 impact:{name:'부딪힘 피해',unit:'%',icon:'pickaxe',value:.5,max:4},
 bounce:{name:'던지기 튕김',unit:'번',scale:1,icon:'amplify',value:1,max:3},
 pierce:{name:'던지기 관통',unit:'개',scale:1,icon:'lightning',value:1,max:2},
 landShock:{name:'착지 충격',unit:'%',icon:'explosion',value:.25,max:4},
 shadow:{name:'그림자 햄찌',unit:'초',scale:1,icon:'focus',value:3,max:3},
 combo:{name:'연속 던지기 속도',unit:'%',icon:'fast',value:.15,max:3},
 crew:{name:'햄찌 증원',unit:'마리',scale:1,icon:'mastery',value:1,max:2},
 damage:{name:'채굴력',unit:'%',icon:'pickaxe',value:.08,max:5},
 speed:{name:'채굴 속도',unit:'%',icon:'fast',value:.05,max:5},
 walk:{name:'걷기 속도',unit:'%',icon:'fast',value:.08,max:3},
 wade:{name:'물길 걷기',unit:'%p',icon:'fast',value:.15,max:3},
 carry2:{name:'두 개 나르기',unit:'개',scale:1,icon:'cart',value:1,max:1},
 stamina:{name:'기운 최대치',unit:'',scale:1,icon:'mastery',value:10,max:5},
 thrift:{name:'기운 아끼기',unit:'%',icon:'mastery',value:.06,max:5},
 ballCap:{name:'공 용량',unit:'개',scale:1,icon:'stone',value:2,max:5},
 feed:{name:'씨앗 회복량',unit:'',scale:1,icon:'stone',value:8,max:5},
 ballBounce:{name:'공 튕김',unit:'%p',icon:'amplify',value:.08,max:3},
 fullness:{name:'배부름 한도',unit:'칸',scale:1,icon:'stone',value:1,max:2},
 cartRange:{name:'수레 던지기 거리',unit:'%',icon:'cart',value:.15,max:3},
 cartRam:{name:'수레 박치기',unit:'타',scale:1,icon:'cart',value:1,max:3},
 magnet:{name:'수레 자석',unit:'칸',scale:1,icon:'cart',value:.5,max:3},
 cartAura:{name:'수레 곁 채굴 속도',unit:'%',icon:'cart',value:.1,max:3},
 holeEase:{name:'구멍 조건 줄이기',unit:'개',scale:1,icon:'chest',value:1,max:3},
 rare:{name:'희귀 광석',unit:'%p',icon:'chest',value:.04,max:5},
 crateChance:{name:'황금 상자 확률',unit:'%p',icon:'chest',value:.05,max:5},
 crateSeeds:{name:'상자 속 황금 씨앗',unit:'개',scale:1,icon:'chest',value:1,max:3},
 descendSeeds:{name:'내려갈 때 씨앗',unit:'개',scale:1,icon:'stone',value:2,max:5},
 windfall:{name:'떨어지는 씨앗',unit:'단계',scale:1,icon:'stone',value:1,max:4},
 stones:{name:'정산 씨앗',unit:'%',icon:'stone',value:.05,max:5},
 traitCharge:{name:'충전 곡괭이(새 특성)',unit:'',scale:1,icon:'pickaxe',value:1,max:1},
 traitLevel:{name:'특성 숙련',unit:'단계',scale:1,icon:'mastery',value:1,max:3},
 traitSlot:{name:'특성 칸',unit:'칸',scale:1,icon:'mastery',value:1,max:1}
};
// 지도 갈래(가운데 뿌리에서 바깥으로 사슬). effects 순서대로 앞 노드를 다 배워야 다음이 열린다.
export const MINE_BRANCHES=[
 {id:'throw',name:'날아라 햄찌',color:'#eab45d',angle:-90,effects:['throwRange','impact','combo','bounce','landShock','pierce','shadow']},
 {id:'crew',name:'튼튼한 햄찌',color:'#74c6ea',angle:-30,effects:['damage','speed','walk','stamina','thrift','wade','carry2','crew']},
 {id:'care',name:'공과 씨앗',color:'#9ecd87',angle:30,effects:['feed','ballCap','ballBounce','fullness']},
 {id:'cart',name:'든든한 수레',color:'#c3a0ea',angle:90,effects:['cartRange','cartRam','magnet','cartAura']},
 {id:'mine',name:'반짝이는 광산',color:'#ef9699',angle:150,effects:['stones','holeEase','rare','crateChance','crateSeeds','descendSeeds','windfall']},
 {id:'gear',name:'햄찌 장비',color:'#80cabc',angle:210,effects:['traitCharge','traitLevel','traitSlot']}
];
const STEP=[3,5,7,9,12,15,18,22];
// 기존 지도와 같은 크기(가운데 920,920)에 지그재그 사슬로 놓는다
function build(){
 const nodes=[{id:'root',name:'햄찌 광산의 첫걸음',branch:'root',x:920,y:920,parents:[],max:1,cost:5,effect:'damage',value:.05,icon:'pickaxe'}];
 for(const b of MINE_BRANCHES){
  const a=b.angle*Math.PI/180;
  b.effects.forEach((effect,i)=>{
   const e=MINE_EFFECTS[effect],r=150+i*95,side=i%2?44:-44;
   nodes.push({id:b.id+'_'+effect,name:e.name,branch:b.id,x:Math.round(920+Math.cos(a)*r-Math.sin(a)*side),y:Math.round(920+Math.sin(a)*r+Math.cos(a)*side),
    parents:[i?b.id+'_'+b.effects[i-1]:'root'],max:e.max,cost:STEP[Math.min(i,STEP.length-1)],effect,value:e.value,icon:e.icon});
  });
 }
 return nodes;
}
let built=null;
export const MINE_TREE={
 effects:Object.fromEntries(Object.entries(MINE_EFFECTS).map(([k,e])=>[k,{name:e.name,unit:e.unit,icon:e.icon,scale:e.scale??100}])),
 branches:MINE_BRANCHES.map(b=>({id:b.id,name:b.name,color:b.color,angle:b.angle})),
 nodes:()=>built??=build()
};
// 탐사를 시작할 때 마스터리 효과를 한 번에 모아 둔다(탐사 중 마스터리를 배워도 다음 탐사부터 적용).
export function miningMods(bonus){
 const out={};for(const k of Object.keys(MINE_EFFECTS))if(!['damage','speed','stones'].includes(k))out[k]=bonus(k)||0;
 return out;
}
