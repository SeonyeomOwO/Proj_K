import {restSeconds} from './state.js';
export function villageModal(name,s,{B}){
 if(name==='village-rest')return{title:'햄찌 쉼터',body:`<div class="cream-box"><h2>다 같이 푹 쉬어요</h2><p data-village-rest>${restText(s)}</p><p class="footnote">마을에서는 배부름을 관리하지 않아요.<br>햄찌들은 함께 쉬고, 함께 탐사해요.</p></div><p>쉬는 동안 대장간에서 곡괭이를 강화하거나<br>마을을 둘러볼 수 있어요.</p>`+B('mine-forge','대장간으로')+B('village-close','마을 둘러보기','cta secondary')};
 if(name==='village-travel')return{title:'어디로 갈까요?',body:`<div class="mine-menu-grid">${B('village-entrance','광산 입구')}${B('mine-forge','대장간')}${B('mastery','마스터리')}${B('village-rest','쉼터')}</div><p class="footnote">마을을 드래그해서 이동하고, 건물을 직접 눌러도 돼요.<br>휠 또는 두 손가락으로 확대·축소할 수 있어요.</p>`};
 return null;
}
export function restText(s){const left=restSeconds(s);return left?`공통 피곤함 회복까지 ${left}초`:'푹 쉬었어요. 다시 광산에 갈 수 있어요!';}
