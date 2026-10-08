// First-page discovery and repeatable growth share positions and art.
export const MASTERY_RULES = Object.freeze({version:2, nodeLevels:3, levelPriceGrowth:1.5, repeatPriceGrowth:.22, sealCost:120, rerolls:3, minInterval:.12});
export const EFFECTS = {
 damage:{name:'채굴력',unit:'%',icon:'pickaxe'}, speed:{name:'채굴 속도',unit:'%',icon:'fast'},
 crit:{name:'치명타 확률',unit:'%p',icon:'focus'}, critDamage:{name:'치명타 배율',unit:'%p',icon:'focus'},
 stones:{name:'돌 획득량',unit:'%',icon:'stone'}, ruby:{name:'환생 루비',unit:'%',icon:'ruby'},
 offline:{name:'오프라인 효율',unit:'%p',icon:'cart'}, chain:{name:'연쇄 피해',unit:'%',icon:'lightning'}
};
export const BRANCHES = [
 {id:'power',name:'단단한 앞발',color:'#eab45d',angle:-90, effects:['damage','damage','critDamage','damage','damage'],names:['작은 힘','굳은 손','무거운 한 방','강철 손목','광맥 전문가'],unlock:'cleave'},
 {id:'speed',name:'쫀쫀한 손놀림',color:'#74c6ea',angle:-30,effects:['speed','damage','speed','critDamage','speed'],names:['가벼운 손','몸풀기','빠른 박자','정확한 리듬','숙련된 스윙'],unlock:'execution'},
 {id:'fortune',name:'반짝이는 감각',color:'#c3a0ea',angle:30,effects:['crit','critDamage','crit','chain','crit'],names:['약점 발견','날카로운 감각','집중의 눈','울림의 결','행운의 일격'],unlock:'keen'},
 {id:'stone',name:'알뜰한 광산',color:'#9ecd87',angle:90,effects:['stones','stones','damage','stones','stones'],names:['자투리 줍기','넓은 광차','단단한 바닥','광석 감별','가득 찬 창고'],unlock:'prospector'},
 {id:'ruby',name:'붉은 기억',color:'#ef9699',angle:150,effects:['ruby','damage','ruby','critDamage','ruby'],names:['첫 기억','다시 드는 힘','선명한 기억','깊은 깨달음','이어진 기억'],unlock:'thrift'},
 {id:'rest',name:'꾸준한 작업',color:'#80cabc',angle:210,effects:['offline','chain','offline','chain','offline'],names:['편안한 쉼','이어진 광맥','야간 작업','번개의 길','밤새 채굴'],unlock:'echo'}
];
export const UNLOCK_SKILLS = [
 {id:'cleave',name:'부채꼴 타격',icon:'pickaxe',color:'gold',role:'core',desc:'매 타격마다 가까운 광석 2개에 추가 피해'},
 {id:'execution',name:'마무리 일격',icon:'explosion',color:'red',role:'support',desc:'체력 30% 이하 광석에 레벨당 피해 +5%'},
 {id:'keen',name:'날 선 곡괭이',icon:'focus',color:'green',role:'support',desc:'레벨마다 치명타 배율 +6%p'},
 {id:'prospector',name:'보물 감별사',icon:'chest',color:'gold',role:'support',desc:'레벨마다 돌 획득량 +6%'},
 {id:'thrift',name:'알뜰한 강화',icon:'stone',color:'blue',role:'support',desc:'강화 비용 레벨당 1% 할인 · 최대 35%'},
 {id:'echo',name:'메아리 증폭',icon:'amplify',color:'blue',role:'support',desc:'연쇄·폭발·부채꼴 피해 레벨당 +6%'}
];
const VALUES={damage:.04,speed:.02,crit:.005,critDamage:.03,stones:.03,ruby:.01,offline:.02,chain:.04};
const REPEAT={speed:'damage',crit:'critDamage',offline:'stones'};
const offsets=[[-32,170],[46,293],[-56,420],[55,548],[0,674]];
const price=[4,6,9,12,16];
const cache=new Map();
export function masteryNodes(page=1){
 const key=page===1?1:2;if(cache.has(key))return cache.get(key);
 const nodes=[{id:'root',name:'작은 첫걸음',branch:'root',x:920,y:920,parents:[],max:1,cost:5,effect:'damage',value:.1,icon:'pickaxe'}];
 for(const b of BRANCHES){
  const a=b.angle*Math.PI/180,point=(side,r)=>({x:Math.round(920+Math.cos(a)*r-Math.sin(a)*side),y:Math.round(920+Math.sin(a)*r+Math.cos(a)*side)});
  offsets.forEach(([side,r],i)=>{const original=b.effects[i],effect=page>1?(REPEAT[original]||original):original;
   nodes.push({id:b.id+'_'+i,name:page>1&&effect!==original?EFFECTS[effect].name+' 수련':b.names[i],branch:b.id,...point(side,r),parents:[i?b.id+'_'+(i-1):'root'],max:3,cost:price[i],effect,value:VALUES[effect],icon:EFFECTS[effect].icon});});
  if(page===1){const sk=UNLOCK_SKILLS.find(s=>s.id===b.unlock);nodes.push({id:'unlock_'+b.unlock,name:sk.name,branch:b.id,...point(0,815),parents:[b.id+'_4'],max:1,cost:24,unlock:b.unlock,icon:sk.icon});}
 }
 cache.set(key,nodes);return nodes;
}
export const priceFactor=page=>page<=2?1:1+MASTERY_RULES.repeatPriceGrowth*(page-2);
export const masteryPrice=(n,level,page)=>Math.ceil(n.cost*MASTERY_RULES.levelPriceGrowth**level*priceFactor(page));
export const sealPrice=page=>Math.ceil(MASTERY_RULES.sealCost*priceFactor(page));
