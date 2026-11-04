// Review balance, not geological hardness or final currency exchange rates.
export const MINING_RULES={
 stone:{hits:2,value:1,texture:'soft'},copper:{hits:3,value:2,texture:'vein'},jade:{hits:3,value:2,texture:'vein'},
 quartz:{hits:3,value:2,texture:'soft'},amethyst:{hits:4,value:4,texture:'dense'},
 pyrite:{hits:4,value:3,texture:'cluster'},malachite:{hits:3,value:2,texture:'cluster'},
 azurite:{hits:4,value:4,texture:'vein'},fluorite:{hits:3,value:3,texture:'soft'},
 rhodochrosite:{hits:4,value:4,texture:'vein'},hematite:{hits:5,value:5,texture:'dense'},aquamarine:{hits:5,value:5,texture:'dense'}
};
export const mineralRule=(kind,mode='varied')=>mode==='legacy'?{hits:kind==='stone'?2:3,value:1,texture:'legacy'}:MINING_RULES[kind]??MINING_RULES.stone;
export const TRAITS={
 none:{name:'기본 곡괭이',description:'기본 채굴과 운반'},
 workwear:{name:'작업복',description:'지쳐도 채굴 속도를 70% 이상 유지',skin:'farmer'},
 drill:{name:'드릴',description:'고정된 빠른 속도 · 단단한 광맥에 유리 · 체력 소모 2.4배',skin:'miner'},
 dynamite:{name:'다이너마이트',description:'붙어 있는 지층 최대 5칸 파괴 후 잠듦 · 직접 운반하려면 돌봄 필요',skin:'explorer'},
 pajamas:{name:'잠옷',description:'작업 중 잠들면 그 자리에서 최대 2회 더 타격',skin:'star'},
 // 2026-11-04 마스터리로 여는 특성(레퍼런스의 '시간마다 피해가 쌓이는 장비'): 층마다 처음부터 다시 쌓인다
 charge:{name:'충전 곡괭이',description:'7초마다 채굴력 +10%가 쌓임 · 층마다 처음부터',skin:'miner',mastery:'traitCharge'}
};
// 특성 칸이 둘(마스터리 '특성 칸')이라 두 칸 중 하나에 있으면 그 특성을 가진 것으로 본다.
export const hasTrait=(h,id)=>h.trait===id||h.trait2===id;
// 특성 숙련(마스터리, 가챠 전 임시): 단계마다 특성 효과가 세진다. h.traitLevel은 출발할 때 정해진다.
export const TRAIT_LEVEL={workwear:.08,drill:.08,drillDrain:.3,dynamiteFuse:.4,pajamasHits:1,chargeStep:.05};
export const CHARGE={every:7,step:.1};
export const chargeBonus=h=>hasTrait(h,'charge')?Math.floor((h.charge??0)/CHARGE.every)*(CHARGE.step+TRAIT_LEVEL.chargeStep*(h.traitLevel??0)):0;
export const miningPeriod=(h,cell)=>hasTrait(h,'drill')?(cell?.texture==='dense'?.52:.65)*(1-TRAIT_LEVEL.drill*(h.traitLevel??0)):h.period;
export function equipTrait(s,id,trait){
 const h=s.crew.find(h=>h.id===id);if(!h||!TRAITS[trait]||s.time!==0)return false;
 if(trait!=='none'&&s.crew.some(o=>o!==h&&hasTrait(o,trait)))return false;
 h.trait=trait;h.skin=TRAITS[trait].skin??h.baseSkin;return true;
}
