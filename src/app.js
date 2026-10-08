import * as M from './mastery-state.js';
import * as MU from './mastery-ui.js';
import * as SU from './shop-ui.js';
import * as SPU from './season-ui.js';
import * as DU from './dungeon-ui.js';
import { bindDragScroll } from './drag-scroll.js';
import { createTutorial } from './tutorial.js';
import { playGacha, preloadGacha } from './gacha-scene.js';
import {newSeason,SEASON_DAY} from './season-state.js';
import {SEASON} from '../data/season-pass.js';
import {SHOP} from '../data/shop.js';
import {sealPrice} from '../data/mastery.js';
import { DUNGEONS } from '../data/dungeons.js';
import { CONFIG as C, SKILLS, TIERS, DRAW_WEIGHTS, HAMSTERS, CREW_PER_TEAM, MASTERY } from '../data/config.js';
import * as E from './engine.js';
import { Assets } from './assets.js';
import { World } from './world.js';
const $ = id => document.getElementById(id), root = $('modal-root'), hud = $('hud'), game = $('game');
const fmt = n => n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : Math.floor(n).toLocaleString('en-US');
const I = id => '<span class="icon" data-icon="' + id + '"></span>';
const B = (act, text, cl = 'cta', extra = '') => '<button type="button" class="' + cl + '" data-act="' + act + '" ' + extra + '>' + text + '</button>';
const pick = tier => 'pickaxe_' + TIERS[tier].toLowerCase();
let a, world, s, modal = null, tab = 'equip', gearHamster = 'miner', bulkTier = 1, bulkOpen = false, selection = [], draftChoice = null, chosenNode = 'root', chosenHamster = 'miner', hamsterResult = null, toastTimer, lastTime = 0, lastHud = 0, lastSave = 0, paused = false, focusBefore = null, offlineReward = null;
let pendingDraw = null, gachaOn = false;
// 상점에서 연 작은 팝업(구매 확인·뽑기 결과·확률·광고)은 상점 위에 겹쳐 뜬다: modalBase='shop'이면 뒤에 상점이 그대로 남고,
// 닫으면 상점으로 돌아온다(메인 화면으로 나가지 않는다).
let modalBase = null, shopBuy = null, keyboardUse = false;
let passStamp = '';
let seasonPage=1,seasonConfirm=false,seasonStamp='',seasonTab='';
let dungeonPage='select',dungeonConfirm=false,dungeonStamp='',dungeonCloseAfterLeave=false;
// 창 열고 닫기 연출 상태: 지금 그려진 바탕 창·겹친 창, 닫는 중 정리 타이머, 창 안 작은 팝업
// 스킬 강화 누른 결과(다시 그릴 때 한 번만 연출): { id, ok }
let upgradeFx = null;
let lastBuzz=0,shownBase=null,shownOver=null,closeTimer=0,lastInner=null;
// 던전 입장 로딩: 새 무대가 열리는 동안(약 1.5초) 화면을 가리고 게임 시간을 멈춘다
let dungeonLoading=false,dungeonLoadTimer=0;
// 던전이 끝난 뒤 결과 창이 떠 있는 동안: 게임 시간을 멈추고 화면을 던전 마지막 장면으로 붙잡아 둔다. 결과 창을 닫으면 로딩 화면을 거쳐 일반 화면으로 돌아간다.
let dungeonHold=false;
const DUNGEON_LOAD_MS=1500;
new Image().src='assets/ui/loading-scene-v1.webp'; // 로딩 씬을 미리 받아 두어 처음부터 바로 보이게
const OVER_SHOP = new Set(['shop-product', 'rates', 'hamster-rates', 'ad']);
const fixture = new URLSearchParams(location.search).get('fixture') === 'approved';
const masteryPreview=fixture?new URLSearchParams(location.search).get('mastery'):null;
const shopPreview=fixture && new URLSearchParams(location.search).has('shop');
const seasonPreview=fixture && new URLSearchParams(location.search).has('season');
const dungeonPreview=fixture && new URLSearchParams(location.search).get('dungeon');
// ?fixture=approved&gacha=pickaxe|pickaxe10|hamster|hamster10[&g=A 또는 &g=D,C,B,A,S,SS]: 뽑기 연출 장면 미리보기(저장·재화에 영향 없음)
const gachaPreview=fixture && new URLSearchParams(location.search).get('gacha');
// ?fixture=approved&tutorial=1: 새 게임 상태로 튜토리얼을 확인하는 주소(저장하지 않는다). 일반 실행은 항상 튜토리얼이 켜져 있다.
const tutorialPreview = fixture && new URLSearchParams(location.search).has('tutorial');
let tutorial = null;
let mapOverview=false, absorption=null, mapFx={}, previewBoot=false;
const mineralPreview = fixture ? new URLSearchParams(location.search).get('mineral') : null;
// 승인 배너를 실제 메인 씬에서 정지 상태로 비교하는 주소. 실제 저장에는 영향을 주지 않는다.
const bannerPreview = fixture ? new URLSearchParams(location.search).get('banner') : null;

function notify(text) {
  $('toast').textContent = text;
  $('toast').style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').style.display = 'none', 2200);
}

function save() {
  if (fixture)
    return;
  try {
    localStorage.setItem(C.saveKey, E.serialize(s));
  }
  catch {
    notify('저장 공간을 사용할 수 없어요. 설정에서 저장 파일을 내려받아 주세요.');
  }
}

// innerWidth는 모바일에서 941px 무대 때문에 레이아웃 뷰포트가 넓어지면 실제 화면보다 커질 수 있다.
// 무대를 담는 #viewport의 안쪽(안전 영역 제외) 크기로 맞춘다.
function resize() {
  const box = $('viewport'), pad = getComputedStyle(box);
  const w = box.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
  const h = box.clientHeight - parseFloat(pad.paddingTop) - parseFloat(pad.paddingBottom);
  const scale = Math.min(w / C.designWidth, h / C.designHeight);
  game.style.transform = 'scale(' + scale + ')';
}

function buildHud() {
  hud.innerHTML = `
 ${B('profile', '<img src="assets/characters/hamster-approved.webp" alt="광부 프로필">', 'avatar brown', 'aria-label="프로필 능력치 보기"')}
 <div class="moneybar brown"><div class="money stroke">${I('stone')}<span id="stone">0</span></div><div class="money stroke">${I('ruby')}<span id="ruby">0</span></div><div class="money stroke">${I('diamond')}<span id="diamond">0</span></div></div>
 ${B('settings', I('settings'), 'gear brown', 'aria-label="설정"')}
 <div class="side-tools">${B('missions', I('mission') + '<span class="stroke">임무</span>', 'brown')}${B('dungeon', I('dungeon') + '<span class="stroke">던전</span>', 'brown')}</div>
 <div class="depth"><span>−</span><span id="depth-prev">11</span><strong class="current" id="depth-now">12</strong><span id="depth-next">13</span><span>−</span></div>
 ${B('auto', '<span class="auto-label stroke">자동 강화</span><span id="auto-toggle" class="toggle"></span><img class="auto-lock-overlay" src="assets/shop/auto-upgrade-lock-v1.webp" alt=""><span class="auto-lock-hint">패스로 해제</span>', 'auto brown', 'aria-pressed="false"')}
 <div class="upgrades" id="upgrades"></div>
 <nav class="nav brown" aria-label="게임 메뉴">${[['equipment', 'pickaxe', '장비'], ['mastery', 'mastery', '마스터리'], ['rebirth', 'rebirth', '환생'], ['hamsters', 'hamster_face', '햄찌단'], ['shop', 'shop', '상점']].map(([act, icon, label]) => B(act, I(icon) + '<span class="stroke">' + label + '</span>')).join('')}</nav>`;
  a.apply(hud);
  renderUpgrades();
  updateHud();
}

function renderUpgrades() {
  // 스킬은 3칸. 아직 고르지 않은 칸(빌드 선택 중 창을 닫았을 때 포함)은 점선 + 버튼으로 비워 두고, 누르면 선택 창이 다시 열린다.
  const cards = s.skills.map(x => {
    const k = SKILLS.find(k => k.id === x.id);
    return B('upgrade', I(k.icon) + '<span class="stroke">' + k.name + '<small>Lv.' + x.level + '</small></span><span class="cost stroke">' + I('stone') + '<span>' + fmt(E.upgradeCost(x,s)) + '</span></span>', 'upgrade ' + k.color, 'data-id="' + x.id + '" aria-label="' + k.name + ' 강화"');
  });
  const empties = s.draft ? Array.from({ length: Math.max(0, 3 - s.skills.length) }, () => B('open-draft', I('plus'), 'upgrade empty', 'aria-label="스킬 고르기"')) : [];
  $('upgrades').innerHTML = cards.concat(empties).join('');
  if (upgradeFx) {
    const card = $('upgrades').querySelector('[data-act=upgrade][data-id="' + upgradeFx.id + '"]');
    if (card && s.settings.motion) {
      card.classList.add(upgradeFx.ok ? 'level-up' : 'deny');
      if (upgradeFx.ok)
        card.insertAdjacentHTML('beforeend', '<span class="lvup-float" aria-hidden="true">Lv.UP!</span>');
    }
    upgradeFx = null;
  }
  a.apply($('upgrades'));
}

function updateHud() {
  for (const k of ['stone', 'ruby', 'diamond'])
    $(k).textContent = fmt(s.wallet[k]);
  // 1층이면 위 칸을, 마지막 층이면 아래 칸을 비운다(1·1·2처럼 같은 숫자가 겹쳐 보이지 않게)
  $('depth-prev').textContent = s.floor > 1 ? s.floor - 1 : ' ';
  $('depth-now').textContent = s.floor;
  $('depth-next').textContent = s.floor < C.maxFloor ? s.floor + 1 : ' ';
  // 던전 중에는 던전 버튼이 "나가기"가 된다(누르면 나갈지 묻는다)
  const dgLabel = hud.querySelector('[data-act=dungeon] .stroke');
  if (dgLabel) dgLabel.textContent = s.dungeon ? '나가기' : '던전';
  const unlocked = E.hasAutoUpgrade(s), auto = hud.querySelector('[data-act=auto]');
  $('auto-toggle').classList.toggle('on', unlocked && s.autoUpgrade);
  auto.classList.toggle('locked', !unlocked);
  auto.setAttribute('aria-pressed', String(unlocked && s.autoUpgrade));
  auto.setAttribute('aria-label', unlocked ? '자동 강화 ' + (s.autoUpgrade ? '끄기' : '켜기') : '자동 강화 잠김 · 편안한 광부 패스로 해제');
}

function updatePasses() {
  const amount = E.syncPasses(s);
  if (amount) { save(); notify('매일 다이아 꾸러미 · 오늘 다이아 +' + amount); }
  const stamp = SHOP.passes.map(p => { const st = E.passStatus(s, p.id); return `${st.active}:${st.remainingDays}:${st.todayClaimed}`; }).join('|');
  if (passStamp && passStamp !== stamp) {
    save();
    if (modal === 'shop' || modalBase === 'shop' || modal === 'shop-product') renderModal();
  }
  passStamp = stamp;
}

// 지금 열린 창이 상점이거나 상점 위에 겹친 창일 때, 상점 위에 띄울 수 있는 창이면 상점을 뒤에 남긴다.
function stackOverShop(name) {
  modalBase = (modal === 'shop' || modalBase === 'shop') && OVER_SHOP.has(name) ? 'shop' : null;
  modal = name;
}

function open(name) {
  // 던전이 진행 중이면 던전 창 대신 "나갈까요?" 카드만 띄운다(무대는 그대로 보인다)
  if (name === 'dungeon' && s.dungeon) {
    dungeonPage = s.dungeon.kind;
    name = 'dungeon-exit';
  }
  if (!modal)
    focusBefore = document.activeElement;
  stackOverShop(name);
  // 던전이 진행 중일 때 던전 창을 열면 무대는 그대로 두고 "나갈까요?"만 묻는다
  if(name!=='dungeon')releaseDungeonHold();
  if(name==='dungeon'){dungeonPage=s.dungeon?.kind||'select';dungeonConfirm=!!s.dungeon;dungeonCloseAfterLeave=false;}
  if(name==='missions'){seasonPage=SPU.seasonStart(E.seasonStatus(s).level);seasonConfirm=false;seasonTab='';}
  if (name === 'equipment') {
    tab = 'equip';
    selection = [];
    gearHamster = s.crew[0];
  }
  if (name === 'build')
    draftChoice = null;
  if (name === 'hamsters')
    chosenHamster = s.crew[0];
  if (name === 'mastery') {
    // 열 때마다 지도를 처음 보기(보이는 노드에 맞춤)로, 말풍선은 닫은 채로. 미리보기 첫 화면만 지정한 노드를 연다.
    MU.resetView();
    if (!previewBoot)
      chosenNode = null;
  }
  renderModal();
}

// all=true면 상점 위에 겹친 창이 있어도 전부 닫는다(하단 메뉴를 한 번 더 눌러 닫을 때)
function close(all = false) {
  dungeonConfirm = false;
  if (!all && bulkOpen) { bulkOpen = false; renderModal(); return; }
  bulkOpen = false;
  if(!all&&modal==='missions'&&seasonConfirm){seasonConfirm=false;renderModal();return;}
  // 상점 위에 겹친 창이면 그 창만 닫고 상점으로 돌아온다
  if (!all && modalBase === 'shop' && modal !== 'shop') {
    modalBase = null;
    modal = 'shop';
    shownOver = null;
    // 겹쳐 있던 작은 창은 상점이 다시 그려진 뒤에도 잠깐 남아 작아지며 사라진다
    const top = root.querySelector('.shade.over');
    renderModal();
    if (top && s.settings.motion) {
      top.classList.remove('enter', 'enter-shade');
      top.classList.add('leaving');
      top.inert = true;
      root.append(top);
      setTimeout(() => top.remove(), 180);
    }
    return;
  }
  modalBase = null;
  modal = null;
  shownBase = shownOver = lastInner = null;
  dismissShades();
  releaseDungeonHold();
  hud.inert = false;
  syncNav();
  // 마우스·터치로 닫았을 때는 초점을 돌려주지 않는다(메뉴 버튼에 흰 초점 테두리가 남아 보였다). 키보드로 쓰는 중일 때만 돌려준다.
  if (keyboardUse && focusBefore?.isConnected)
    focusBefore.focus();
}

// 창을 닫을 때: 덮개와 창이 잠깐 작아지며 사라진 뒤 지운다(그 사이 눌러도 뒤의 게임이 눌린다). 모션을 줄인 설정이면 바로 지운다.
function dismissShades() {
  clearTimeout(closeTimer);
  const shades = [...root.children];
  if (!s.settings.motion || !shades.length) {
    root.replaceChildren();
    return;
  }
  for (const el of shades) {
    el.classList.remove('enter', 'enter-shade');
    el.classList.add('leaving');
    el.inert = true;
  }
  closeTimer = setTimeout(() => { if (!modal) root.replaceChildren(); }, 180);
}

// 지금 열려 있는 창에 해당하는 하단 메뉴 버튼을 눌린 모양으로 표시한다(상점 위 겹침 창이 떠 있으면 상점 버튼)
function syncNav() {
  const current = modal ? (modalBase === 'shop' ? 'shop' : modal) : null;
  for (const b of hud.querySelectorAll('.nav button')) {
    b.classList.toggle('open', b.dataset.act === current);
    b.setAttribute('aria-pressed', String(b.dataset.act === current));
  }
}

// over=true면 이미 그려진 창(상점)을 지우지 않고 그 위에 새 창을 겹쳐 그린다.
function shell(title, body, over = false, bare = false) {
  const lastAct = document.activeElement?.dataset?.act;
  const lastId = document.activeElement?.dataset?.id;
  // 모든 창에서 위쪽 프로필·자원 막대·설정과 아래쪽 메뉴는 항상 보이고 눌러 쓸 수 있다(어두운 덮개는 그 둘레를 가리지 않는다).
  // 예외: 반드시 먼저 끝내야 하는 창(스킬 고르기·오프라인 보상·새 게임 확인)과 상점 위에 겹친 작은 창은 전부 막는다.
  const forced = (modal === 'build' && !!s.draft) || modal === 'offline' || modal === 'reset-confirm' || modal === 'dungeon-exit';
  const live = !over && !forced;
  // 새로 열린 창만 튀어나온다. 같은 창을 다시 그릴 때(탭·선택 변경 등)는 움직이지 않는다.
  clearTimeout(closeTimer);
  const prevShade = over ? null : root.querySelector('.shade:not(.leaving)');
  let fresh;
  if (over) {
    fresh = shownOver !== modal;
    shownOver = modal;
  }
  else {
    fresh = shownBase !== modal;
    shownBase = modal;
    if (!modalBase)
      shownOver = null;
  }
  const enter = fresh && s.settings.motion ? ' enter' + (over || !prevShade ? ' enter-shade' : '') : '';
  // bare: 머리글·테두리 없이 작은 안내 카드만 띄운다(던전 나가기 확인)
  const html = bare ? '<div class="shade' + (live ? ' hud-live' : '') + enter + '"><section class="modal bare" role="dialog" aria-modal="true" aria-label="던전 나가기">' + body + '</section></div>' : '<div class="shade' + (over ? ' over' : '') + (live ? ' hud-live' : '') + enter + '"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-header stroke"><span id="modal-title">' + title + '</span>' + B('close', I('close'), 'close brown', 'aria-label="닫기"') + '</header><div class="modal-body">' + body + '</div></section></div>';
  if (over)
    root.insertAdjacentHTML('beforeend', html);
  else
    root.innerHTML = html;
  a.apply(root);
  hud.inert = !live;
  const scope = over ? root.lastElementChild : root;
  const target = lastAct ? [...scope.querySelectorAll('button:not(:disabled)')].find(b => b.dataset.act === lastAct && b.dataset.id === lastId) : null;
  // 초점을 옮길 때 스크롤하지 않는다: 지도처럼 화면 밖에 놓인 버튼으로 내용이 밀리지 않게
  (target || scope.querySelector('button'))?.focus({ preventScroll: true });
  syncNav();
}

function inventory(cls = '') {
  return '<div class="inventory ' + cls + '">' + s.inventory.map(item => B('slot', I(pick(item.tier)) + '<span class="tier">' + TIERS[item.tier] + '</span>' + (item.enh ? '<span class="enh-tag">+' + item.enh + '</span>' : '') + (E.holderOf(s, item.id) ? '<span class="equipped-tag">' + shortName(E.holderOf(s, item.id)) + '</span>' : ''), 'slot ' + (selection.includes(item.id) ? 'selected' : ''), 'data-id="' + item.id + '" aria-label="' + TIERS[item.tier] + ' 등급 곡괭이 ' + item.id + ' 선택" aria-pressed="' + selection.includes(item.id) + '"')).join('') + Array.from({ length: Math.max(0, 12 - s.inventory.length) }, () => '<div class="slot empty" aria-label="빈 장비 칸">' + I('plus') + '</div>').join('') + '</div>';
}

// 강화할 곡괭이: 방금 고른 것, 없으면 고른 햄찌가 든 것, 그것도 없으면 첫 곡괭이
const enhanceTarget = () => s.inventory.find(x => x.id === selection[0]) || E.gearOf(s, gearHamster) || s.inventory[0];
// 곡괭이 한 자루가 한 번 칠 때 내는 기본 피해(스킬·햄찌 배율 제외)
// 곡괭이 자리 표시용 짧은 이름('우비 햄찌' → '우비')
const shortName = id => HAMSTERS.find(h => h.id === id).name.replace(/ ?햄찌$/, '');
const itemDamage = item => Math.round(E.stats(s).damage * E.pickPower(item));

// 일괄 합성 팝업: "어느 등급까지 합칠까요?"를 고르고 결과를 미리 보고 확인한다. 곡괭이 창 위에 겹쳐 뜬다.
function bulkPopup() {
  const plan = E.planBulkMerge(s, bulkTier), top = plan.top;
  const free = t => s.inventory.filter(x => x.tier === t && !E.holderOf(s, x.id) && !(x.enh > 0)).length;
  const chips = TIERS.slice(0, TIERS.length - 1).map((name, t) => B('bulk-tier', I(pick(t)) + '<b>' + name + '</b><small>' + free(t) + '자루</small>', 'bulk-chip ' + (t === top ? 'on' : ''), 'data-id="' + t + '" aria-pressed="' + (t === top) + '" aria-label="' + name + ' 등급까지 합치기"')).join('');
  const changes = plan.final.map((n, t) => plan.start[t] !== n ? '<li><span>' + I(pick(t)) + TIERS[t] + '</span><b>' + plan.start[t] + ' → ' + n + '</b></li>' : '').filter(Boolean).join('');
  return '<div class="bulk-shade"><section class="bulk-popup" role="dialog" aria-modal="true" aria-label="일괄 합성"><h3>일괄 합성</h3><p class="bulk-ask">어느 등급까지 합칠까요?<br><small>고른 등급 이하의 곡괭이를 같은 등급끼리 합쳐요</small></p><div class="bulk-chips">' + chips + '</div>'
    + (plan.merges.length ? '<div class="bulk-result"><div class="bulk-sum">' + TIERS[0] + '~' + TIERS[top] + ' 곡괭이 <b>' + plan.used + '자루</b>를 합쳐 <b>' + plan.gainedTotal + '번</b> 합성</div><ul>' + changes + '</ul></div>' : '<div class="bulk-result none">' + TIERS[0] + '~' + TIERS[top] + ' 중에 합칠 같은 등급 짝이 없어요</div>')
    + (plan.skipped ? '<p class="bulk-skip">든 곡괭이·강화한 곡괭이 ' + plan.skipped + '자루는 합치지 않아요</p>' : '')
    + B('bulk-merge', plan.merges.length ? TIERS[0] + '~' + TIERS[top] + ' 합성하기' : '합칠 곡괭이가 없어요', 'cta', plan.merges.length ? '' : 'disabled') + B('bulk-close', '취소', 'cta secondary') + '</section></div>';
}
function equipmentBody() {
  let body = '<div class="tabs">' + [['equip', '장비'], ['merge', '합성'], ['enhance', '강화']].map(([id, t]) => B('tab', t, tab === id ? 'active' : '', 'data-id="' + id + '"')).join('') + '</div>';
  if (tab === 'equip') {
    // 팀 햄찌마다 곡괭이를 한 자루씩 든다: 위에서 햄찌를 고르고 아래 곡괭이를 누르면 그 햄찌가 든다
    const slots = Array.from({ length: C.maxTeams }, (_, k) => {
      const id = s.crew[k];
      if (!id)
        return '<div class="slot empty team-slot" aria-label="빈 팀 칸">' + I('plus') + '</div>';
      const g = E.gearOf(s, id), hm = HAMSTERS.find(x => x.id === id);
      return B('gear-pick', I(hm.asset) + '<span class="gear-ico">' + I(pick(g ? g.tier : 0)) + '</span>' + (g?.enh ? '<span class="enh-tag">+' + g.enh + '</span>' : ''), 'slot team-slot ' + (id === gearHamster ? 'selected' : ''), 'data-id="' + id + '" aria-label="' + hm.name + ' 곡괭이 고르기" aria-pressed="' + (id === gearHamster) + '"');
    }).join('');
    const hm = HAMSTERS.find(x => x.id === gearHamster), g = E.gearOf(s, gearHamster), k = s.crew.indexOf(gearHamster);
    body += '<div class="team-slots">' + slots + '</div>'
      + '<div class="cream-box equipped">' + I(pick(g ? g.tier : 0)) + '<div>' + hm.name + ' · ' + (g ? TIERS[g.tier] + ' 곡괭이' + enhTag(g) : '곡괭이 없음 (맨손 D급)') + '<small>한 번에 ' + Math.round(E.stats(s).damage * (k >= 0 ? E.teamPower(s, k) : 0)) + ' 피해</small></div></div>'
      + inventory()
      + (g ? B('unequip', '곡괭이 내려놓기', 'cta secondary') : '')
      + '<p class="footnote">햄찌를 고르고 곡괭이를 누르면 그 햄찌가 들어요 · 햄찌마다 한 자루씩</p>';
    return body;
  }
  body += inventory();
  if (tab === 'merge') {
    const selected = selection.map(id => s.inventory.find(x => x.id === id)).filter(Boolean), valid = selected.length === 2 && selected[0].tier === selected[1].tier && selected[0].tier < TIERS.length - 1;
    body += '<div class="cream-box merge-preview">' + (selected[0] ? I(pick(selected[0].tier)) : I('plus')) + ' + ' + (selected[1] ? I(pick(selected[1].tier)) : I('plus')) + ' → ' + (valid ? I(pick(selected[0].tier + 1)) : '?') + '</div>' + B('merge', '합성하기', 'cta', valid ? '' : 'disabled') + '<p class="footnote">같은 등급 2개 · 합성한 곡괭이는 +0부터 · 든 햄찌가 있으면 결과물을 들어요</p>' + B('bulk-open', '일괄 합성', 'cta secondary');
  }
  else {
    const item = enhanceTarget(), cost = E.enhanceCost(item), now = item.enh || 0;
    const gain = cost ? itemDamage({ ...item, enh: now + 1 }) - itemDamage(item) : 0;
    const need = cost ? '<span class="cost-line">' + I('stone') + '<b class="' + (s.wallet.stone >= cost.stone ? '' : 'short') + '">' + fmt(cost.stone) + '</b>' + (cost.ruby ? I('ruby') + '<b class="' + (s.wallet.ruby >= cost.ruby ? '' : 'short') + '">' + fmt(cost.ruby) + '</b>' : '') + '</span>' : '';
    body += '<div class="cream-box enhance-preview">' + I(pick(item.tier)) + '<div class="enhance-info"><b>' + TIERS[item.tier] + ' 곡괭이 +' + now + (cost ? ' → +' + (now + 1) : ' (최대)') + '</b><small>' + (cost ? '이 곡괭이 피해 +' + gain : '더 강화할 수 없어요') + '</small>' + need + '</div></div>'
      + B('enhance', cost ? '강화하기' : '최대 강화', 'cta', cost && s.wallet.stone >= cost.stone && s.wallet.ruby >= cost.ruby ? '' : 'disabled')
      + '<p class="footnote">' + (cost && !cost.ruby ? '5강까지는 돌만 · 6강부터는 루비도 들어요' : '곡괭이마다 따로 강화 · 환생해도 유지돼요') + '</p>';
  }
  return body;
}

// 강화 단계 표시(+0은 숨긴다)
const enhTag = item => item.enh ? ' +' + item.enh : '';
function drawBody() {
  E.refreshDay(s);
  return [['free', 'chest', '하루 한 번 무료', C.dailyFreeDraws - s.daily.free + '회 남음', '무료로 1회'], ['ad', 'ad', '광고 보상', C.dailyAdDraws - s.daily.ads + '회 남음', '테스트 광고'], ['diamond', 'diamond', '다이아로 뽑기', '다이아 ' + C.drawCost, '1회 뽑기']].map(([id, icon, title, sub, button]) => '<div class="cream-box row-action">' + I(icon) + '<div>' + title + '<small class="muted" style="display:block">' + sub + '</small></div>' + B('draw', button, 'cta', 'data-id="' + id + '"') + '</div>').join('') + '<p class="footnote">테스트 광고에는 실제 광고와 결제가 없습니다.</p>' + B('rates', '등급별 확률 보기', 'cta secondary');
}

function buildBody() {
  const isDraft = !!s.draft;
  const choices = (isDraft ? s.draft.offers : s.skills.map(k=>k.id)).map(id => SKILLS.find(k => k.id === id));
  return '<div class="build-progress">' + (isDraft ? '스킬 선택 ' + (s.skills.length + 1) + ' / 3' : '현재 채굴 빌드') + '</div><div class="cards">' + choices.map(k => B(isDraft ? 'choose' : 'view-skill', '<div class="card-top">' + I(k.icon) + '<strong class="stroke">' + k.name + '</strong></div><p>' + k.desc + '</p>', 'skill-card ' + k.color + ' ' + ((draftChoice === k.id || (!isDraft && s.skills.some(x => x.id === k.id))) ? 'chosen' : ''), 'data-id="' + k.id + '"')).join('') + '</div><h3 class="section-title">이번 채굴 빌드</h3><div class="cream-box selected-build">' + s.skills.map(x => {
    const k = SKILLS.find(k => k.id === x.id);
    return '<div class="mini-skill">' + I(k.icon) + '<span class="stroke">' + k.name + '</span></div>';
  }).join('') + (isDraft ? '<div class="mini-skill empty" aria-label="아직 고르지 않은 칸">' + I('plus') + '</div>' : '') + '</div>' + (s.skills.some(x => x.id === 'chain') && s.skills.some(x => x.id === 'amplify') ? '<div class="synergy">번개 조합 ' + I('lightning') + '</div>' : '') + B(isDraft ? 'confirm-skill' : 'close', isDraft ? (s.skills.length === 2 ? '이 조합으로 시작' : '선택 확정') : '채굴로 돌아가기', 'cta', isDraft && !draftChoice ? 'disabled' : '') + (isDraft? B('reroll','다시 뽑기 · '+(3-s.draft.rerolls)+'/3','cta secondary',s.draft.rerolls>=3||E.draftPool(s).length<=3?'disabled':'')+'<p class="reroll-info">'+(E.draftPool(s).length<=3?'현재 가능한 선택지가 모두 나왔어요.':'선택 단계마다 무료 3회 · 새 선택지를 우선 표시')+'</p>':'') + '<p class="footnote">채굴한 돌로 강화 · 환생하면 다시 선택해요</p>';
}

const hamsterPower = (id, lv) => HAMSTERS.find(h => h.id === id).power * (1 + C.hamsterLevelPower * (lv - 1));
const times = x => '×' + x.toFixed(2).replace(/\.?0+$/, '');

// 햄찌단: 위는 장착 팀 6칸, 아래는 종류별 카드. 한 팀 = 필드의 햄찌 3마리.
function hamsterBody() {
  const h = HAMSTERS.find(x => x.id === chosenHamster), lv = s.hamsters[h.id] || 0, inCrew = s.crew.includes(h.id);
  const slots = Array.from({ length: C.maxTeams }, (_, k) => {
    const id = s.crew[k];
    return id ? B('hamster-select', I(HAMSTERS.find(x => x.id === id).asset) + '<span class="tier">Lv.' + s.hamsters[id] + '</span>', 'slot team-slot', 'data-id="' + id + '" aria-label="' + (k + 1) + '번 팀"')
      : '<div class="slot empty team-slot" aria-label="빈 팀 칸">' + I('plus') + '</div>';
  }).join('');
  const cards = HAMSTERS.map(x => {
    const l = s.hamsters[x.id] || 0;
    return B('hamster-select', I(x.asset) + '<small>' + x.name + '</small><small>' + (l ? x.grade + ' · Lv.' + l : '미보유') + '</small>' + (s.crew.includes(x.id) ? '<span class="equipped-tag">장착</span>' : ''), 'outfit ' + (l ? '' : 'locked ') + (x.id === h.id ? 'active' : ''), 'data-id="' + x.id + '"');
  }).join('');
  const lvCost = E.hamsterLevelCost(s, h.id), canLv = lvCost !== null && s.wallet.ruby >= lvCost;
  const levelBtn = !lv ? '' : lvCost === null ? B('hamster-levelup', '최고 레벨', 'cta secondary', 'disabled')
    : '<span class="cost-line">' + I('ruby') + '<b class="' + (canLv ? '' : 'short') + '">' + fmt(lvCost) + '</b></span>'
      + B('hamster-levelup', '레벨업', 'cta' + (canLv ? '' : ' secondary'), 'data-id="' + h.id + '" ' + (canLv ? '' : 'disabled'));
  const action = levelBtn + (!lv ? B('hamster-toggle', '상점 뽑기로 얻을 수 있어요', 'cta', 'disabled')
    : inCrew ? B('hamster-toggle', s.crew.length === 1 ? '마지막 팀은 뺄 수 없어요' : '팀에서 빼기', 'cta secondary', 'data-id="' + h.id + '" ' + (s.crew.length === 1 ? 'disabled' : ''))
    : B('hamster-toggle', s.crew.length >= C.maxTeams ? '팀이 가득 찼어요' : '팀에 넣기', 'cta', 'data-id="' + h.id + '" ' + (s.crew.length >= C.maxTeams ? 'disabled' : '')));
  return '<div class="cream-box crew-summary"><strong>장착 팀 ' + s.crew.length + ' / ' + C.maxTeams + '</strong><span>필드 햄찌 ' + s.crew.length * CREW_PER_TEAM + '마리 · 총 채굴 ' + times(E.totalPower(s)) + '</span></div>'
    + '<div class="team-slots">' + slots + '</div>'
    + '<div class="cream-box costume-preview">' + I(h.asset) + '<h3 class="section-title">' + h.name + ' <small>' + h.grade + ' 등급</small></h3><p class="footnote">' + (lv ? 'Lv.' + lv + ' · 팀 채굴력 ' + times(hamsterPower(h.id, lv)) + (lv < C.hamsterMaxLevel ? ' → 다음 ' + times(hamsterPower(h.id, lv + 1)) : ' · 최고 레벨') : '기본 팀 채굴력 ' + times(h.power) + ' · 얻은 뒤 루비로 레벨업') + '</p>' + action + '</div>'
    + '<div class="outfits">' + cards + '</div>'
    + '<p class="footnote">한 팀은 3마리가 함께 따로 캐요 · 환생해도 햄찌단은 유지돼요 · 햄찌 뽑기는 상점에서</p>';
}

function renderModal() {
  if (!modal)
    return;
  // 상점 위에 겹친 창이면 먼저 상점을 그려 두고, 아래에서 그 위에 이 창을 얹는다
  const over = modalBase === 'shop' && modal !== 'shop';
  if (over) {
    const top = modal;
    modal = 'shop';
    renderModal();
    modal = top;
  }
  let title = '', body = '', bare = false;
  switch (modal) {
    case 'dungeon-exit':
      bare = true;
      body = DU.dungeonExitBody(dungeonPage);
      break;
    case 'equipment':
      title = '곡괭이';
      body = equipmentBody();
      break;
    case 'build':
      title = '채굴 준비';
      body = buildBody();
      break;
    case 'mastery':
      title = '마스터리';
      // 연출(말풍선 또잉·구매 반동)은 이번 그리기 한 번에만 쓴다
      body = MU.masteryBody(s,chosenNode,mapOverview,s.settings.motion?mapFx:{});
      mapFx = {};
      break;
    case 'profile':
      title='광부의 기록';body=MU.profileBody(s);break;
    case 'absorbed':
      title='영구 기억';body=MU.absorptionBody(absorption);break;
    case 'hamsters':
      title = '햄찌단';
      body = hamsterBody();
      break;
    case 'hamster-rates':
      title = '햄찌 뽑기 확률';
      body = '<table class="rate-table">' + HAMSTERS.map(h => '<tr><td>' + I(h.asset) + ' ' + h.name + ' · ' + h.grade + '</td><td>' + h.weight / 100 + '%</td></tr>').join('') + '</table><p>새 햄찌는 햄찌단에서 직접 팀에 넣어요. 이미 있는 햄찌가 나오면 다이아 ' + C.hamsterDupRefund + '를 돌려받고, 레벨업은 햄찌단에서 루비로 해요(최고 Lv.' + C.hamsterMaxLevel + ').</p>' + B('close', '확인');
      break;
    case 'rebirth': {
      const chance = E.rubyStageChance(s.runMax);
      title = '환생';
      body = '<div class="cream-box"><p>이번 광산에서 얻을 루비</p><div class="amount">' + I('ruby') + ' +' + E.rebirthReward(s) + '</div><p>돌, 이번 회차 스킬과 층수가 초기화됩니다.</p><p>곡괭이, 마스터리, 햄찌단, 다이아와 루비는 유지됩니다.</p></div>'
        + '<div class="cream-box ruby-chance">' + I('ruby') + '<div>루비 바위 출현 확률 <b>' + Math.round(chance * 100) + '%</b><small class="muted" style="display:block">' + (chance ? '환생 직후 ' + C.rubyStageSeconds + '초 동안 캐면 보너스 루비 최대 +' + Math.max(1, Math.round(E.rebirthReward(s) * C.rubyStageBonus)) : C.rubyStageMinFloor + '층부터 나타나요. 높이 갈수록 확률이 올라가요.') + '</small></div></div>'
        + B('confirm-rebirth', '환생하고 새 빌드 선택', 'cta', E.rebirthReward(s) && !s.dungeon && !s.draft ? '' : 'disabled') + '<p class="footnote">이번 회차 최고 ' + s.runMax + '층 · ' + C.rebirthMinFloor + '층부터 가능</p>';
      break;
    }
    case 'shop':
      E.refreshDay(s);
      title = '상점';
      body = SU.shopBody(s);
      break;
    case 'shop-product':
      title = shopBuy?.result ? '구매 완료' : '상품 구매';
      body = SU.productBody(E.shopProduct(shopBuy?.id), s, shopBuy?.result);
      break;
    case 'rates':
      title = '뽑기 확률';
      body = '<table class="rate-table">' + TIERS.map((t, i) => '<tr><td>' + I(pick(i)) + ' ' + t + '</td><td>' + DRAW_WEIGHTS[i] / 100 + '%</td></tr>').join('') + '</table><p>같은 등급 두 개를 합성하면 다음 등급이 되고, 강화로 곡괭이를 더 키울 수 있습니다. SS는 최고 등급입니다.</p>' + B('close', '확인');
      break;
    case 'ad':
      title = '테스트 광고';
      body = '<p>이 프로젝트는 광고 SDK가 연결되지 않은 로컬 시제품입니다.</p><p>아래 버튼으로 광고 완료 콜백을 시험합니다. 실제 서비스에서는 검증된 광고 완료 후에만 지급해야 합니다.</p>' + B('ad-complete', '테스트 완료 후 뽑기') + B('close', '취소', 'cta secondary');
      break;
    case 'dungeon':
      title = DU.dungeonTitle(dungeonPage);
      E.refreshDay(s);
      body = DU.dungeonBody(s,{page:dungeonPage,leaveConfirm:dungeonConfirm});
      break;
    case 'missions':
      title = SPU.seasonTitle();
      body = SPU.seasonBody(s,{start:seasonPage,confirm:seasonConfirm,tab:seasonTab});
      break;
    case 'offline':
      title = '오프라인 보상';
      body = '<div class="cream-box"><p>돌아왔어요. ' + Math.floor(offlineReward.elapsed / 60) + '분 동안</p><div class="amount">' + I('stone') + ' +' + fmt(offlineReward.amount) + '</div><p>돌을 얻었어요. 보상은 이미 저장되었습니다.</p><p>층수는 진행하지 않습니다.</p></div>' + B('close', '확인');
      break;
    case 'settings':
      title = '설정';
      body = '<p class="muted">웹 시제품 · 로컬 저장</p>' + [['sfx', '효과음'], ['bgm', '배경음'], ['haptic', '진동']].map(([key, label]) => B('toggle-setting', '<span>' + label + '</span><span class="toggle' + (s.settings[key] ? ' on' : '') + '" role="presentation"></span>', 'cta secondary setting-row', 'data-id="' + key + '" role="switch" aria-checked="' + s.settings[key] + '" aria-label="' + label + '"')).join('') + B('tutorial-replay', '튜토리얼 다시 보기', 'cta secondary') + B('export', '저장 파일 내보내기', 'cta secondary') + B('reset-confirm', '처음부터 새 게임', 'cta secondary') + '<p class="footnote">새 게임은 1층에서 빌드를 선택합니다.</p>';
      break;
    case 'reset-confirm':
      title = '새 게임 시작';
      body = '<p>이 브라우저에 저장된 진행을 새 게임으로 바꿉니다. 먼저 저장 파일을 내려받아 보관할 수 있습니다.</p>' + B('export', '현재 저장 파일 내려받기', 'cta secondary') + B('reset', '새 게임으로 초기화') + B('close', '취소', 'cta secondary');
      break;
    default:
      title = '알림';
      body = '<p>준비 중입니다.</p>';
  }
  shell(title, body, over, bare);
  if(modal==='dungeon'){
    root.querySelector('.modal').classList.add('dungeon-modal');
    dungeonStamp=DU.dungeonViewStamp(s,dungeonPage);
    DU.updateDungeonLive(root,s);
    if(dungeonConfirm){root.querySelector('.modal-header').inert=true;for(const el of root.querySelector('.dg-content').children)if(!el.classList.contains('dg-confirm-shade'))el.inert=true;root.querySelector('[data-act="dungeon-leave-cancel"]')?.focus({preventScroll:true});}
  }
  if (modal === 'shop') {
    root.querySelector('.modal').classList.add('shop-modal');
    bindDragScroll(root.querySelector('.modal-body'));
  }
  if (modal === 'equipment' && tab === 'merge' && bulkOpen) {
    const box = root.querySelector('.modal');
    box.style.position = 'relative';
    box.insertAdjacentHTML('beforeend', bulkPopup());
    a.apply(box);
    box.querySelector('.modal-header').inert = true;
    box.querySelector('.modal-body').inert = true;
    box.querySelector('.bulk-popup [data-act=bulk-merge]:not(:disabled), .bulk-popup [data-act=bulk-close]')?.focus({ preventScroll: true });
  }
  if(modal==='missions'){
    root.querySelector('.modal').classList.add('season-modal');
    root.querySelector('.modal').style.position='relative';
    seasonStamp=seasonViewStamp();
    SPU.bindSeasonCarousel(root,{start:seasonPage,onPage:level=>{seasonPage=level;}});
    if(seasonConfirm){root.querySelector('.modal-header').inert=true;for(const child of root.querySelector('.sp-content').children)if(!child.classList.contains('sp-confirm-shade'))child.inert=true;root.querySelector('[data-act="season-buy-cancel"]')?.focus({preventScroll:true});}
  }
  if(modal==='mastery'){
    root.querySelector('.modal').classList.add('mastery-modal');
    // 빈 곳을 누르면 말풍선을 닫는다
    MU.bindMasteryMap(root,{onBackground:()=>{if(chosenNode){chosenNode=null;renderModal();}}});
  }
  // 창 안에 새로 뜨는 작은 팝업(일괄 합성·시즌패스 구매 확인·던전 나가기 확인)도 처음 뜰 때만 튀어나온다(창을 다시 그릴 때마다 반복하지 않는다)
  const inner = modal === 'equipment' && tab === 'merge' && bulkOpen ? ['.bulk-shade', '.bulk-popup', 'bulk']
    : modal === 'missions' && seasonConfirm ? ['.sp-confirm-shade', '.sp-confirm', 'season']
    : modal === 'dungeon' && dungeonConfirm ? ['.dg-confirm-shade', '.dg-confirm', 'dungeon'] : null;
  if (inner && inner[2] !== lastInner && s.settings.motion) {
    root.querySelector(inner[0])?.classList.add('fade-in');
    root.querySelector(inner[1])?.classList.add('pop-in');
  }
  lastInner = inner ? inner[2] : null;
}

function mutate() {
  save();
  renderUpgrades();
  updateHud();
  if (modal)
    renderModal();
}

function seasonViewStamp(){const st=E.seasonStatus(s);return JSON.stringify([st.token,st.level,st.xp,st.days,st.premium,s.season.daily,s.season.claims]);}
function refreshSeasonView(){
  const rolled=E.syncSeason(s);
  if(rolled){seasonConfirm=false;seasonPage=1;save();}
  if(modal==='missions'&&seasonStamp!==seasonViewStamp()){
    const scroll=root.querySelector('.modal-body')?.scrollTop||0;
    renderModal();root.querySelector('.modal-body').scrollTop=scroll;
  }
}

// 상점 버튼은 항상 눌러지는 모양이라, 뽑기가 안 될 때는 눌렀을 때 이유를 알려 준다
function drawFailText(id) {
  const ten = id === 'diamond10', need = C.drawCost * (ten ? C.multiDraw : 1);
  if (s.inventory.length + (ten ? C.multiDraw : 1) > 200)
    return '장비함이 가득 찼어요. 곡괭이를 정리해 주세요.';
  if ((ten || id === 'diamond') && s.wallet.diamond < need)
    return '다이아가 부족해요. (필요 ' + need.toLocaleString('en-US') + ' · 보유 ' + Math.floor(s.wallet.diamond).toLocaleString('en-US') + ')';
  return '오늘 받을 수 있는 횟수를 모두 썼어요.';
}

function handle(e) {
  const btn = e.target.closest('button[data-act]');
  if (!btn || btn.disabled)
    return;
  const act = btn.dataset.act, id = btn.dataset.id;
  if (['profile', 'equipment', 'build', 'mastery', 'hamsters', 'hamster-rates', 'rebirth', 'shop', 'settings', 'missions', 'dungeon', 'rates', 'reset-confirm'].includes(act)) {
    // 위·아래 막대의 메뉴 버튼은 한 번 더 누르면 그 창을 닫는다(X로 닫는 것과 같다)
    if (hud.contains(btn) && modal && (modal === act || (act === 'shop' && modalBase === 'shop'))) {
      close(true);
      return;
    }
    open(act);
    return;
  }
  switch (act) {
    case 'season-buy':seasonConfirm=true;renderModal();return;
    case 'season-buy-cancel':seasonConfirm=false;renderModal();return;
    case 'season-buy-confirm':
      if(E.unlockSeasonPremium(s,btn.dataset.season))notify('프리미엄 시즌 패스 해금 완료!');
      else notify('시즌이 바뀌었거나 이미 이용 중이에요.');
      seasonConfirm=false;break;
    case 'season-tab':seasonTab=id;renderModal();return;
    case 'season-quest':{
      const [quest,tier]=id.split(':'),xp=E.claimSeasonQuest(s,quest,Number(tier),btn.dataset.season);
      if(xp)notify('패스 경험치 +'+xp);else notify('아직 받을 경험치가 없어요.');
      break;
    }
    case 'season-reward':{
      const [track,level]=id.split(':');
      const result=E.claimSeasonReward(s,track,Number(level),btn.dataset.season);
      notify(result?result.reward.label+' '+result.reward.amount+' 획득!':'보관 공간 또는 보상 수령 상태를 확인해 주세요.');break;
    }
    case 'season-all':{
      const result=E.claimAllSeason(s,btn.dataset.season);
      notify((result.xp?'경험치 +'+result.xp+' · ':'')+'보상 '+result.rewards.length+'개 수령'+(result.blocked?' · 공간이 부족한 보상은 남겨뒀어요':''));break;
    }
    case 'shop-product':
      shopBuy = { id, result: null };
      open('shop-product');
      return;
    case 'shop-buy': {
      // 테스트 구매: 돈은 오가지 않고 상품 내용만 지급한다
      const r = shopBuy && E.buyShopProduct(s, id);
      if (r) {
        shopBuy.result = r;
        notify(r.product.kind === 'pass' ? (r.diamonds ? '구매 완료! 오늘 다이아 +' + r.diamonds : '광고 제거 · 자동 강화 30일 이용권 활성화!') : '구매 완료! 다이아 +' + r.diamonds.toLocaleString('en-US') + (r.items.length ? ' · 곡괭이 ' + r.items.length + '개' : ''));
      }
      else
        notify('이미 이용 중이거나 보관 공간이 부족해 구매할 수 없어요.');
      break;
    }
    case 'close':
      close();
      return;
    case 'auto':
      if (!E.toggleAutoUpgrade(s)) {
        shopBuy = {id:'monthly_adfree', result:null};
        open('shop-product');
        return;
      }
      break;
    // 빌드 선택을 마치지 않은 채 창을 닫았을 때: 비어 있는 스킬 칸의 + 버튼으로 선택 창을 다시 연다
    case 'open-draft':
      if (s.draft)
        open('build');
      return;
    // 스킬 강화: 눌리는 순간 꾹 눌리고, 성공하면 카드가 통통 튀며 Lv.UP!이 떠오르고 살짝 진동한다. 실패하면 카드가 좌우로 떨린다.
    case 'upgrade':
      if (E.upgradeSkill(s, id)) {
        upgradeFx = { id, ok: true };
        buzz(10);
      }
      else {
        upgradeFx = { id, ok: false };
        notify('돌이 부족하거나 최대 레벨이에요.');
      }
      break;
    case 'tab':
      bulkOpen = false;
      tab = id;
      selection = [];
      break;
    case 'gear-pick':
      gearHamster = id;
      break;
    case 'unequip':
      if (E.unequip(s, gearHamster))
        notify('곡괭이를 내려놨어요.');
      break;
    case 'slot':
      if (tab === 'equip') {
        if (E.equip(s, Number(id), gearHamster))
          notify(shortName(gearHamster) + ' 햄찌가 곡괭이를 들었어요.');
      }
      else if (tab === 'enhance')
        selection = [Number(id)];
      else {
        // 합성 탭: 두 자루까지 고른다(다시 누르면 해제, 세 번째는 앞의 것을 밀어낸다)
        const n = Number(id);
        if (selection.includes(n))
          selection = selection.filter(x => x !== n);
        else if (selection.length < 2)
          selection.push(n);
        else
          selection = [selection[1], n];
      }
      break;
    case 'merge': {
      const r = E.merge(s, selection);
      if (r) {
        selection = [];
        notify(TIERS[r.tier] + ' 곡괭이로 합성했어요!');
      }
      else
        notify('같은 등급의 서로 다른 장비 두 개를 골라 주세요.');
      break;
    }
    case 'bulk-open':
      bulkOpen = true;
      break;
    case 'bulk-close':
      bulkOpen = false;
      break;
    case 'bulk-tier':
      bulkTier = Number(id);
      break;
    case 'bulk-merge': {
      const r = E.bulkMerge(s, bulkTier);
      if (r) {
        selection = [];
        const made = r.final.map((n, t) => n - r.start[t]).map((n, t) => n > 0 ? TIERS[t] + ' ' + n : '').filter(Boolean);
        notify('곡괭이 ' + r.used + '자루를 합쳐 ' + r.gainedTotal + '번 합성했어요 · ' + made.join(' · '));
        bulkOpen = false;
      }
      else
        notify('합칠 수 있는 같은 등급 짝이 없어요.');
      break;
    }
    case 'enhance': {
      const item = enhanceTarget();
      if (E.enhance(s, item.id))
        notify(TIERS[item.tier] + ' 곡괭이 +' + item.enh + ' 강화 성공!');
      else
        notify(E.enhanceCost(item) ? ((E.enhanceCost(item).ruby ? '돌과 루비가' : '돌이') + ' 부족해요.') : '이미 최대 강화예요.');
      break;
    }
    case 'choose':
      draftChoice = id;
      break;
    case 'confirm-skill':
      if (E.chooseSkill(s, draftChoice)) {
        draftChoice = null;
        if (!s.draft) {
          close();
          notify('채굴을 시작해요!');
        }
      }
      break;
    case 'view-skill':
      notify('환생 후 새 빌드를 고를 수 있어요.');
      return;
    case 'reroll':
      if(E.rerollDraft(s))draftChoice=null;break;
    case 'node':
      // 처음 누르면 아이콘 위에 말풍선(설명)이 또잉 하고 나오고, 같은 아이콘을 한 번 더 누르면 배운다(최종 노드는 흡수)
      if (chosenNode !== id) {
        chosenNode = id;
        mapFx = { pop: true };
      }
      else if (id === 'seal') {
        const before = E.stats(s), result = E.absorbMastery(s);
        if (result) {
          absorption = { ...result, before, after: E.stats(s) };
          chosenNode = null;
          modal = 'absorbed';
        }
        else {
          notify('루비가 부족해요.');
          mapFx = { bump: 'seal' };
        }
      }
      else if (E.buyMastery(s, id)) {
        mapFx = { bump: id };
        // 최고 레벨이 되면 말풍선을 닫아 새로 드러난 이웃 노드가 보이게 한다. 아직 오를 수 있으면 열어 두어 계속 누를 수 있다.
        const bought = M.nodes(s).find(x => x.id === id);
        if (bought && M.nodeLevel(s, id) >= bought.max)
          chosenNode = null;
        if (M.progress(s).ready) {
          // 마지막 노드를 배우면 기억의 심장이 나타난다: 지도 가운데로 옮기고 말풍선을 바로 연다
          chosenNode = 'seal';
          mapFx = { pop: true, bump: 'seal' };
          MU.centerOn('seal');
          notify('모든 노드 완성! 기억의 심장이 나타났어요.');
        }
      }
      else {
        const n = M.nodes(s).find(x => x.id === id), lv = M.nodeLevel(s, id);
        notify(!n ? '이 노드는 지금 배울 수 없어요.' : lv >= n.max ? '이미 최고 레벨이에요.' : !M.reachable(s, n) ? '앞 노드를 최고 레벨까지 올려야 해요.' : '루비가 부족해요.');
        mapFx = { bump: id };
      }
      break;
    case 'hamster-select':
      chosenHamster = id;
      break;
    case 'hamster-levelup': {
      const cost = E.hamsterLevelCost(s, id);
      if (E.levelUpHamster(s, id))
        notify('Lv.' + s.hamsters[id] + '로 올랐어요!');
      else
        notify(cost === null ? '이미 최고 레벨이에요.' : '루비가 부족해요. (필요 ' + fmt(cost) + ' · 보유 ' + fmt(s.wallet.ruby) + ')');
      break;
    }
    case 'hamster-toggle':
      if (E.toggleCrew(s, id))
        notify(s.crew.includes(id) ? '햄찌 3마리가 광산에 들어왔어요!' : '팀에서 뺐어요.');
      break;
    case 'hamster-draw':
      // 1회 또는 10연(data-id=10) 뽑기
      const hamsterResults = (id === String(C.multiDraw) ? E.drawHamsterMany(s) : [E.drawHamster(s)]) || [];
      if (hamsterResults[0]) {
        chosenHamster = hamsterResults[hamsterResults.length - 1].id;
        startGacha('hamster', hamsterResults);
      }
      else {
        const need = C.hamsterDrawCost * (id === String(C.multiDraw) ? C.multiDraw : 1);
        notify('다이아가 부족해요. (필요 ' + need.toLocaleString('en-US') + ' · 보유 ' + Math.floor(s.wallet.diamond).toLocaleString('en-US') + ')');
      }
      break;
    case 'confirm-rebirth': {
      const n = E.rebirth(s);
      if (n && s.rubyStage) {
        // 루비 바위 스테이지가 끝나면(rubyStageEnd) 빌드 선택을 연다
        close();
        notify('루비 ' + n + ' 획득! 루비 바위 출현! ' + C.rubyStageSeconds + '초 안에 캐면 보너스 루비');
      }
      else if (n) {
        modal = 'build';
        draftChoice = null;
        notify('루비 ' + n + ' 획득!');
      }
      break;
    }
    case 'draw':
      if (id === 'ad' && !E.hasAdFree(s)) {
        pendingDraw = 'ad';
        open('ad');
        return;
      }
      // 1회(무료·광고·다이아) 또는 다이아 10연(diamond10)
      const drawResults = id === 'diamond10' ? E.drawMany(s) || [] : [E.draw(s, id, tutorial?.drawRng())].filter(Boolean);
      if (drawResults.length)
        startGacha('pickaxe', drawResults);
      else
        notify(drawFailText(id));
      break;
    case 'ad-complete':
      if (pendingDraw === 'ad') {
        pendingDraw = null;
        const adResults = [E.draw(s, 'ad', Math.random, Date.now(), true)].filter(Boolean);
        if (adResults.length) {
          close();
          startGacha('pickaxe', adResults);
        }
        else {
          close();
          notify('오늘 광고 보상을 모두 받았어요.');
        }
      }
      break;
    case 'claim-mission': {
      const n = E.claimMission(s, id);
      if (n)
        notify('다이아 ' + n + ' 획득!');
      break;
    }
    case 'dungeon-select':dungeonPage=id;dungeonConfirm=false;renderModal();return;
    case 'dungeon-back':dungeonPage='select';renderModal();return;
    case 'dungeon-start':
      if(E.startDungeon(s,Date.now(),id)){
        dungeonPage=id;dungeonConfirm=false;dungeonHold=false;
        if(fixture){paused=false;$('pause').checked=false;}
        close(true);
        showDungeonLoading(id);
      }else notify('지금은 입장할 수 없어요. 입장 조건을 확인해 주세요.');
      break;
    case 'dungeon-stop':dungeonConfirm=true;renderModal();return;
    // 던전이 진행 중이면 이 창은 "나갈까요?"뿐이다: 계속하면 창만 닫고 무대로 돌아간다
    case 'dungeon-leave-cancel':if(s.dungeon){close(true);return;}dungeonConfirm=false;renderModal();return;
    // 나가기: 결과 창 없이 곧바로 로딩 씬을 거쳐 일반 화면으로 돌아간다(얻은 것은 알림으로)
    case 'dungeon-leave': {
      const r = E.leaveDungeon(s);
      dungeonConfirm = false;
      dungeonHold = false;
      close(true);
      showDungeonLoading('return');
      if (r)
        notify(r.kind === 'mine' ? '채굴을 마쳤어요 · 다이아 +' + r.diamond : '광산탑 도전 종료 · ' + (r.cleared ? r.floor + '층까지 돌파! ' : '') + '다이아 +' + r.diamond + ' · 루비 +' + r.ruby);
      break;
    }
    // 설정의 소리·진동 켜고 끄기(효과음·배경음 소리 자체는 아직 없다: 켜고 끈 값만 저장해 두었다가 소리가 들어오면 쓴다)
    case 'tutorial-replay':
      close(true);
      tutorial?.restart();
      return;
    case 'toggle-setting':
      if (['sfx', 'bgm', 'haptic'].includes(id))
        s.settings[id] = !s.settings[id];
      break;
    case 'export': {
      const url = URL.createObjectURL(new Blob([E.serialize(s)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'hamster-save.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    // 처음부터 새 게임: 진짜 첫 실행과 똑같이 시작한다(튜토리얼의 환영 말풍선이 먼저 뜨고, 스킬 고르기 창은 그 뒤에 열린다)
    case 'reset':
      close(true);
      s = E.createState(Date.now(), false);
      draftChoice = null;
      dungeonHold = false;
      world.clear();
      tutorial?.reset();
      if (!tutorial?.holdsBuild())
        open('build');
      break;
  }
  mutate();
}

// 고정 비교 화면: 새로운 연결 광맥에 실제 엔진 타격을 한 번 적용한다.
// 연쇄 번개가 이어지는 타격 직후, 자동 강화 켜짐. 실제 엔진 타격을 한 번 돌려 만든다(저장하지 않음).
// 루비 바위가 끝나면 보너스를 알리고, 환생 후 멈춰 있던 빌드 선택으로 넘어간다
function rubyStageEnded(e, left) {
  notify(left ? '자리를 비워 루비 바위가 끝났어요. 보너스 루비 +' + e.reward
    : e.cleared ? '루비 바위를 깼어요! 보너스 루비 +' + e.reward : '시간 종료! 깎은 만큼 보너스 루비 +' + e.reward);
  // 루비 바위 도중 이미 빌드를 골랐다면 선택 창을 다시 열지 않는다
  if (s.draft)
    open('build');
}

function stageFixture() {
  // Keep the connected cluster intact for the revised main-scene reference.
  s.autoUpgrade = false;
  s.unitClocks = [];
  world.events(E.attack(s, () => .99), s);
  world.render(s, .06);
}

function setupMasteryPreview(){
  s=E.createState();s.wallet.ruby=100000;paused=true;s.autoUpgrade=false;mapOverview=true;
  if(masteryPreview==='start'){s.wallet.ruby=60;mapOverview=false;return;}
  const maxAll=()=>{for(const n of M.nodes(s))while(M.nodeLevel(s,n.id)<n.max)E.buyMastery(s,n.id);};
  if(['ready','repeat','profile','draft'].includes(masteryPreview))maxAll();
  else {E.buyMastery(s,'root');for(const n of M.nodes(s).slice(1)){const target=n.unlock?(n.branch==='power'?1:0):n.branch==='power'||n.branch==='stone'?3:Number(n.id.split('_')[1])<2?3:Number(n.id.split('_')[1])<3?2:0;for(let i=0;i<target;i++)E.buyMastery(s,n.id);}chosenNode='fortune_2';}
  if(['repeat','profile'].includes(masteryPreview)){E.absorbMastery(s);E.buyMastery(s,'root');M.nodes(s).slice(1,8).forEach((n,k)=>{for(let i=0;i<(k<6?3:2);i++)E.buyMastery(s,n.id);});}
  if(masteryPreview==='draft'){s.runMax=30;E.rebirth(s,()=>.9);}
  if(masteryPreview==='ready')chosenNode='seal';
  s.wallet.ruby=masteryPreview==='ready'?sealPrice(1)+120:420;
}

async function start() {
  try {
    a = await new Assets().load({ lazy: true });   // 시작에 꼭 필요한 시트만 기다린다(나머지는 아래 warm)
    let raw = null;
    try {
      if (!fixture)
        raw = localStorage.getItem(C.saveKey);
    }
    catch {
    }
    s = E.parseState(raw) || E.createState(Date.now(), fixture && !tutorialPreview);
    if (raw && !E.parseState(raw))
      notify('저장 형식을 확인할 수 없어 새 게임으로 시작합니다.');
    offlineReward = E.claimOffline(s);
    if (offlineReward.ruby)
      notify('자리를 비워 루비 바위가 끝났어요. 보너스 루비 +' + offlineReward.ruby.reward);
    if (fixture) {
      paused = !tutorialPreview && new URLSearchParams(location.search).get('animate') !== '1';
      $('pause').checked = paused;
    }
    if(masteryPreview)setupMasteryPreview();
    if(seasonPreview){s.season=newSeason(Date.now()-9*SEASON_DAY);E.syncSeason(s);s.season.xp=3340;s.season.claims.free=[1,2,3,4,5,6];s.season.daily.progress={rebirth:2,mined:640,stages:20};s.season.daily.claims={rebirth:[0],mined:[0],stages:[]};s.season.xp+=210;}
    if(dungeonPreview)s.dungeonProgress.towerBest=7;
    world = new World($('world'), a, mineralPreview);
    if (fixture && !tutorialPreview)
      stageFixture();
    if (['copper', 'emerald', 'ruby'].includes(bannerPreview)) {
      E.resetVein(s, () => ({copper: .8, emerald: .9, ruby: .99})[bannerPreview]);
      world.stageKey = s.floor + ':' + s.floorKind;
      world.stageFx = {kind: bannerPreview, t: .8};
    }
    buildHud();
    tutorial = createTutorial({ game, enabled: !fixture || tutorialPreview, getState: () => s, ui: () => ({ modal, tab, busy: dungeonLoading, gacha: gachaOn }), actions: { open: name => open(name), closeAll: () => close(true), refresh: () => mutate(), save, notify } });
    updatePasses();
    $('loading').remove();
    resize();
    save();
    if (offlineReward.amount > 0)
      open('offline');
    else if (s.draft && !tutorial.holdsBuild())
      open('build');
    if(masteryPreview){previewBoot=true;open(masteryPreview==='profile'?'profile':masteryPreview==='draft'?'build':'mastery');previewBoot=false;}
    if(shopPreview) open('shop');
    if(seasonPreview) open('missions');
    a.warm();   // 상점·패스·광맥 배너 그림 등 나머지 시트는 첫 화면 뒤 한가할 때 한 장씩
    setTimeout(preloadGacha, 3000);   // 뽑기 연출 그림(상자·배경·문양)은 시작 직후 한가할 때 미리 받아 둔다
    if(gachaPreview)previewGacha();
    if(dungeonPreview){open('dungeon');if(['mine','tower'].includes(dungeonPreview)){dungeonPage=dungeonPreview;renderModal();}}
    hud.addEventListener('click', handle);
    root.addEventListener('click', handle);
    document.addEventListener('pointerdown', () => { keyboardUse = false; }, true);
    document.addEventListener('keydown', e => {
      keyboardUse = true;
      if (e.key === 'Escape' && modal) {
        close();
        return;
      }
      if (e.key === 'Tab' && modal) {
        const els = [...root.querySelectorAll('button:not(:disabled),a[href]')].filter(el=>!el.closest('[inert]'));
        const i = els.indexOf(document.activeElement);
        if ((e.shiftKey && i <= 0) || (!e.shiftKey && i === els.length - 1)) {
          e.preventDefault();
          els[e.shiftKey ? els.length - 1 : 0]?.focus();
        }
      }
    });
    $('compare').addEventListener('change', e => {
      if (e.target.checked) {
        const im = document.createElement('img');
        im.id = 'reference-overlay';
        im.src = 'references/main-approved.png';
        im.alt = '승인 기준 이미지 반투명 비교';
        game.append(im);
      }
      else
        $('reference-overlay')?.remove();
    });
    $('pause').addEventListener('change', e => paused = e.target.checked);
    // 비교·일시정지 도구는 고정 화면(?fixture=approved)이나 ?dev에서만 보인다. 일반 플레이에서는 하단 메뉴를 가린다.
    if (masteryPreview || shopPreview || seasonPreview || dungeonPreview || (!fixture && !new URLSearchParams(location.search).has('dev')))
      $('dev-tools').style.display = 'none';
    document.addEventListener('visibilitychange', () => {
      if (document.hidden)
        save();
      else {
        updatePasses();
        const reward = E.claimOffline(s);
        if(reward.dungeon){dungeonConfirm=false;if(modal==='dungeon')renderModal();notify(reward.dungeon.kind==='mine'?'자리를 비워 채굴이 종료됐어요. 캔 다이아는 유지됩니다.':'타워 도전이 종료됐어요. 최고 기록은 유지됩니다.');}
        lastTime = performance.now();
        if (reward.ruby)
          rubyStageEnded(reward.ruby, true);
        if (reward.amount) {
          offlineReward = reward;
          open('offline');
        }
        save();
      }
    });
    window.addEventListener('pagehide', save);
    window.addEventListener('resize', resize);
    new ResizeObserver(resize).observe($('viewport'));
    requestAnimationFrame(loop);
  }
  catch (err) {
    $('loading').textContent = err.message + ' · npm start로 실행해 주세요.';
    console.error(err);
  }
}

function loop(now) {
  frame(now);
  requestAnimationFrame(loop);
}

// 뽑기 연출: 엔진이 이미 정한 결과를 장면(상자가 떨어져 열리는 연출)으로 보여 준다. 끝나면 상점으로 돌아온다.
function startGacha(kind, list) {
  if (gachaOn || !list.length)
    return;
  const hamster = kind === 'hamster', many = list.length > 1;
  const results = list.map(r => {
    if (!hamster)
      return { icon: pick(r.tier), grade: TIERS[r.tier], name: TIERS[r.tier] + '등급 곡괭이', sub: '장비함에 추가했어요.', tag: TIERS[r.tier] + '급' };
    const h = HAMSTERS.find(x => x.id === r.id);
    const sub = r.isNew ? '새 햄찌 합류! 햄찌단에서 팀에 넣어 주세요.' : '이미 있는 햄찌예요. 다이아 ' + r.refund + '를 돌려받았어요.';
    return { icon: h.asset, grade: h.grade, name: h.name, sub, isNew: r.isNew, tag: r.isNew ? 'NEW' : '환급' };
  });
  let summary = '';
  if (many && !hamster)
    summary = '장비함에 ' + list.length + '자루를 추가했어요 · 최고 ' + TIERS[Math.max(...list.map(x => x.tier))] + '등급';
  else if (many) {
    const refund = list.reduce((n, r) => n + r.refund, 0);
    summary = '새 햄찌 ' + list.filter(r => r.isNew).length + '마리' + (refund ? ' · 중복 다이아 ' + refund + ' 환급' : '') + ' · 팀은 햄찌단에서 직접 넣어요';
  }
  gachaOn = true;
  playGacha({ game, assets: a, kind, results, summary, title: (hamster ? '햄찌단 ' : '곡괭이 ') + (many ? list.length + '회 ' : '') + (hamster ? '모집' : '뽑기'), motion: s.settings.motion && !matchMedia('(prefers-reduced-motion: reduce)').matches, haptic: s.settings.haptic,
    onClose: () => { gachaOn = false; mutate(); } }).catch(() => { gachaOn = false; });
}

// 미리보기: 결과를 직접 지어 연출만 확인한다. g=등급 목록(곡괭이는 D~SS, 햄찌는 D~S)
function previewGacha() {
  const p = new URLSearchParams(location.search), many = gachaPreview.endsWith('10'), hamster = gachaPreview.startsWith('hamster');
  const gs = (p.get('g') || (many ? 'D,D,C,C,B,B,A,S,C,D' : 'A')).split(',');
  const n = many ? 10 : 1;
  const list = Array.from({ length: n }, (_, i) => {
    const g = gs[i % gs.length];
    if (!hamster)
      return { id: i + 1, tier: Math.max(0, TIERS.indexOf(g)) };
    const h = HAMSTERS.find(x => x.grade === g) || HAMSTERS[HAMSTERS.length - 1];
    return { id: h.id, isNew: i % 3 === 0, level: 1, refund: i % 3 === 0 ? 0 : C.hamsterDupRefund };
  });
  startGacha(hamster ? 'hamster' : 'pickaxe', list);
}

// 진동(설정에서 켜 둔 기기만, 사용자가 한 번 눌러 본 뒤부터). 너무 자주는 울리지 않는다.
function buzz(ms, now = performance.now()) {
  if (s.settings.haptic && navigator.vibrate && navigator.userActivation?.hasBeenActive) {
    navigator.vibrate(ms);
    lastBuzz = now;
  }
}

// 던전 입장 로딩 화면: 새 무대가 열리는 동안 화면을 덮고 게임 시간을 멈춘 뒤, 걷히면 시간이 흐르기 시작한다.
// 엔진은 이미 무대를 바꿔 놓았으므로(입장 횟수도 차감됨) 덮개 뒤에서 결정이 솟아오를 준비를 한다.
function showDungeonLoading(kind) {
  let el = $('stage-loading');
  if (!el) {
    el = document.createElement('div');
    el.id = 'stage-loading';
    el.setAttribute('role', 'status');
    game.append(el);
  }
  // 승인된 로딩 씬(assets/ui/loading-scene-v1.webp: "햄찌 이동 중…")을 그대로 쓴다
  el.className = 'stage-loading ' + kind;
  el.innerHTML = '<img class="sl-art" src="assets/ui/loading-scene-v1.webp" alt="햄찌 이동 중… 조금만 기다려요" draggable="false">';
  el.hidden = false;
  el.classList.remove('leaving');
  dungeonLoading = true;
  clearTimeout(dungeonLoadTimer);
  dungeonLoadTimer = setTimeout(endDungeonLoading, DUNGEON_LOAD_MS);
}

// 결과 창을 닫았다: 로딩 화면을 덮고 그 밑에서 일반 화면으로 되돌린다
function releaseDungeonHold() {
  if (!dungeonHold)
    return;
  dungeonHold = false;
  showDungeonLoading('return');
}

function endDungeonLoading() {
  clearTimeout(dungeonLoadTimer);
  if (!dungeonLoading)
    return;
  dungeonLoading = false;
  // 시간은 덮개가 걷히는 지금부터 흐른다
  if (s.dungeon) {
    s.dungeon.startedAt = Date.now();
    s.dungeon.elapsed = 0;
  }
  world.popStart = world.clock;
  lastTime = 0;
  const el = $('stage-loading');
  if (el) {
    el.classList.add('leaving');
    setTimeout(() => { if (!dungeonLoading) el.hidden = true; }, 450);
  }
}

function frame(now, force = false) {
  const dt = lastTime ? clampDt((now - lastTime) / 1000) : 0;
  lastTime = Math.max(lastTime, now);
  tutorial?.update(dt);
  if (!paused && !dungeonLoading && !dungeonHold && !tutorial?.pausesGame() && (force || !document.hidden)) {
    const ev = E.step(s, dt);
    world.events(ev, s);
    // 진동(설정에서 켜 둔 기기만): 결정이 깨질 때 짧게, 너무 자주는 울리지 않는다
    if (now - lastBuzz > 140 && ev.some(e => e.type === 'break'))
      buzz(12, now);
    if(modal==='dungeon')DU.dungeonEffects(root,ev,s.settings.motion);
    for (const e of ev) {
      // 구리·에메랄드·루비 광맥 층은 화면 연출이 알려 주므로 도착 알림을 겹쳐 띄우지 않는다
      if (e.type === 'floor' && (!e.kind || e.kind === 'stone'))
        notify(e.floor + '층 도착!');
      if (e.type === 'stageClear')
        notify('루비 광맥을 다 깼어요! 루비 +' + e.ruby);
      if (e.type === 'floorFail')
        notify('시간 초과! ' + e.floor + '층에 다시 도전해요. 스킬을 강화해 보세요.');
      if(e.type==='dungeonGem')save();
      if(e.type==='dungeonRefill')notify(e.level+'회차! 결정이 더 단단해졌어요');
      if(e.type==='towerFloor'){save();notify(e.floor+'층 돌파! 다이아 +'+e.diamond+' · 루비 +'+e.ruby);}
      if(e.type==='dungeonEnd'){
        dungeonConfirm=false;save();
        // 끝나면 결과를 보여 준다(다른 창을 보던 중이면 방해하지 않고 알림만)
        dungeonPage=e.kind;
        if(modal==='dungeon-exit')close(true);
        // 결과 창을 보여 줄 때는 화면을 던전 마지막 장면에 붙잡아 둔다(이 프레임은 일반 화면을 그리지 않는다)
        if(!modal||modal==='dungeon')dungeonHold=true;
        if(!modal){open('dungeon');dungeonPage=e.kind;renderModal();}
        else if(modal==='dungeon')renderModal();
        notify(e.kind==='mine'?'다이아 광산 완료! 다이아 +'+e.diamond:'광산탑 도전 종료 · '+(e.cleared?e.floor+'층까지 돌파! ':'')+'다이아 +'+e.diamond+' · 루비 +'+e.ruby);
      }
      if (e.type === 'rubyStageEnd')
        rubyStageEnded(e, false);
    }
    if (!dungeonHold)
      world.render(s, dt);
  }
  else if (!dungeonHold)
    world.render(s, 0);
  if (now - lastHud > 300) {
    if (!document.hidden) updatePasses();
    if (!document.hidden) refreshSeasonView();
    if(!document.hidden&&modal==='dungeon'){
      E.refreshDay(s);
      if(dungeonStamp!==DU.dungeonViewStamp(s,dungeonPage))renderModal();
      DU.updateDungeonLive(root,s);
    }
    updateHud();
    if (s.autoUpgrade)
      renderUpgrades();
    lastHud = now;
  }
  if (now - lastSave > C.saveInterval && !document.hidden) {
    save();
    lastSave = now;
  }
}

const clampDt = dt => Math.min(Math.max(dt, 0), .1);

// ?dev·?fixture 전용: 탭이 가려져 requestAnimationFrame이 멈춘 환경(자동 검증 등)에서 시간을 직접 흘려 연출을 확인한다.
// fixture에서는 일시정지를 잠깐 풀고 돌리며, fixture는 저장하지 않으므로 실제 진행이 바뀌지 않는다.
if (fixture || new URLSearchParams(location.search).has('dev'))
  window.hamsterDev = {
    // 검증용 상태 접근. fixture는 저장하지 않으므로 여기서 바꾼 값은 새로고침하면 사라진다.
    state: () => s,
    world: () => world,
    advance(seconds, fps = 60) {
      if (dungeonLoading) endDungeonLoading();
      const wasPaused = paused;
      paused = false;
      let t = lastTime || performance.now();
      for (let i = 0; i < seconds * fps; i++)
        frame(t += 1000 / fps, true);
      paused = wasPaused;
      updateHud();
      if (modal)
        renderModal();
      return { floor: s.floor, stone: Math.floor(s.wallet.stone), living: s.ores.filter(o => o.hp > 0).length, left: Math.ceil(C.floorSeconds - s.floorElapsed), fx: world.fx.length, parts: world.parts.length };
    }
  };
start();
