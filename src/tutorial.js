import * as E from './engine.js';
import * as M from './mastery-state.js';
import { CONFIG as C } from '../data/config.js';
import { TUTORIAL, TUTORIAL_TEXT } from '../data/tutorial.js';

// 튜토리얼 안내. 화면을 어둡게 덮고 눌러야 할 곳만 동그랗게 밝힌 뒤 햄찌 말풍선으로 설명한다.
//  · 1부(CH1): 새 게임 첫 3분. info=말풍선만(게임 시간이 멈춤, "다음"), action=밝은 곳을 실제로 눌러야 넘어감, wait=조건이 될 때까지 아무것도 안 덮음.
//  · 2부(CH2): 처음 10층에 닿으면 이어지는 환생 → 마스터리 → 햄찌단 안내(전부 직접 눌러 보며 진행).
//  · 임무·던전은 마무리 말풍선이 짚어 주고, 건너뛴 경우에만 3층·5층에서 한 번씩 따로 안내한다(TIPS).
// 진행 상황(s.tutorial)은 저장에 들어간다. 단계 조건은 화면에서 읽은 상태(ui)와 게임 상태(s)만 본다.
const q = selector => () => document.querySelector(selector);
const nav = act => q(`#hud .nav [data-act=${act}]`);
const skillSum = s => s.skills.reduce((n, k) => n + k.level, 0);
const affordable = s => s.skills.filter(k => k.level < C.maxSkillLevel && s.wallet.stone >= E.upgradeCost(k, s));
const upgradeButton = c => {
  const best = affordable(c.s).sort((a, b) => E.upgradeCost(a, c.s) - E.upgradeCost(b, c.s))[0];
  return best ? document.querySelector(`#hud [data-act=upgrade][data-id="${best.id}"]`) : null;
};
// 합성할 수 있는 같은 등급 쌍이 있는가(맨 위 등급은 합칠 수 없다)
const hasPair = s => { const n = {}; for (const x of s.inventory) n[x.tier] = (n[x.tier] || 0) + 1; return Object.entries(n).some(([tier, count]) => count >= 2 && Number(tier) < 5); };
// 화면 가운데 광맥, 위쪽 이 층의 시간·내구도 막대(캔버스에 그려져 있어 칸 좌표로 가리킨다)
const VEIN_RECT = { x: 170, y: 390, w: 610, h: 520 };
const TIMER_RECT = { x: 340, y: 232, w: 300, h: 114 };

const CH1 = [
  { id: 'welcome', kind: 'info', rect: VEIN_RECT, noModal: true, onNext: c => { if (c.s.draft) c.actions.open('build'); } },
  { id: 'draft', kind: 'action', target: q('#modal-root .modal-body'), skipIf: c => !c.s.draft, done: c => !c.s.draft,
    keep: c => { if (c.s.draft && c.ui.modal !== 'build') c.actions.open('build'); } },
  { id: 'stones', kind: 'info', noModal: true, target: q('#hud .moneybar .money') },
  { id: 'wait-upgrade', kind: 'wait', done: c => affordable(c.s).length > 0 },
  { id: 'upgrade', kind: 'action', target: upgradeButton, noModal: true, skipIf: c => !affordable(c.s).length, done: c => skillSum(c.s) > c.base.skills },
  { id: 'wait-floor', kind: 'wait', done: c => c.s.floor >= 2 },
  { id: 'floor', kind: 'info', noModal: true, rect: TIMER_RECT },
  { id: 'shop-open', kind: 'action', target: nav('shop'), done: c => c.ui.modal === 'shop' },
  // 무료 뽑기가 남았으면 눌러 보게 하고(결과는 곡괭이 합성을 보여 줄 수 있게 정해 둔다: drawRng), 이미 썼으면 위치만 알려 준다
  { id: 'shop-draw', kind: c => (c.s.daily.free < C.dailyFreeDraws ? 'action' : 'info'), text: c => (c.s.daily.free < C.dailyFreeDraws ? 'shop-draw' : 'shop-draw-info'),
    target: q('#modal-root .shop-actions [data-act=draw]'), valid: c => c.ui.modal === 'shop', back: 'shop-open',
    done: c => c.ui.gacha || c.s.daily.free > c.base.free },
  // 뽑기 연출 장면이 끝나 상점으로 돌아오면 장비 버튼을 밝히며 합성을 안내한다(장면이 떠 있는 동안은 덮개를 숨긴다)
  { id: 'draw-result', kind: 'info', target: nav('equipment'), skipIf: c => !c.ui.gacha, onNext: c => c.actions.closeAll() },
  { id: 'equip-open', kind: 'action', target: nav('equipment'), skipIf: c => !hasPair(c.s), skipTo: 'finale', done: c => c.ui.modal === 'equipment' },
  { id: 'equip-tab', kind: 'action', target: q('#modal-root .tabs [data-id=merge]'), valid: c => c.ui.modal === 'equipment', back: 'equip-open', done: c => c.ui.tab === 'merge' },
  { id: 'equip-merge', kind: 'action', target: q('#modal-root .modal-body'), valid: c => c.ui.modal === 'equipment' && c.ui.tab === 'merge', back: 'equip-open',
    skipIf: c => !hasPair(c.s), done: c => c.s.inventory.length < c.base.inv },
  { id: 'equip-done', kind: 'info', target: q('#modal-root .modal-body'), valid: c => c.ui.modal === 'equipment', back: 'equip-open', onNext: c => c.actions.closeAll() },
  { id: 'finale', kind: 'info', target: q('#hud .side-tools'), last: true, onEnter: c => c.actions.closeAll() }
];

// 2부: 처음 10층에서 환생 → 새 빌드 → 마스터리 배우기 → 햄찌단 둘러보기
const CH2 = [
  { id: 'rb-open', kind: 'action', target: nav('rebirth'), done: c => c.ui.modal === 'rebirth' },
  { id: 'rb-do', kind: 'action', target: q('#modal-root [data-act=confirm-rebirth]'), valid: c => c.ui.modal === 'rebirth' || c.s.rebirths >= 1, back: 'rb-open', done: c => c.s.rebirths >= 1 },
  { id: 'rb-draft', kind: 'action', target: q('#modal-root .modal-body'), skipIf: c => !c.s.draft, done: c => !c.s.draft,
    keep: c => { if (c.s.draft && c.ui.modal !== 'build') c.actions.open('build'); } },
  { id: 'ms-open', kind: 'action', target: nav('mastery'), done: c => c.ui.modal === 'mastery' },
  { id: 'ms-learn', kind: 'action', target: q('#modal-root .map-node[data-id=root]'), valid: c => c.ui.modal === 'mastery', back: 'ms-open',
    skipIf: c => M.nodeLevel(c.s, 'root') >= 1, done: c => M.nodeLevel(c.s, 'root') >= 1 },
  { id: 'ms-done', kind: 'info', target: q('#modal-root .modal-body'), valid: c => c.ui.modal === 'mastery', back: 'ms-open', onNext: c => c.actions.closeAll() },
  { id: 'hm-open', kind: 'action', target: nav('hamsters'), done: c => c.ui.modal === 'hamsters' },
  { id: 'hm-tap', kind: 'action', target: q('#modal-root .outfits .outfit:not(.active)'), valid: c => c.ui.modal === 'hamsters', back: 'hm-open', done: c => c.clicked('.outfits .outfit') },
  { id: 'hm-done', kind: 'info', target: q('#modal-root .team-slots'), valid: c => c.ui.modal === 'hamsters', back: 'hm-open', last: true, onNext: c => c.actions.closeAll() }
];

const TIPS = [
  { id: 'missions', when: c => c.s.lifetimeMax >= TUTORIAL.tipFloors.missions, target: q('#hud [data-act=missions]') },
  { id: 'dungeon', when: c => c.s.lifetimeMax >= TUTORIAL.tipFloors.dungeon, target: q('#hud [data-act=dungeon]') }
];

const HIDE_OVER = new Set(['offline', 'reset-confirm', 'ad', 'settings']);

export function createTutorial({ game, getState, ui, actions, enabled = true }) {
  const W = C.designWidth, H = C.designHeight;
  const el = document.createElement('div');
  el.id = 'tutorial';
  el.hidden = true;
  el.innerHTML = `<div class="tut-block" data-b="top"></div><div class="tut-block" data-b="bottom"></div><div class="tut-block" data-b="left"></div><div class="tut-block" data-b="right"></div><div class="tut-block clear" data-b="center"></div>
    <div class="tut-ring"></div>
    <div class="tut-bubble" role="dialog" aria-label="햄찌의 안내" aria-live="polite">
      <i class="tut-pin left" aria-hidden="true"></i><i class="tut-pin right" aria-hidden="true"></i>
      <button type="button" class="tut-skip">
        <span class="tut-skip-content"><svg class="tut-pickaxe" viewBox="0 0 64 64" aria-hidden="true"><path d="M36 22 9 51a5.5 5.5 0 0 0 8 8l27-30-8-7Z"/><path d="M12 7c15-2 26 3 33 11l5-4a3 3 0 0 1 4 1l4 5a3 3 0 0 1-1 4l-5 4c5 9 8 18 7 28 0 3-3 4-4 1-5-11-11-20-20-28C26 21 18 16 9 13c-4-1-2-5 3-6Z"/></svg><span class="tut-skip-label">건너뛰기</span></span>
      </button>
      <div class="tut-portrait">
        <svg class="tut-sparkle left" viewBox="0 0 40 48" aria-hidden="true"><path d="M20 3 25 18 37 24 25 30 20 45 15 30 3 24 15 18Z"/></svg>
        <img class="tut-face" src="assets/characters/tutorial-guide-v3.webp" alt="안내 햄찌" draggable="false">
        <svg class="tut-sparkle right" viewBox="0 0 40 48" aria-hidden="true"><path d="M20 3 25 18 37 24 25 30 20 45 15 30 3 24 15 18Z"/></svg>
      </div>
      <div class="tut-copy"><p class="tut-title"></p><p class="tut-detail"></p></div>
      <div class="tut-actions"><button type="button" class="tut-next">다음</button></div>
      <svg class="tut-corner" viewBox="0 0 48 44" aria-hidden="true"><rect x="30" y="1" width="10" height="26" rx="4" transform="rotate(-20 35 14)"/><rect x="8" y="22" width="10" height="25" rx="4" transform="rotate(-65 13 34)"/></svg>
    </div>`;
  game.append(el);
  const blocks = Object.fromEntries([...el.querySelectorAll('.tut-block')].map(b => [b.dataset.b, b]));
  const ring = el.querySelector('.tut-ring'), bubble = el.querySelector('.tut-bubble');
  const title = el.querySelector('.tut-title'), detail = el.querySelector('.tut-detail'), actionsRow = el.querySelector('.tut-actions');
  const next = el.querySelector('.tut-next'), skip = el.querySelector('.tut-skip');
  const skipLabel = el.querySelector('.tut-skip-label');
  let lastMessage = null;

  let entered = null, base = { skills: 0, inv: 0, free: 0 }, clock = 0, lastTipAt = -999, current = null, skipArmed = 0, visible = false, shownKind = null, lastClick = null;
  // 단계가 시작된 뒤에 눌린 곳(누른 것을 확인하는 단계용)
  game.addEventListener('click', e => { lastClick = e.target; }, true);

  const ctx = () => ({ s: getState(), ui: ui(), base, actions, clicked: selector => !!lastClick?.closest?.(selector) });
  const hide = () => { if (visible) { el.hidden = true; visible = false; shownKind = null; } };
  const kindOf = (step, c) => (typeof step.kind === 'function' ? step.kind(c) : step.kind);
  // 문구만 갱신해도 곡괭이 아이콘과 중앙 정렬 묶음은 그대로 유지한다.
  const updateSkipLabel = () => {
    const label = skipArmed ? '정말 건너뛸까요?' : '건너뛰기';
    if (skipLabel.textContent !== label) skipLabel.textContent = label;
    const armed = String(!!skipArmed);
    if (skip.dataset.armed !== armed) skip.dataset.armed = armed;
  };

  // 화면(CSS px) 사각형 → 디자인 좌표. #game은 화면에 맞춰 scale로 줄어든다.
  const toDesign = r => {
    const g = game.getBoundingClientRect(), k = g.width / W;
    return { x: (r.left - g.left) / k, y: (r.top - g.top) / k, w: r.width / k, h: r.height / k };
  };
  const box = (node, x, y, w, h) => { node.style.cssText = `left:${x}px;top:${y}px;width:${Math.max(0, w)}px;height:${Math.max(0, h)}px`; };

  function persist() { actions.save?.(); }

  // 지금 진행 중인 부(1부/2부)를 하나로 다룬다
  function chapter(s) {
    const t = s.tutorial;
    if (!t.done)
      return { key: 'a', steps: CH1, index: t.step, set: i => { t.step = i; }, end: () => finish(), skippable: true };
    if (t.rb > 0)
      return { key: 'b', steps: CH2, index: t.rb - 1, set: i => { t.rb = i + 1; }, end: () => finishRebirth(), skippable: true };
    return null;
  }

  function finish() {
    const t = getState().tutorial;
    t.done = true;
    // 마무리 말풍선이 던전·임무 버튼을 이미 짚어 줬으므로 같은 안내를 또 띄우지 않는다
    for (const id of ['missions', 'dungeon']) if (!t.tips.includes(id)) t.tips.push(id);
    lastTipAt = clock;
    current = null;
    hide();
    persist();
  }

  function finishRebirth() {
    getState().tutorial.rb = -1;
    lastTipAt = clock;
    current = null;
    hide();
    persist();
  }

  // to: 건너뛸 때 이어질 단계 id(없으면 바로 다음 단계)
  function advance(ch, to) {
    entered = null;
    skipArmed = 0;
    const target = to ? ch.steps.findIndex(x => x.id === to) : -1;
    const nextIndex = target >= 0 ? target : ch.index + 1;
    if (nextIndex >= ch.steps.length) ch.end();
    else {
      ch.set(nextIndex);
      persist();
    }
  }

  // 구멍(밝은 곳)과 말풍선을 그린다. hole이 없으면 화면 전체를 어둡게만 한다.
  function show({ hole, text: message, kind, label, onNext, canSkip }) {
    if (!visible) { el.hidden = false; visible = true; }
    shownKind = kind;
    const pad = 14, h = hole ? { x: Math.max(0, hole.x - pad), y: Math.max(0, hole.y - pad), w: hole.w + pad * 2, h: hole.h + pad * 2 } : { x: W / 2, y: H / 2, w: 0, h: 0 };
    box(blocks.top, 0, 0, W, h.y);
    box(blocks.bottom, 0, h.y + h.h, W, H - (h.y + h.h));
    box(blocks.left, 0, h.y, h.x, h.h);
    box(blocks.right, h.x + h.w, h.y, W - (h.x + h.w), h.h);
    box(blocks.center, h.x, h.y, h.w, h.h);
    blocks.center.hidden = kind !== 'info';   // 눌러야 하는 단계에서는 구멍이 뚫려 있다
    ring.hidden = !hole;
    if (hole) box(ring, h.x, h.y, h.w, h.h);
    if (lastMessage !== message) {
      const [headline, ...lines] = message.split('\n');
      title.textContent = headline;
      detail.textContent = lines.join('\n');
      detail.hidden = !lines.length;
      lastMessage = message;
    }
    bubble.style.width = Math.min(820, W - 60) + 'px';
    next.hidden = kind !== 'info';
    actionsRow.hidden = kind !== 'info';
    bubble.dataset.kind = kind;
    next.textContent = label || '다음';
    skip.hidden = !canSkip;
    updateSkipLabel();
    current = { onNext };
    // 말풍선: 구멍 아래(없으면 위)나 화면 위쪽에 둔다
    const bw = Math.min(820, W - 60), bh = bubble.offsetHeight || 220;
    let top;
    if (!hole) top = H / 2 - bh / 2;
    else if (h.y + h.h + 60 + bh < H - 230) top = h.y + h.h + 56;
    else if (h.y - 40 - bh > 150) top = h.y - 36 - bh;
    else top = 150;
    const left = (W - bw) / 2;
    bubble.style.left = left + 'px';
    bubble.style.top = top + 'px';
  }

  function runChapter(c, ch) {
    const s = c.s;
    if (HIDE_OVER.has(c.ui.modal) || c.ui.busy) { hide(); return; }
    const step = ch.steps[ch.index];
    if (!step) { ch.end(); return; }
    const key = ch.key + ch.index;
    if (entered !== key) {
      entered = key;
      lastClick = null;
      base = { skills: skillSum(s), inv: s.inventory.length, free: s.daily.free };
      c.base = base;
      step.onEnter?.(c);
      if (step.skipIf?.(c)) { advance(ch, step.skipTo); return; }
    }
    if (step.valid && !step.valid(c)) {
      ch.set(Math.max(0, ch.steps.findIndex(x => x.id === step.back)));
      entered = null;
      hide();
      return;
    }
    if (step.noModal && c.ui.modal) { hide(); return; }
    step.keep?.(c);
    if (step.done?.(c)) { advance(ch); return; }
    const kind = kindOf(step, c);
    if (kind === 'wait') { hide(); return; }
    let hole = null;
    if (step.rect) hole = step.rect;
    else if (step.target) {
      const node = step.target(c);
      if (!node || !node.isConnected) { hide(); return; }   // 아직 그려지지 않았다(창이 열리는 중 등)
      let r = node.getBoundingClientRect();
      if (!r.width || !r.height) { hide(); return; }
      // 스크롤되는 창 안에서 화면 밖에 있는 대상은 가운데로 스크롤해 보여 준다(덮개가 손으로 스크롤하는 것을 막고 있으므로)
      const sc = node.closest('#modal-root .modal-body');
      if (sc) {
        const b = sc.getBoundingClientRect();
        if (r.top < b.top || r.bottom > b.bottom) {
          sc.scrollTop += (r.top + r.height / 2 - (b.top + b.height / 2)) * (W / game.getBoundingClientRect().width);
          r = node.getBoundingClientRect();
        }
      }
      hole = toDesign(r);
    }
    if (c.ui.gacha) { hide(); return; }   // 뽑기 연출 장면이 화면을 덮고 있는 동안은 말풍선을 숨긴다(단계 판정은 계속된다)
    const message = TUTORIAL_TEXT[typeof step.text === 'function' ? step.text(c) : step.text || step.id];
    show({ hole, text: message, kind, label: step.last ? (ch.key === 'a' ? '시작하기' : '좋아요!') : '다음', canSkip: ch.skippable && !step.last,
      onNext: () => { step.onNext?.(c); advance(ch); } });
  }

  // 임무·던전 안내(튜토리얼을 건너뛴 경우만 실제로 뜬다)
  function runTip(c) {
    const s = c.s, t = s.tutorial;
    if (c.ui.modal || s.draft || s.dungeon || s.rubyStage || c.ui.busy) { if (!current?.tip) hide(); return; }
    let tip = current?.tip;
    if (!tip) {
      if (clock - lastTipAt < TUTORIAL.tipGapSeconds) return;
      tip = TIPS.find(x => !t.tips.includes(x.id) && x.when(c));
      if (!tip) return;
    }
    const node = tip.target(c);
    if (!node || !node.isConnected) { hide(); return; }
    show({ hole: toDesign(node.getBoundingClientRect()), text: TUTORIAL_TEXT[tip.id], kind: 'info', label: '알겠어요', canSkip: false,
      onNext: () => { t.tips.push(tip.id); lastTipAt = clock; current = null; hide(); persist(); } });
    current.tip = tip;
  }

  next.addEventListener('click', () => current?.onNext?.());
  skip.addEventListener('click', () => {
    if (!skipArmed) { skipArmed = clock || Number.EPSILON; updateSkipLabel(); return; }
    const t = getState().tutorial;
    if (!t.done) t.done = true;
    else if (t.rb > 0) t.rb = -1;
    skipArmed = 0;
    current = null;
    hide();
    persist();
  });

  return {
    // 매 프레임: 지금 단계 조건을 보고 덮개를 그리거나 넘긴다
    update(dt) {
      const s = getState();
      if (!enabled || !s?.tutorial) return;
      clock += dt;
      if (skipArmed && clock - skipArmed > 3) { skipArmed = 0; updateSkipLabel(); }
      const c = ctx(), t = s.tutorial;
      // 튜토리얼을 마친 뒤 처음 10층에 닿으면(첫 환생 전) 환생 안내(2부)를 시작한다
      if (t.done && t.rb === 0 && s.rebirths === 0 && s.runMax >= C.rebirthMinFloor && !c.ui.modal && !s.draft && !s.dungeon && !s.rubyStage && !c.ui.busy) {
        t.rb = 1;
        entered = null;
        persist();
      }
      const ch = chapter(s);
      if (ch) runChapter(c, ch);
      else runTip(c);
    },
    // 말풍선 설명 중에는 게임 시간(60초 제한 등)을 멈춘다
    pausesGame: () => visible && shownKind === 'info',
    active: () => enabled && !!getState()?.tutorial && !!chapter(getState()),
    // 첫 화면에서 스킬 고르기 창을 먼저 띄우지 않도록(환영 말풍선 뒤에 열린다)
    holdsBuild: () => enabled && !!getState()?.tutorial && !getState().tutorial.done && getState().tutorial.step === 0,
    // 튜토리얼 중 곡괭이 뽑기는 합성을 보여 줄 수 있게 가장 낮은 등급(시작 곡괭이와 같은 등급)으로 정해 준다
    drawRng() {
      const s = getState(), t = s?.tutorial;
      return enabled && t && !t.done && CH1[t.step]?.id === 'shop-draw' ? () => 0 : undefined;
    },
    // 새 게임으로 갈아엎었을 때: 이전 판의 진행·안내 상태를 비운다
    reset() {
      entered = null;
      current = null;
      skipArmed = 0;
      lastTipAt = -999;
      lastClick = null;
      base = { skills: 0, inv: 0, free: 0 };
      hide();
    },
    restart() {
      const t = getState().tutorial;
      t.done = false;
      t.step = 0;
      entered = null;
      current = null;
      skipArmed = 0;
      persist();
    }
  };
}
