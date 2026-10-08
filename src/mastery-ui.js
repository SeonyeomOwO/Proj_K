import * as M from './mastery-state.js';
import * as E from './engine.js';
import {BRANCHES,EFFECTS,UNLOCK_SKILLS,masteryPrice,sealPrice} from '../data/mastery.js';
const I=id=>`<span class="icon" data-icon="${id}"></span>`;
const B=(act,text,extra='',cls='cta')=>`<button type="button" class="${cls}" data-act="${act}" ${extra}>${text}</button>`;
const pct=n=>(100*n).toLocaleString('ko-KR',{maximumFractionDigits:1});
const num=n=>Math.round(n).toLocaleString('ko-KR');
export const effectText=(k,v)=>`${EFFECTS[k].name} +${pct(v)}${EFFECTS[k].unit}`;

// ── 지도 보기(이동·확대) 계산: DOM과 분리해 테스트할 수 있게 순수 함수로 둔다 ──────────────────
export const MAP_SIZE=1840, MIN_ZOOM=.4, MAX_ZOOM=1.8, TILE=96;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
export const clampZoom=z=>clamp(z,MIN_ZOOM,MAX_ZOOM);
// 화면 중앙이 지도 안에 있도록만 제한한다(끝까지 끌어도 지도를 완전히 놓치지 않음)
export function clampView(v,vw,vh){const zoom=clampZoom(v.zoom);return {zoom,x:clamp(v.x,vw/2-MAP_SIZE*zoom,vw/2),y:clamp(v.y,vh/2-MAP_SIZE*zoom,vh/2)};}
// (px,py) 아래의 지도 위 한 점이 확대·축소 뒤에도 같은 자리에 있게 한다
export function zoomAt(v,factor,px,py,vw,vh){const zoom=clampZoom(v.zoom*factor),k=zoom/v.zoom;return clampView({zoom,x:px-(px-v.x)*k,y:py-(py-v.y)*k},vw,vh);}
export function fitView(points,vw,vh,pad=170){
 if(!points.length)return clampView({zoom:1,x:vw/2-MAP_SIZE/2,y:vh/2-MAP_SIZE/2},vw,vh);
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const zoom=clampZoom(Math.min(1.1,(vw-pad)/Math.max(1,maxX-minX),(vh-pad)/Math.max(1,maxY-minY)));
 return clampView({zoom,x:vw/2-(minX+maxX)/2*zoom,y:vh/2-(minY+maxY)/2*zoom},vw,vh);
}
export const centerView=(v,x,y,vw,vh,zoom=v.zoom)=>{const z=clampZoom(zoom);return clampView({zoom:z,x:vw/2-x*z,y:vh/2-y*z},vw,vh);};
// 말풍선 배치: 아이콘 위(위 공간이 모자라면 아래), 화면 안으로 밀어 넣고 꼬리는 아이콘을 가리킨다
export function bubbleLayout(node,view,vw,vh,bw,bh,gap=18){
 const nx=node.x*view.zoom+view.x,ny=node.y*view.zoom+view.y,half=node.r*view.zoom+gap;
 let flip=false,top=ny-half-bh;
 if(top<8){flip=true;top=ny+half;}
 top=clamp(top,8,Math.max(8,vh-bh-8));
 const left=clamp(nx-bw/2,8,Math.max(8,vw-bw-8));
 return {left,top,flip,tail:clamp(nx-left,38,bw-38),nx,ny};
}
// 열려 있는 동안만 유지되는 보기 상태. 다시 그려도(구매 등) 이동·확대가 풀리지 않는다.
const view={zoom:.9,x:0,y:0,ready:false,center:null};
export const resetView=()=>{view.ready=false;view.center=null;};
export const centerOn=id=>{view.center=id;};

function action(s,n,page){
 const lv=M.nodeLevel(s,n.id),maxed=lv>=n.max,can=M.reachable(s,n),cost=masteryPrice(n,lv,page),afford=s.wallet.ruby>=cost;
 const state=maxed?'maxed':!can?'locked':!afford?'short':'ok';
 const label=maxed?'최고 레벨':!can?'잠김':!afford?'루비 부족':n.unlock?'해금':lv?'레벨 업':'배우기';
 return {lv,maxed,can,cost,afford,state,label,need:cost-s.wallet.ruby};
}
function hint(a){return a.state==='ok'?`한 번 더 누르면 ${a.label}`:a.state==='short'?`루비가 ${num(a.need)}개 모자라요`:a.state==='maxed'?'이미 최고 레벨이에요':'앞 노드를 최고 레벨까지 올려야 해요';}
function bubble(s,selected,all,ready,page,fx){
 const pop=fx.pop?' pop':'';
 if(selected==='seal'&&ready){
  const cost=sealPrice(page),ok=s.wallet.ruby>=cost,state=ok?'ok':'short';
  return {bubble:`<div class="map-bubble seal-bubble${pop}" data-x="920" data-y="920" data-r="91"><div class="bubble-head">${I('rebirth')}<div><small>모든 노드 완료 · 최종 노드</small><strong>기억의 심장</strong></div></div><p>이 페이지의 능력치를 계정에 새겨요.<small>현재 채굴과 빌드는 그대로 이어져요</small></p><div class="bubble-cost ${ok?'':'short'}">${I('ruby')}<b>${num(cost)}</b></div><div class="bubble-hint">${ok?'한 번 더 누르면 영구 흡수':`루비가 ${num(cost-s.wallet.ruby)}개 모자라요`}</div><i class="tail"></i></div>`,
   cta:`<div class="node-cta ${state}" data-x="920" data-y="920">${ok?'흡수':'루비 부족'}</div>`};
 }
 const n=all.find(x=>x.id===selected);if(!n)return {bubble:'',cta:''};
 const a=action(s,n,page),branch=BRANCHES.find(x=>x.id===n.branch)?.name||'성장의 시작',r=n.id==='root'&&ready?91:58;
 const desc=n.unlock?`${UNLOCK_SKILLS.find(k=>k.id===n.unlock).desc}<small>다음 환생부터 선택지에 등장 · 영구 유지</small>`:`${effectText(n.effect,n.value)} / 레벨<small>현재 ${effectText(n.effect,n.value*a.lv)}${a.maxed?'':` → +${pct(n.value*(a.lv+1))}${EFFECTS[n.effect].unit}`}</small>`;
 return {bubble:`<div class="map-bubble${pop}" data-x="${n.x}" data-y="${n.y}" data-r="${r}"><div class="bubble-head">${I(n.icon)}<div><small>${n.unlock?'새 빌드 해금':branch} · ${a.lv}/${n.max}</small><strong>${n.name}</strong></div></div><p>${desc}</p>${a.maxed?'':`<div class="bubble-cost ${a.afford?'':'short'}">${I('ruby')}<b>${num(a.cost)}</b></div>`}<div class="bubble-hint ${a.state}">${hint(a)}</div><i class="tail"></i></div>`,
  cta:`<div class="node-cta ${a.state}" data-x="${n.x}" data-y="${n.y}">${a.label}</div>`};
}

// selected: 말풍선이 열린 노드 id(없으면 null). fx: 이번 그리기에만 쓰는 연출 {pop, bump}
export function masteryBody(s,selected=null,overview=false,fx={}){
 const b=M.book(s),all=M.nodes(s),ns=overview?all:M.visibleNodes(s),p=M.progress(s),ready=p.ready;
 const lines=ns.flatMap(n=>n.parents.map(id=>{const parent=ns.find(x=>x.id===id);return parent?`<path class="${M.nodeLevel(s,n.id)?'lit':''}" d="M ${parent.x} ${parent.y} Q ${parent.x} ${n.y} ${n.x} ${n.y}"/>`:''})).join('');
 const nodes=ns.filter(n=>!(ready&&n.id==='root')).map(n=>{const lv=M.nodeLevel(s,n.id),state=lv===n.max?'max':lv?'owned':M.reachable(s,n)?'available':'locked';
  return B('node',I(n.icon)+`<span class="map-level">${n.unlock?(lv?'해금':'빌드'):lv+'/'+n.max}</span>`,`data-id="${n.id}" data-x="${n.x}" data-y="${n.y}" aria-label="${n.name} ${lv}/${n.max}" aria-pressed="${n.id===selected}" style="left:${n.x}px;top:${n.y}px"`,`map-node ${state} ${n.unlock?'unlock':''} ${n.id===selected?'selected':''} ${fx.bump===n.id?'bump':''}`);}).join('');
 const seal=ready?B('node',I('rebirth')+'<span class="seal-label">기억의 심장</span>',`data-id="seal" data-x="920" data-y="920" aria-label="기억의 심장" aria-pressed="${selected==='seal'}" style="left:920px;top:920px"`,`map-node final-node ${selected==='seal'?'selected':''} ${fx.bump==='seal'?'bump':''}`):'';
 const info=selected?bubble(s,selected,ns,ready,b.page,fx):{bubble:'',cta:''};
 const transform=view.ready?`transform:translate(${view.x}px,${view.y}px) scale(${view.zoom})`:'';
 return `<div class="mastery-top"><div><small>${b.page===1?'발견의 지도':'성장의 지도'}</small><strong>PAGE ${String(b.page).padStart(2,'0')}</strong></div><div class="map-progress"><span>완성한 노드 <b>${p.maxed} / ${p.total}</b></span><div><i style="width:${p.levels/p.maxLevels*100}%"></i></div><span>${Math.floor(p.levels/p.maxLevels*100)}%</span></div><div class="mastery-wallet">${I('ruby')}${num(s.wallet.ruby)}</div></div>`
  +`<div class="constellation" id="mastery-scroll" tabindex="0" role="application" aria-label="마스터리 지도. 끌어서 이동하고, 두 손가락이나 마우스 휠로 확대·축소해요. 아이콘을 누르면 설명이 나오고 한 번 더 누르면 배워요."><div class="map-space" style="${transform}"><svg class="map-paths" viewBox="0 0 1840 1840" aria-hidden="true">${lines}</svg>${nodes}${seal}</div><div class="map-overlay">${info.bubble}${info.cta}</div></div>`
  +`<div class="mastery-bottom">${B('profile','누적 능력치 보기','','map-tool')}<span>${ready?'가운데 최종 노드를 눌러 흡수해요':'아이콘을 누르면 설명 · 한 번 더 누르면 배우기<br>끌어서 이동 · 두 손가락/휠로 확대'}</span></div>`;
}
export function profileBody(s){
 const st=E.stats(s),b=M.book(s),p=M.progress(s),perm=M.permanentBonuses(s),current=M.pageBonuses(s);
 const rows=[['pickaxe','기본 채굴력',num(st.damage)],['fast','팀 공격 간격',st.interval.toFixed(2)+'초'],['focus','치명타 확률',pct(st.crit)+'%'],['focus','치명타 배율',st.critDamage.toFixed(2)+'배'],['stone','돌 획득 배율',st.stone.toFixed(2)+'배'],['ruby','환생 루비 보너스','+'+pct(E.bonus(s,'ruby'))+'%']];
 return `<div class="profile-hero">${I('costume_miner')}<div><small>차곡차곡, 내 광산의 기록</small><strong>작지만 대단한 광부</strong><p>${b.page-1}페이지 흡수 · 현재 ${b.page}페이지</p></div></div><div class="profile-stats">${rows.map(([i,n,v])=>`<div>${I(i)}<span>${n}</span><strong>${v}</strong></div>`).join('')}</div><p class="footnote">장착 장비·마스터리·현재 빌드 반영<br>개별 햄찌의 팀 배율과 조건부 타격 피해는 별도예요.</p><div class="cream-box"><strong>영구 기억과 이번 페이지</strong><table class="memory-table"><thead><tr><th>능력</th><th>영구 누적</th><th>페이지 ${b.page}</th></tr></thead><tbody>${Object.entries(EFFECTS).map(([k,v])=>`<tr><td>${v.name}</td><td>+${pct(perm[k]||0)}${v.unit}</td><td>+${pct(current[k]||0)}${v.unit}</td></tr>`).join('')}</tbody></table><small>흡수는 오른쪽 값을 왼쪽으로 옮깁니다.<br>오프라인 적용 효율 ${pct(st.offline)}% · 현재 ${p.maxed}/${p.total}노드 완료</small></div><div class="cream-box"><strong>발견한 빌드 ${b.unlocked.length} / ${UNLOCK_SKILLS.length}</strong><div class="unlock-list">${UNLOCK_SKILLS.map(k=>`<div class="${b.unlocked.includes(k.id)?'':'undiscovered'}">${I(k.icon)}<span>${k.name}<small>${b.active.includes(k.id)?'선택지에 등장 중':b.unlocked.includes(k.id)?'다음 환생부터 등장':'아직 발견하지 못했어요'}</small></span></div>`).join('')}</div></div><div class="two-buttons">${B('mastery','마스터리')}${B('build','현재 빌드','','cta secondary')}</div>`;
}
export function absorptionBody(result){return `<div class="absorb-scene"><div class="absorb-halo"></div>${I('costume_miner')}${Array.from({length:12},(_,i)=>`<i style="--a:${i*30}deg;--delay:${i*.05}s"></i>`).join('')}</div><h3 class="section-title">${result.page}페이지의 힘을 새겼어요</h3><p class="footnote">모든 능력치와 빌드 해금이 계정에 남습니다.</p><div class="cream-box absorption-values"><span>흡수 전 채굴력 <b>${num(result.before.damage)}</b></span><span>흡수 후 채굴력 <b>${num(result.after.damage)}</b></span></div><div class="memory-gains">${Object.entries(result.gains).map(([k,v])=>`<span>${effectText(k,v)}</span>`).join('')}</div>${B('mastery',`${result.page+1}페이지 펼치기`)}${B('profile','내 성장 기록 보기','','cta secondary')}`;}

// 지도 조작: 한 손가락/마우스 드래그 = 이동, 두 손가락 벌리기·모으기/마우스 휠/트랙패드 핀치 = 확대·축소.
// 짧게 눌렀다 떼면 노드 클릭(아이콘 선택·획득), 빈 곳을 누르면 말풍선을 닫는다.
export function bindMasteryMap(root,{onBackground}={}){
 const v=root.querySelector('#mastery-scroll');if(!v)return;
 const space=v.querySelector('.map-space'),overlay=v.querySelector('.map-overlay');
 const size=()=>({w:v.clientWidth,h:v.clientHeight});
 const k=()=>v.getBoundingClientRect().width/v.offsetWidth||1;                    // 게임 화면 축소 배율
 const local=e=>{const r=v.getBoundingClientRect();return {x:(e.clientX-r.left)/k()-v.clientLeft,y:(e.clientY-r.top)/k()-v.clientTop};};
 const nodeEl=id=>v.querySelector(`.map-node[data-id="${id}"]`);
 const place=()=>{
  const {w,h}=size();
  for(const el of overlay.children){
   const x=+el.dataset.x,y=+el.dataset.y,sx=x*view.zoom+view.x,sy=y*view.zoom+view.y;
   el.style.visibility=sx<-30||sx>w+30||sy<-30||sy>h+30?'hidden':'visible';
   if(el.classList.contains('node-cta')){el.style.left=sx+'px';el.style.top=sy+'px';continue;}
   const L=bubbleLayout({x,y,r:+el.dataset.r||58},view,w,h,el.offsetWidth,el.offsetHeight);
   el.style.left=L.left+'px';el.style.top=L.top+'px';el.style.setProperty('--tail',L.tail+'px');el.classList.toggle('flip',L.flip);
  }
 };
 const apply=()=>{
  const {w,h}=size();if(!w)return;
  Object.assign(view,clampView(view,w,h));
  space.style.transform=`translate(${view.x}px,${view.y}px) scale(${view.zoom})`;
  v.style.backgroundPosition=`${view.x}px ${view.y}px`;v.style.backgroundSize=`${TILE*view.zoom}px`;
  place();
 };
 const init=()=>{
  const {w,h}=size();if(!w)return;
  if(!view.ready){Object.assign(view,fitView([...v.querySelectorAll('.map-node')].map(n=>({x:+n.dataset.x,y:+n.dataset.y})),w,h));view.ready=true;}
  if(view.center){const el=nodeEl(view.center);if(el)Object.assign(view,centerView(view,+el.dataset.x,+el.dataset.y,w,h,Math.max(view.zoom,.8)));view.center=null;}
  apply();
 };
 init();
 new ResizeObserver(init).observe(v);
 const sel=v.querySelector('.map-node.selected');sel?.focus({preventScroll:true});

 const pts=new Map();let pan=null,pinch=null,moved=false;
 const startPan=()=>{const [p]=[...pts.values()];pan={x:p.x,y:p.y,vx:view.x,vy:view.y};};
 v.addEventListener('pointerdown',e=>{
  pts.set(e.pointerId,local(e));
  if(pts.size===1){moved=false;startPan();}
  else if(pts.size===2){
   moved=true;pinch=null;pan=null;                                          // 두 손가락이면 탭이 아니다
   for(const id of pts.keys())try{v.setPointerCapture(id);}catch{}
   const [a,b]=[...pts.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y)||1,z:view.zoom,mx:(a.x+b.x)/2,my:(a.y+b.y)/2,vx:view.x,vy:view.y};
  }
 });
 v.addEventListener('pointermove',e=>{
  if(!pts.has(e.pointerId))return;
  pts.set(e.pointerId,local(e));
  const {w,h}=size();
  if(pts.size>=2&&pinch){
   const [a,b]=[...pts.values()],d=Math.hypot(a.x-b.x,a.y-b.y)||1,mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
   // 처음 두 손가락 가운데의 지도 위 점을, 지금 두 손가락 가운데로 옮기며 배율을 맞춘다(확대하며 이동도 가능)
   const z=clampZoom(pinch.z*d/pinch.d),wx=(pinch.mx-pinch.vx)/pinch.z,wy=(pinch.my-pinch.vy)/pinch.z;
   Object.assign(view,clampView({zoom:z,x:mx-wx*z,y:my-wy*z},w,h));apply();return;
  }
  if(pts.size===1&&pan){
   const p=pts.get(e.pointerId),dx=p.x-pan.x,dy=p.y-pan.y;
   if(!moved&&Math.abs(dx)+Math.abs(dy)>8){moved=true;v.classList.add('dragging');try{v.setPointerCapture(e.pointerId);}catch{}}
   if(moved){view.x=pan.vx+dx;view.y=pan.vy+dy;apply();}
  }
 });
 const lift=e=>{
  pts.delete(e.pointerId);
  if(pts.size===1){pinch=null;startPan();}                                  // 한 손가락을 떼면 남은 손가락으로 이동을 이어간다
  if(!pts.size){pan=null;pinch=null;v.classList.remove('dragging');}
 };
 v.addEventListener('pointerup',lift);v.addEventListener('pointercancel',lift);
 v.addEventListener('wheel',e=>{
  e.preventDefault();
  const unit=e.deltaMode===1?16:e.deltaMode===2?400:1,p=local(e),{w,h}=size();
  Object.assign(view,zoomAt(view,Math.exp(-e.deltaY*unit*(e.ctrlKey?.01:.0015)),p.x,p.y,w,h));apply();   // ctrl+휠=트랙패드 핀치
 },{passive:false});
 v.addEventListener('keydown',e=>{
  const {w,h}=size(),step=90;
  if(e.key==='+'||e.key==='='||e.key==='-'||e.key==='_'){Object.assign(view,zoomAt(view,e.key==='+'||e.key==='='?1.2:1/1.2,w/2,h/2,w,h));apply();e.preventDefault();return;}
  const d={ArrowLeft:[step,0],ArrowRight:[-step,0],ArrowUp:[0,step],ArrowDown:[0,-step]}[e.key];
  if(d&&e.target===v){view.x+=d[0];view.y+=d[1];apply();e.preventDefault();}
 });
 v.addEventListener('click',e=>{
  if(moved){e.preventDefault();e.stopPropagation();moved=false;return;}
  if(!e.target.closest('.map-node'))onBackground?.();
 },true);
}
