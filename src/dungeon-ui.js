import {DUNGEONS} from '../data/dungeons.js';
import {dungeonStatus, dungeonLife} from './dungeon-state.js';
const SEC = DUNGEONS.mine.seconds;
const number = n => Math.floor(n).toLocaleString('ko-KR');
const icon = id => `<svg class="dg-icon" aria-hidden="true"><use href="assets/dungeon/ui-icons.svg#${id}"/></svg>`;
const art = (name,cls='') => `<img class="${cls}" src="assets/dungeon/${name}-v1.webp" alt="" draggable="false">`;
const reward = (id,cls='') => `<img class="dg-reward-art ${cls}" src="assets/${id.startsWith('shop_')?'shop':'season-pass'}/exported/png/${id}.webp" alt="">`;
const button=(act,label,extra='',cls='')=>`<button type="button" class="dg-button ${cls}" data-act="${act}" ${extra}>${label}</button>`;
export const dungeonTitle = page => page==='mine'?DUNGEONS.mine.name:page==='tower'?DUNGEONS.tower.name:'던전';
export const dungeonViewStamp = (s,page,now=Date.now()) => JSON.stringify([page,dungeonStatus(s,now).remaining,s.dungeon?.kind,s.dungeon?.startedAt,s.dungeonProgress,s.draft!==null,!!s.rubyStage]);

function selection(s,st){
  const card=(kind,name,copy,left,right)=>`<button type="button" class="dg-card ${kind}" data-act="dungeon-select" data-id="${kind}" aria-label="${name} 상세 보기"><span class="dg-banner">${art(kind==='mine'?'diamond-banner':'tower-banner')}<span class="dg-card-copy"><strong>${name}</strong><span>${copy}</span></span>${s.dungeon?.kind===kind?'<em class="dg-playing">채굴 중</em>':''}</span><span class="dg-card-meta">${left}${right}<span class="dg-card-arrow">${icon('next')}</span></span></button>`;
  return `<div class="dg-content dg-selection"><div class="dg-welcome">${reward('shop_bundle','dg-mascot')}<span>햄찌단과 함께 떠나는<br><b>새로운 광산 탐험!</b></span></div>${card('mine','다이아 광산',SEC+'초 동안 다이아를 최대한 채굴!',`<span>${icon('clock')}제한 시간 <b>${SEC}초</b></span>`,`<span>${icon('ticket')}오늘 입장 <b>${st.remaining}/${DUNGEONS.mine.entries}</b></span>`)}${card('tower','무한의 광산탑','한 층씩, 더 높은 곳을 향해!',`<span>${icon('stairs')}다음 도전 <b>${number(st.floor)}층</b></span>`,`<span>${icon('crown')}최고 기록 <b>${number(st.best)}층</b></span>`)}<p class="dg-foot">도전할 던전을 선택해 주세요</p></div>`;
}

export function dungeonBody(s,{page='select',leaveConfirm=false,now=Date.now()}={}){
  const st=dungeonStatus(s,now);
  if(!['mine','tower'].includes(page))return selection(s,st);
  const mine=page==='mine',run=s.dungeon?.kind===page?s.dungeon:null;
  const result=!run&&st.result?.kind===page?st.result:null;
  // 광산은 60초를 채웠을 때, 광산탑은 이번 도전에서 한 층이라도 올랐을 때 "완료"로 본다
  const completed=mine?result?.reason==='complete':(result?.cleared||0)>0;
  const floor=run?.level || (result&&completed&&!mine?result.floor:st.floor);
  const disabled=!!s.dungeon || !!s.draft || !!s.rubyStage || (mine&&!st.remaining);
  const info=mine?`<span>${icon('clock')}<span>${run?'남은 시간':'제한 시간'} <b data-dg-time>${run?Math.ceil(Math.max(0,SEC-run.elapsed)):SEC}초</b></span></span><span>${icon('ticket')}<span>오늘 입장 <b>${st.remaining}/${DUNGEONS.mine.entries}</b></span></span>`:`<span>${icon('stairs')}<span>${completed?'돌파':'도전'} <b>${number(floor)}층</b></span></span><span>${icon('crown')}<span>최고 기록 <b>${number(st.best)}층</b></span></span>`;
  const floorList=[floor+2,floor+1,floor,Math.max(1,floor-1)].filter((f,i,arr)=>arr.indexOf(f)===i);
  const rail=mine?'':`<div class="dg-rail" aria-label="광산탑 층 진행"><span class="dg-rail-arrow">↑</span>${floorList.map(f=>`<span class="${f===floor?'current':f<=st.best?'cleared':''}">${f<floor?'✓ ':''}${number(f)}층</span>`).join('')}</div>`;
  const progress=`<div class="dg-battle-status" ${run?'':'hidden'}><div class="dg-hp-title"><span>${mine?'다이아 결정':'광석 내구도'}</span><b data-dg-hp></b></div><div class="dg-meter" role="progressbar" aria-label="광석 내구도" aria-valuemin="0" aria-valuemax="100"><i data-dg-fill></i></div><span class="dg-live-caption">${mine?'채굴한 다이아 ':'햄찌단이 자동으로 채굴하고 있어요'}${mine?'<b data-dg-earned>0</b>':''}</span></div>`;
  const resultCard=result?`<div class="dg-result" role="status"><strong>${mine?(completed?'채굴 완료!':'채굴을 마쳤어요'):(completed?number(result.floor)+'층 돌파!':'다음에 다시 도전해요')}</strong><span>${mine?'캔 다이아가 지급되었어요 · '+number(result.floor)+'회차까지':completed?number(result.cleared)+'개 층을 올랐어요!':'클리어한 층은 그대로 유지돼요'}</span><div>${reward('shop_gems')}<b>+${number(result.diamond)}</b>${result.ruby?reward('ruby')+'<b>+'+number(result.ruby)+'</b>':''}</div></div>`:'';
  const rewardBox=mine?`<div class="dg-reward-box"><h3>${run?'반짝이는 다이아를 채굴 중!':SEC+'초 동안 최대한 많이 캐세요!'}</h3><div class="dg-mine-reward">${reward('shop_gem_bag')}<span><b>채굴 보상</b><span>${run?'현재 획득 <b data-dg-earned>0</b> 다이아':result?'이번 채굴 <b>'+number(result.diamond)+'</b> 다이아':'캐낸 다이아만큼 획득'}</span></span></div></div>`:`<div class="dg-reward-box dg-tower-reward"><h3>${completed?'다음 층 클리어 보상':'층 클리어 보상'}</h3><div><span>${reward('shop_gems')}<b>다이아 ${number(st.rewards.diamond)}</b></span><span>${reward('ruby')}<b>루비 ${number(st.rewards.ruby)}</b></span></div></div>`;
  const label=run?(mine?'채굴 마치기':'도전 중단'):mine?(!st.remaining?'오늘 입장 완료':result?'다시 채굴':'채굴 시작'):(completed?'다음 '+number(st.floor)+'층 도전':number(st.floor)+'층 도전');
  const help=s.draft?'현재 빌드를 먼저 완성해 주세요':s.rubyStage?'루비 바위를 마친 뒤 입장할 수 있어요':mine?'하루 '+DUNGEONS.mine.entries+'회 · 매일 오전 9시 입장 횟수 초기화':'광석을 깨고 다음 층으로 올라가세요!';
  const confirm=leaveConfirm?`<div class="dg-confirm-shade"><section class="dg-confirm" role="dialog" aria-modal="true" aria-label="던전 나가기"><h3>${mine?'채굴을 마칠까요?':'도전을 중단할까요?'}</h3><p>${mine?'지금까지 캔 다이아는 유지됩니다.<br>사용한 입장 횟수는 돌아오지 않아요.':'이 층의 광석은 처음부터 다시 채굴해요.<br>최고 기록은 그대로 유지됩니다.'}</p>${button('dungeon-leave-cancel','계속 채굴')}${button('dungeon-leave','나가기','','cream')}</section></div>`:'';
  return `<div class="dg-content dg-detail ${mine?'mine':'tower'} ${run?'is-running':''}" data-reduced-motion="${!s.settings.motion}"><div class="dg-info">${info}</div><div class="dg-room">${art(mine?'diamond-room':'tower-room')}${rail}${progress}${resultCard}<div class="dg-hit-layer" aria-hidden="true"></div></div>${rewardBox}<p class="dg-help">${help}</p><div class="dg-actions">${button(run?'dungeon-stop':'dungeon-back',icon('back'),'aria-label="던전 목록으로"','back')}${button(run?'dungeon-stop':'dungeon-start',label,`data-id="${page}" ${!run&&disabled?'disabled':''}`,run?'cream':'')}</div><p class="dg-foot">${mine?(run?'종료 전에 캔 다이아도 지급돼요':'입장 시 횟수 사용 · 채굴량만큼 다이아 지급'):'한 층씩, 더 높은 곳을 향해!'}</p>${confirm}</div>`;
}

// 진행 중인 던전에서 나가기를 눌렀을 때: 던전 창 없이 이 카드만 뜬다
export function dungeonExitBody(kind){
  const mine=kind==='mine';
  return `<div class="dg-bare"><section class="dg-confirm" role="alertdialog" aria-label="던전 나가기"><h3>${mine?'채굴을 마칠까요?':'도전을 중단할까요?'}</h3><p>${mine?'지금까지 캔 다이아는 유지됩니다.<br>사용한 입장 횟수는 돌아오지 않아요.':'이 층의 광석은 처음부터 다시 채굴해요.<br>최고 기록은 그대로 유지됩니다.'}</p>${button('dungeon-leave-cancel','계속 채굴')}${button('dungeon-leave','나가기','','cream')}</section></div>`;
}

export function updateDungeonLive(root,s){
  const d=s.dungeon;if(!d)return;
  root.querySelectorAll('[data-dg-time]').forEach(el=>el.textContent=Math.max(0,Math.ceil(DUNGEONS.mine.seconds-d.elapsed))+'초');
  root.querySelectorAll('[data-dg-earned]').forEach(el=>el.textContent=number(d.earned));
  const life=dungeonLife(s);
  root.querySelectorAll('[data-dg-hp]').forEach(el=>el.textContent=number(Math.ceil(life.hp))+' / '+number(life.max));
  const percent=Math.max(0,Math.min(100,100*life.hp/life.max));
  root.querySelectorAll('[data-dg-fill]').forEach(el=>el.style.width=percent+'%');
  root.querySelectorAll('.dg-meter').forEach(el=>el.setAttribute('aria-valuenow',Math.round(percent)));
}

export function dungeonEffects(root,events,motion=true){
  if(!motion)return;
  const layer=root.querySelector('.dg-hit-layer');if(!layer)return;
  for(const e of events){
    if((e.type!=='hit'||!e.dungeon)&&e.type!=='dungeonGem')continue;
    if(layer.childElementCount>=6)break;
    const el=document.createElement('span');el.className=e.type==='dungeonGem'?'dg-float gem':'dg-float';
    el.textContent=e.type==='dungeonGem'?'◆ +'+number(e.amount):number(e.damage)+(e.crit?'!':'');
    el.style.setProperty('--drift',(Math.random()*50-25)+'px');layer.append(el);
    el.addEventListener('animationend',()=>el.remove(),{once:true});
  }
}
