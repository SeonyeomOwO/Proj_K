import {SEASON,SEASON_REWARDS} from '../data/season-pass.js';
import {seasonStatus,seasonQuests,seasonDaily,seasonRewardState} from './season-state.js';
const icon=id=>`<span class="icon" data-icon="${id}"></span>`;
const art=id=>id.startsWith('shop_')?`<img class="sp-art" src="assets/shop/exported/png/${id}.webp" alt="">`:icon(id);
const button=(act,text,extra='',cls='')=>`<button type="button" class="sp-button ${cls}" data-act="${act}" ${extra}>${text}</button>`;
const num=n=>n.toLocaleString('ko-KR');
const ticket='<img class="sp-ticket" src="assets/season-pass/parts/pass-ticket.svg" alt="">';
export const seasonTitle=()=>ticket+'광부 시즌 패스';
// 처음 보일 보상의 첫 레벨: 지금 레벨의 바로 앞 레벨부터(맨 끝에서는 마지막 4칸)
export const seasonStart=level=>Math.min(SEASON.maxLevel-3,Math.max(1,level-1));
function card(s,row,track,status,now){
  const reward=row[track],state=seasonRewardState(s,track,row.level,now),ready=state==='ready',done=state==='claimed';
  return `<button type="button" class="sp-reward ${track} ${state}" data-act="season-reward" data-id="${track}:${row.level}" data-season="${status.token}" aria-label="${row.level}레벨 ${track==='free'?'무료':'프리미엄'} ${reward.label} ${reward.amount}${ready?' 받기':done?' 수령 완료':' 잠김'}" ${ready?'':'disabled'}>
    <span class="sp-reward-art">${art(reward.art)}</span><strong>${num(reward.amount)}</strong>
    ${done?`<span class="sp-card-state">${icon('check')}</span>`:!ready?`<span class="sp-card-state">${icon('lock')}</span>`:''}
    ${ready?'<span class="sp-mini-claim">받기</span>':''}</button>`;
}
// 레벨 한 칸 = [무료 보상] [레벨 표시 + 길] [프리미엄 보상]. 50칸을 가로로 이어 붙인 띠를 좌우로 밀어서(마우스는 끌어서) 본다.
function column(s,row,status,now){
  return `<div class="sp-col" data-level="${row.level}">
    <div class="sp-cell free">${card(s,row,'free',status,now)}</div>
    <div class="sp-cell rail"><b class="sp-milestone ${row.level<=status.level?'earned':''} ${row.level===status.level?'current':''}">${row.level}</b></div>
    <div class="sp-cell prem">${card(s,row,'premium',status,now)}</div>
  </div>`;
}
// 오늘의 임무 줄: 단계마다 한 줄. 진행 게이지는 같은 종류의 모든 단계가 오늘 쌓인 양을 함께 쓴다.
const tierButton={locked:['진행 중','cream',false],ready:['받기','',true],claimed:['완료','cream',false],again:['다시받기','again',true],done:['완료','cream',false],maxed:['최고 레벨','cream',false]};
function questRow(q,tier,status){
  const [label,cls,on]=tierButton[tier.state];
  return `<article class="sp-quest sp-panel ${tier.state}"><div class="sp-quest-icon">${icon(q.icon)}</div><div class="sp-quest-detail"><h4>${q.title} <em>${tier.index+1}단계</em></h4><p>${q.text.replace('{n}',num(tier.target))}</p><div class="sp-meter-line"><div class="sp-small-meter"><i style="width:${Math.min(100,q.value/tier.target*100)}%"></i></div><small>${num(Math.min(q.value,tier.target))}/${num(tier.target)}</small></div></div><b class="sp-quest-xp"><span>XP</span> +${num(tier.xp)}</b>${button('season-quest',label,`data-id="${q.id}:${tier.index}" data-season="${status.token}" ${on?'':'disabled'}`,cls)}</article>`;
}
function dailyNote(day){
  if(day.maxed)return '최고 레벨 달성!';
  if(day.complete)return day.claimable?'오늘 임무 달성! 받지 않은 보상은 내일 사라져요':'오늘 임무 완료 · 내일 새 임무가 나와요';
  return `오늘 ${day.reached}/${day.total} 달성${day.claimable?' · 받을 보상이 있어요':''}`;
}export function seasonBody(s,{start=1,confirm=false,tab='',now=Date.now()}={}){
  const status=seasonStatus(s,now),p=s.season;
  start=Math.max(1,Math.min(SEASON.maxLevel-3,start));
  const quests=seasonQuests(s,now),day=seasonDaily(s,now);
  // 탭: 지정이 없거나 없는 값이면 받을 보상이 있는 종류, 없으면 아직 덜 한 종류, 그것도 없으면 첫 종류
  const active=quests.find(q=>q.id===tab)||quests.find(q=>q.claimable)||quests.find(q=>!q.reached)||quests[0];
  const readyRewards=SEASON_REWARDS.some(row=>['free','premium'].some(track=>seasonRewardState(s,track,row.level,now)==='ready'));
  const ready=readyRewards||quests.some(q=>q.claimable>0);
  return `<div class="sp-content">
    <section class="sp-banner"><img src="assets/season-pass/season-copper-art-v1.webp" alt="광석을 안고 인사하는 햄스터"><div class="sp-season-name"><b><em>시즌 ${String(status.index).padStart(2,'0')}</em> · ${SEASON.title}</b><span>시즌 종료까지 ${status.days}일</span></div></section>
    <section class="sp-xp sp-panel"><b class="sp-level">Lv.${status.level}</b><div class="sp-xp-body"><div class="sp-xp-title">패스 경험치 <small>최대 ${SEASON.maxLevel}레벨</small></div><div class="sp-meter" role="progressbar" aria-label="패스 경험치" aria-valuenow="${status.xp}" aria-valuemin="0" aria-valuemax="${SEASON.xpPerLevel}"><i style="width:${status.xp/SEASON.xpPerLevel*100}%"></i></div><b class="sp-xp-number">${status.maxed?'최고 레벨 달성':`${status.xp} / ${SEASON.xpPerLevel}`}</b></div></section>
    <section class="sp-track sp-wood"><div class="sp-track-heading"><h3>무료 보상</h3></div>
      <div class="sp-carousel"><div class="sp-strip" tabindex="0" role="group" aria-label="레벨별 보상 · 좌우로 밀어서 보기"><span class="sp-rail-track" aria-hidden="true"></span><span class="sp-rail-fill" style="--n:${status.maxed?status.level-1:status.level-1+status.xp/SEASON.xpPerLevel}" aria-hidden="true"></span>${SEASON_REWARDS.map(row=>column(s,row,status,now)).join('')}</div><span class="sp-premium-label">프리미엄 보상</span></div>
      ${status.premium?'<div class="sp-premium-active">✓ 프리미엄 패스 이용 중</div>':button('season-buy',ticket+'프리미엄 패스 해금 <small>₩'+num(SEASON.price)+'</small>',`data-season="${status.token}"`,'sp-unlock')}
      <p class="sp-note">${status.premium?'달성한 레벨의 무료·프리미엄 보상을 모두 받아요':'해금하면 달성한 레벨의 보상도 받아요'}</p>
    </section>
    <section class="sp-quests sp-wood"><div class="sp-quest-heading"><h3>오늘의 임무</h3><div class="sp-qtabs" role="tablist" aria-label="임무 종류">${quests.map(q=>`<button type="button" role="tab" class="sp-qtab ${q.id===active.id?'on':''}${q.claimable?' has':''}" aria-selected="${q.id===active.id}" data-act="season-tab" data-id="${q.id}">${q.short}</button>`).join('')}</div></div>${active.tiers.map(tier=>questRow(active,tier,status)).join('')}<small class="sp-day-note ${day.complete?'done':''}">${dailyNote(day)}</small></section>
    <footer class="sp-footer">${button('season-all','보상 모두 받기',`data-season="${status.token}" ${ready?'':'disabled'}`,'blue')}<small>시즌 보상은 종료 전 수령해 주세요</small></footer>
    ${confirm?`<div class="sp-confirm-shade"><section class="sp-confirm sp-panel" aria-label="프리미엄 패스 구매 확인"><h3>프리미엄 시즌 패스</h3>${ticket}<strong>₩${num(SEASON.price)}</strong><p>이번 시즌의 프리미엄 보상 해금<br>이미 달성한 레벨의 보상도 수령 가능</p><p>현재 시즌 종료까지 ${status.days}일<br><small>다음 시즌에는 새 패스가 시작됩니다.</small></p><small>로컬 테스트 구매 · 실제 결제는 되지 않아요</small>${button('season-buy-confirm','해금하기',`data-season="${status.token}"`)}${button('season-buy-cancel','취소','','cream')}</section></div>`:''}
  </div>`;
}

// 보상 띠를 좌우로 미끄러지듯 넘긴다(페이지 단위가 아니라 어느 자리에서든 멈춘다).
//  · 터치: 브라우저의 가로 스크롤(밀면 따라오고 놓으면 관성으로 미끄러지다 멈춘다)
//  · 마우스: 눌러서 끌기. 놓을 때 속도가 남아 있으면 같은 느낌으로 미끄러진다. 끈 직후의 클릭은 막아 보상 받기가 눌리지 않게 한다.
//  · 키보드: 띠에 초점이 있을 때 ←/→로 한 칸 만큼 부드럽게
// start: 처음에 맨 왼쪽에 둘 레벨(소수 가능), onPage(레벨): 스크롤 위치가 바뀔 때마다 부른다(다시 그려도 같은 자리를 보게 하려고)
export function bindSeasonCarousel(root,{start=1,onPage=()=>{}}={}){
  const strip=root.querySelector('.sp-strip');
  if(!strip)return;
  const stride=()=>strip.clientWidth/4,maxLeft=()=>strip.scrollWidth-strip.clientWidth;
  const clampLeft=x=>Math.max(0,Math.min(maxLeft(),x));
  strip.scrollLeft=clampLeft((Math.max(1,start)-1)*stride());
  strip.addEventListener('scroll',()=>onPage(strip.scrollLeft/stride()+1),{passive:true});
  let drag=null,suppress=false,glide=0;
  const stop=()=>{if(glide){cancelAnimationFrame(glide);glide=0;}};
  strip.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='mouse'||e.button!==0)return;
    stop();
    drag={x:e.clientX,left:strip.scrollLeft,moved:false,samples:[[performance.now(),e.clientX]]};
  });
  const move=e=>{
    if(!drag)return;
    const dx=e.clientX-drag.x;
    if(!drag.moved&&Math.abs(dx)>6){drag.moved=true;strip.classList.add('dragging');}
    if(!drag.moved)return;
    strip.scrollLeft=drag.left-dx;
    const now=performance.now();
    drag.samples.push([now,e.clientX]);
    while(drag.samples.length>2&&now-drag.samples[0][0]>100)drag.samples.shift();
  };
  const up=()=>{
    if(!drag)return;
    const {moved,samples}=drag;
    drag=null;
    strip.classList.remove('dragging');
    if(!moved)return;
    suppress=true;
    setTimeout(()=>{suppress=false;},0);
    // 놓기 직전 100ms의 손 속도(px/ms)로 미끄러진다: 시간이 지나며 속도가 줄고, 끝에 닿으면 멈춘다
    const a=samples[0],b=samples[samples.length-1];
    let v=b[0]>a[0]?-(b[1]-a[1])/(b[0]-a[0]):0,last=performance.now();
    if(Math.abs(v)<.05)return;
    const step=t=>{
      const dt=Math.min(32,t-last);last=t;
      const before=strip.scrollLeft;
      strip.scrollLeft=before+v*dt;
      v*=Math.pow(.994,dt);
      if(Math.abs(v)<.02||strip.scrollLeft===before){glide=0;return;}
      glide=requestAnimationFrame(step);
    };
    glide=requestAnimationFrame(step);
  };
  window.addEventListener('pointermove',move);
  window.addEventListener('pointerup',up);
  window.addEventListener('pointercancel',up);
  strip.addEventListener('wheel',stop,{passive:true});
  strip.addEventListener('touchstart',stop,{passive:true});
  // 끌고 난 직후의 클릭은 받기 버튼으로 가지 않게 막는다
  strip.addEventListener('click',e=>{if(suppress){e.stopPropagation();e.preventDefault();}},true);
  strip.addEventListener('keydown',e=>{
    if(e.key==='ArrowRight'){e.preventDefault();stop();strip.scrollBy({left:stride(),behavior:'smooth'});}
    else if(e.key==='ArrowLeft'){e.preventDefault();stop();strip.scrollBy({left:-stride(),behavior:'smooth'});}
  });
  // 모달이 다시 그려져 띠가 사라지면 창 단위 리스너를 걷는다
  const watch=new MutationObserver(()=>{
    if(strip.isConnected)return;
    stop();
    window.removeEventListener('pointermove',move);
    window.removeEventListener('pointerup',up);
    window.removeEventListener('pointercancel',up);
    watch.disconnect();
  });
  watch.observe(root,{childList:true,subtree:true});
}