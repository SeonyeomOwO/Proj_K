// 세로로 스크롤되는 영역을 마우스로 눌러 끌어 올리고 내릴 수 있게 한다(휴대폰 터치처럼).
//  · 터치: 브라우저 기본 세로 스크롤(밀면 따라오고 놓으면 관성으로 미끄러진다)을 그대로 쓴다. CSS에서 touch-action: pan-y.
//  · 마우스: 눌러서 끌기. 놓을 때 속도가 남아 있으면 미끄러지다 멈춘다. 끈 직후의 클릭은 막아 버튼이 눌리지 않게 한다.
// 창 단위 리스너는 끄는 동안에만 달아 두므로, 영역이 다시 그려져도 남는 것이 없다.
export function bindDragScroll(el) {
  if (!el) return;
  el.classList.add('drag-scroll');
  let drag = null, suppress = false, glide = 0;
  const stop = () => { if (glide) { cancelAnimationFrame(glide); glide = 0; } };
  const move = e => {
    if (!drag) return;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dy) > 6) { drag.moved = true; el.classList.add('dragging'); }
    if (!drag.moved) return;
    e.preventDefault();
    el.scrollTop = drag.top - dy;
    const now = performance.now();
    drag.samples.push([now, e.clientY]);
    while (drag.samples.length > 2 && now - drag.samples[0][0] > 100) drag.samples.shift();
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    if (!drag) return;
    const { moved, samples } = drag;
    drag = null;
    el.classList.remove('dragging');
    if (!moved) return;
    suppress = true;
    setTimeout(() => { suppress = false; }, 0);
    // 놓기 직전 100ms의 손 속도(px/ms)로 미끄러진다: 시간이 지나며 속도가 줄고, 끝에 닿으면 멈춘다
    const a = samples[0], b = samples[samples.length - 1];
    let v = b[0] > a[0] ? -(b[1] - a[1]) / (b[0] - a[0]) : 0, last = performance.now();
    if (Math.abs(v) < .05) return;
    const step = t => {
      const dt = Math.min(32, t - last); last = t;
      const before = el.scrollTop;
      el.scrollTop = before + v * dt;
      v *= Math.pow(.994, dt);
      if (!el.isConnected || Math.abs(v) < .02 || el.scrollTop === before) { glide = 0; return; }
      glide = requestAnimationFrame(step);
    };
    glide = requestAnimationFrame(step);
  };
  el.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    stop();
    drag = { y: e.clientY, top: el.scrollTop, moved: false, samples: [[performance.now(), e.clientY]] };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
  el.addEventListener('wheel', stop, { passive: true });
  el.addEventListener('touchstart', stop, { passive: true });
  // 끌고 난 직후의 클릭은 눌린 버튼으로 가지 않게 막는다
  el.addEventListener('click', e => { if (suppress) { e.stopPropagation(); e.preventDefault(); } }, true);
}
