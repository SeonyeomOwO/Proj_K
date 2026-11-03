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
 pajamas:{name:'잠옷',description:'작업 중 잠들면 그 자리에서 최대 2회 더 타격',skin:'star'}
};
export const miningPeriod=(h,cell)=>h.trait==='drill'?(cell?.texture==='dense'?.52:.65):h.period;
export function equipTrait(s,id,trait){
 const h=s.crew.find(h=>h.id===id);if(!h||!TRAITS[trait]||s.time!==0)return false;
 if(trait!=='none'&&s.crew.some(o=>o!==h&&o.trait===trait))return false;
 h.trait=trait;h.skin=TRAITS[trait].skin??h.baseSkin;return true;
}
