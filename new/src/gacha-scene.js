// 뽑기 연출 장면: 하늘에서 큰 나무 상자가 뚝 떨어져 몇 번 튕기고 흔들린 뒤 "눌러서 상자 오픈!" → 누르면 상자가 열리며 등급 색 빛과 함께 보상이 튀어나온다.
//  · 상자는 언제나 하나다. 열릴 때 그 등급의 빛(흰빛·은빛·구리빛·금빛·다이아·보라금빛)이 뿜어져 나와 어떤 보상인지 미리 알 수 있다.
//  · 10회 뽑기는 같은 상자에서 보상이 하나씩 나온다: "다음" 버튼이나 화면을 누르면 (이미 열려 있는 상자에서) 다음 보상이 새 등급 빛과 함께 튀어나오고,
//    마지막에는 열 개를 한눈에 보는 결과 화면이 뜬다("한 번에 보기"로 바로 건너뛸 수도 있다).
//  · 상자를 가만히 두면 한 번씩 덜컹거려 누르도록 이끈다.
// 이 모듈은 보상 내용을 정하지 않는다. 엔진이 이미 정한 결과(view model)를 받아 보여 줄 뿐이고, 확률·재화·저장은 건드리지 않는다.
// 리소스: assets/gacha/*(Codex 제작 가차 리소스 v1) — 배경 2장, 닫힌/열린 상자, 등급 문양 5종. 보상 그림은 기존 곡괭이·햄찌 그림을 그대로 쓴다.
const DIR = 'assets/gacha/';
const FILES = { bgPickaxe: 'background-pickaxe-v1.webp', bgHamster: 'background-hamster-v1.webp', closed: 'crate-closed-v1.webp', open: 'crate-open-v1.webp',
  D: 'badge-d-v1.webp', C: 'badge-c-v1.webp', B: 'badge-b-v1.webp', A: 'badge-a-v1.webp', S: 'badge-s-v1.webp', SS: 'badge-ss-v1.webp', hamster: 'badge-hamster-common-v1.webp' };
// 곡괭이는 등급 문양, 햄찌는 등급과 상관없이 햄찌 공통 문양 하나를 이름표·카드에 쓴다(빛 색은 그대로 등급을 따른다).
const badgeFile = (kind, gi) => DIR + (kind === 'hamster' ? FILES.hamster : FILES[gi]);
// 상자 그림(1254×1254)의 바닥 기준점. 닫힘/열림 두 그림을 같은 기준점에 맞춰 바꿔 끼운다.
const SRC = 1254, ANCHOR = { closed: [646, 1046], open: [647.5, 1142] };
// 등급별 빛 색(밝은 색·중간 색)과 세기. D는 은은한 흰빛, SS는 가장 크고 화려하다.
const GRADES = {
  D: { g1: '#fff6dc', g2: '#e9dcc0', power: .55, sparks: 8 },
  C: { g1: '#e8f3ff', g2: '#9dc2ea', power: .75, sparks: 12 },
  B: { g1: '#ffd0a0', g2: '#ff8a3d', power: .9, sparks: 16 },
  A: { g1: '#fff0a0', g2: '#ffc01f', power: 1.05, sparks: 22 },
  S: { g1: '#c9f6ff', g2: '#28d8ff', power: 1.25, sparks: 28 },
  SS: { g1: '#f1d2ff', g2: '#b44dff', power: 1.5, sparks: 42 }
};
const RANK = ['D', 'C', 'B', 'A', 'S', 'SS'];
const grade = g => GRADES[g] ? g : 'D';
const W = 941;
// 큰 상자 하나: 바닥 기준점이 화면 (50%, 64.8%)
const L = { k: .72 * W / SRC, x: W / 2, y: 1083, item: 440, itemY: -330, lightW: 1100, lightY: -250, plateY: 140 };

const preloaded = {};
// 상자·배경·문양 그림을 미리 받아 둔다(처음 뽑을 때 기다리지 않게).
export function preloadGacha() {
  return Promise.all(Object.values(FILES).map(f => preloaded[f] ||= new Promise(res => {
    const im = new Image();
    im.onload = im.onerror = () => res(im);
    im.src = DIR + f;
  })));
}

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};

// results: [{ icon, grade, name, sub, isNew, tag }]  (icon은 data-icon 이름, tag는 작은 글씨 "NEW" "Lv.3" 등)
// options: { game, assets(Assets), kind:'pickaxe'|'hamster', title, results, summary, motion, haptic, onClose }
export async function playGacha(o) {
  const { game, assets, kind, results } = o;
  const many = results.length > 1, motion = o.motion !== false, last = results.length - 1;
  await Promise.race([preloadGacha(), new Promise(r => setTimeout(r, 2500))]);
  const root = el('div', 'gc ' + (many ? 'many' : 'single') + ' kind-' + kind + (motion ? '' : ' still'));
  root.id = 'gacha';
  root.innerHTML = '<div class="gc-bg"></div><div class="gc-flash"></div>';
  // 배경은 인라인 스타일로 지정한다(CSS 변수 안의 url()은 css 파일 위치 기준으로 읽혀 경로가 어긋난다)
  root.querySelector('.gc-bg').style.backgroundImage = `url('${DIR + (kind === 'hamster' ? FILES.bgHamster : FILES.bgPickaxe)}')`;
  const title = el('div', 'gc-title', `<span>${o.title}</span>`);
  const count = el('div', 'gc-count');
  const stage = el('div', 'gc-stage');
  const sum = el('div', 'gc-sum');
  const hint = el('div', 'gc-hint', '눌러서 상자 오픈!');
  const note = el('div', 'gc-note');
  const bar = el('div', 'gc-actions');
  const nextBtn = el('button', 'gc-btn', '다음');
  const okBtn = el('button', 'gc-btn', '확인');
  const skipBtn = el('button', 'gc-skip', '한 번에 보기');
  nextBtn.type = okBtn.type = skipBtn.type = 'button';
  for (const e of [hint, note, count, sum, nextBtn, okBtn, skipBtn]) e.hidden = true;
  bar.append(nextBtn, okBtn);
  root.append(title, count, stage, sum, hint, note, skipBtn, bar);
  game.append(root);

  const timers = [];
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const buzz = p => { if (o.haptic && navigator.vibrate && navigator.userActivation?.hasBeenActive) navigator.vibrate(p); };
  let closed = false, idx = 0, skipped = false;
  let phase = 'falling';   // falling → ready(상자 닫힘, 누르기 기다림) → opening → shown → (swapping → shown …) → summary

  // ── 상자 하나 ───────────────────────────────────────────────────────────────────────────────
  const k = L.k, img = (name, a, hidden) => `<img class="gc-crate-img ${name}"${hidden ? ' hidden' : ''} src="${DIR + FILES[name]}" alt="" draggable="false" style="width:${SRC * k}px;left:${-a[0] * k}px;top:${-a[1] * k}px">`;
  const cell = el('div', 'gc-cell');
  cell.style.cssText = `left:${L.x}px;top:${L.y}px;--lw:${L.lightW}px;--ly:${L.lightY}px;--iy:${L.itemY}px;--is:${L.item}px;--py:${L.plateY}px`;
  cell.innerHTML = '<div class="gc-shadow"></div>'
    + '<div class="gc-light"><i class="gc-halo"></i><i class="gc-rays"></i><i class="gc-beam"></i></div>'
    + `<div class="gc-crate"><div class="gc-crate-in">${img('closed', ANCHOR.closed)}${img('open', ANCHOR.open, true)}</div></div>`
    + '<div class="gc-item"></div><div class="gc-plate"></div>';
  stage.append(cell);
  const itemBox = cell.querySelector('.gc-item'), plateBox = cell.querySelector('.gc-plate');
  const closedImg = cell.querySelector('.closed'), openImg = cell.querySelector('.open'), lightBox = cell.querySelector('.gc-light');

  // i번째 보상을 상자 안 보상·이름표·빛 색에 채운다(상자가 닫혀 있는 동안 갈아 끼운다)
  function setResult(i) {
    const r = results[i], gi = grade(r.grade), G = GRADES[gi];
    cell.className = cell.className.replace(/\bg-\w+\b/g, '').trim() + ' g-' + gi;
    cell.style.setProperty('--g1', G.g1);
    cell.style.setProperty('--g2', G.g2);
    cell.style.setProperty('--pw', G.power);
    itemBox.innerHTML = `<span class="icon" data-icon="${r.icon}" data-width="256"></span>${r.isNew ? '<em class="gc-new">NEW</em>' : ''}`;
    plateBox.innerHTML = `<span class="gc-plate-in"><img class="gc-badge" src="${badgeFile(kind, gi)}" alt="${kind === 'hamster' ? '햄찌' : gi}"><b>${r.name}</b></span><small>${r.sub || ''}</small>`;
    assets.apply(itemBox);
    if (many) count.textContent = (i + 1) + ' / ' + results.length;
  }
  setResult(0);

  // ── 연출 조각 ───────────────────────────────────────────────────────────────────────────────
  const shake = (amount = 1) => {
    if (!motion) return;
    root.style.setProperty('--shake', amount);
    root.classList.remove('shaking');
    void root.offsetWidth;
    root.classList.add('shaking');
  };
  const dust = () => {
    if (!motion) return;
    for (let i = 0; i < 10; i++) {
      const d = el('i', 'gc-dust');
      const side = i % 2 ? 1 : -1;
      d.style.cssText = `--dx:${side * (30 + Math.random() * 130)}px;--s:${.6 + Math.random() * .9};left:${(Math.random() - .5) * 220}px`;
      cell.append(d);
      later(() => d.remove(), 900);
    }
  };
  const sparks = n => {
    if (!motion) return;
    for (let i = 0; i < n; i++) {
      const s = el('i', 'gc-spark');
      const a = Math.random() * Math.PI * 2, d = L.lightW * (.18 + Math.random() * .3);
      s.style.cssText = `--sx:${Math.cos(a) * d}px;--sy:${Math.sin(a) * d * .8}px;--sz:${18 + Math.random() * 16}px;--sd:${(Math.random() * .25).toFixed(2)}s`;
      lightBox.append(s);
      later(() => s.remove(), 1500);
    }
  };
  const flash = gi => {
    if (!motion) return;
    root.style.setProperty('--fc', GRADES[gi].g1);
    root.style.setProperty('--fp', Math.min(1, .3 + GRADES[gi].power * .4));
    root.classList.remove('flash');
    void root.offsetWidth;
    root.classList.add('flash');
  };

  // 보상이 나오는 순간: 이 보상 등급의 빛·반짝임·번쩍임(상자가 이미 열려 있어도 같은 연출이 처음부터 다시 재생된다)
  function reveal() {
    const gi = grade(results[idx].grade);
    cell.classList.add('opened');
    sparks(GRADES[gi].sparks);
    flash(gi);
    if (RANK.indexOf(gi) >= 3) shake(gi === 'SS' ? 1.8 : 1);
    buzz(gi === 'SS' ? [30, 40, 70] : gi === 'S' || gi === 'A' ? 30 : 15);
    // 첫 보상은 연출을 충분히 보여 주고, 이어지는 보상은 빠르게 넘길 수 있게 한다
    later(() => { if (phase === 'summary') return; phase = 'shown'; refresh(); }, motion ? (idx === 0 ? 1500 : 850) : 0);
  }

  // 상자 열기: 쿵쿵 떨다 열리며 보상이 튀어나온다(처음 한 번만)
  function openCrate() {
    phase = 'opening';
    cell.classList.remove('nudge');
    cell.classList.add('rumble');
    refresh();
    later(() => {
      if (closed || phase === 'summary') return;
      cell.classList.remove('rumble');
      closedImg.hidden = true;
      openImg.hidden = false;
      reveal();
    }, motion ? 330 : 0);
  }

  // 다음 보상: 상자는 이미 열려 있으니 다시 열지 않는다. 지금 보상이 위로 사라지고, 같은 상자에서 새 빛과 함께 다음 보상이 튀어나온다.
  function nextReward() {
    phase = 'swapping';
    refresh();
    cell.classList.add('swap');
    later(() => {
      if (closed || phase === 'summary') return;
      idx++;
      cell.classList.remove('swap', 'opened');
      setResult(idx);
      void cell.offsetWidth;   // 연출 애니메이션을 처음부터 다시 재생하기 위해
      reveal();
      refresh();
    }, motion ? 240 : 0);
  }

  // 열 개를 한눈에 보는 결과 화면
  function showSummary() {
    if (closed || phase === 'summary') return;
    phase = 'summary';
    hint.hidden = true;
    skipBtn.hidden = nextBtn.hidden = count.hidden = true;
    cell.classList.add('gone');
    sum.innerHTML = results.map((r, i) => {
      const gi = grade(r.grade);
      return `<div class="gc-card g-${gi}" style="--g1:${GRADES[gi].g1};--g2:${GRADES[gi].g2};--i:${i}"><span class="icon" data-icon="${r.icon}" data-width="160"></span>${r.isNew ? '<em class="gc-new">NEW</em>' : ''}<div class="gc-card-foot"><img class="gc-badge" src="${badgeFile(kind, gi)}" alt="${kind === 'hamster' ? '햄찌' : gi}"><span>${r.tag || ''}</span></div></div>`;
    }).join('');
    assets.apply(sum);
    sum.hidden = false;
    note.innerHTML = o.summary || '';
    note.hidden = !o.summary;
    okBtn.hidden = false;
    shake(.6);
  }

  // 화면 상태에 따라 버튼·안내 문구를 맞춘다
  function refresh() {
    if (closed) return;
    const shown = phase === 'shown';
    hint.hidden = phase !== 'ready';
    if (!many) {
      okBtn.hidden = !shown;
      return;
    }
    count.hidden = phase === 'falling' || phase === 'ready' || phase === 'summary';
    nextBtn.hidden = !shown;
    nextBtn.textContent = idx >= last ? '결과 보기' : '다음';
    skipBtn.hidden = !(phase === 'opening' || phase === 'swapping' || shown) || idx >= last;
  }

  // 누르기: 떨어지는 중에는 바로 자리에 놓이고, 상자 앞에서는 열고, 보상이 나온 뒤에는 다음으로(10회)
  function tap() {
    if (closed) return;
    if (phase === 'falling') return landNow();
    if (phase === 'ready') return openCrate();
    if (phase === 'shown' && many) return idx >= last ? showSummary() : nextReward();
  }
  function landNow() {
    skipped = true;
    cell.classList.remove('wobble');
    cell.classList.add('dropped', 'nudge');
    phase = 'ready';
    refresh();
  }
  root.addEventListener('click', e => { if (!e.target.closest('.gc-actions, .gc-skip')) tap(); });
  nextBtn.addEventListener('click', tap);
  skipBtn.addEventListener('click', () => later(showSummary, phase === 'shown' ? 0 : 500));
  okBtn.addEventListener('click', () => close());

  function close() {
    if (closed) return;
    closed = true;
    timers.forEach(clearTimeout);
    root.classList.add('leaving');
    setTimeout(() => { root.remove(); o.onClose?.(); }, motion ? 260 : 0);
  }

  // 낙하: 하늘에서 뚝 → 튕김 → 흔들림 → "눌러서 상자 오픈!" + 가만히 두면 덜컹
  const DROP = motion ? 1550 : 0, T0 = 250;
  later(() => { if (!skipped) cell.classList.add('dropped'); }, T0);
  later(() => { if (skipped) return; dust(); shake(.9); buzz(12); }, T0 + DROP * .34);
  later(() => { if (!skipped) cell.classList.add('wobble'); }, T0 + DROP);
  later(() => {
    if (skipped) return;
    cell.classList.remove('wobble');
    cell.classList.add('nudge');
    phase = 'ready';
    refresh();
  }, T0 + DROP + (motion ? 900 : 0));

  setTimeout(() => root.classList.add('show'), 20);
  return { close, root };
}
