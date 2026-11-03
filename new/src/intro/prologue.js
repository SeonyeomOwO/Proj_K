import { MotionComic } from './motion-comic.js';
import { IrisOverlay, PROLOGUE_IRIS } from './iris-transition.js';

export function playPrologue(host, { reducedMotion = false, onCovered = () => {}, startTime = 0 } = {}) {
  const obscured = [...host.children].map(node => [node, node.inert]);
  obscured.forEach(([node]) => { node.inert = true; });
  const layer = document.createElement('div');
  layer.className = 'prologue-player';
  layer.setAttribute('role', 'dialog'); layer.setAttribute('aria-label', '햄찌들의 첫 광산 이야기');
  layer.setAttribute('aria-modal', 'true');
  layer.style.cssText = 'position:absolute;inset:0;z-index:160;background:#160f0b;overflow:hidden';
  layer.innerHTML = '<canvas aria-label="햄찌들의 글자 없는 프롤로그" style="width:100%;height:100%;display:block"></canvas><div class="prologue-loading" style="position:absolute;inset:0;display:grid;place-items:center;font-size:30px">이야기를 준비하고 있어요…</div><div class="prologue-buffering" hidden style="position:absolute;left:0;right:0;bottom:96px;text-align:center;font-size:26px;color:#fff0d6;text-shadow:0 2px 8px #000c" role="status">이야기를 이어서 준비하고 있어요…</div><div style="position:absolute;right:28px;top:28px;display:flex;gap:16px"><button class="prologue-pause" type="button" disabled>일시정지</button><button class="prologue-skip" type="button">건너뛰기</button></div>';
  for (const button of layer.querySelectorAll('button')) {
    button.style.cssText = 'font:inherit;font-size:25px;padding:14px 24px;border:2px solid #a17a4d;border-radius:32px;background:#291b12d9;color:#fff0d6';
  }
  host.append(layer);
  let finishing = false;
  return new Promise(resolve => {
    // progressive: start after the first shots are ready and load the rest while it plays (40MB of PNG became ~5MB of WebP,
    // and decoded pictures are freed once their shot is over). resumeOnShow: coming back to the tab continues the story.
    const player = new MotionComic(layer.querySelector('canvas'), {
      reducedMotion, progressive: true, release: true, resumeOnShow: true,
      onEnd: () => finish(false),
      onUpdate: ({ playing, ready, buffering }) => {
        if (!ready) return;
        layer.querySelector('.prologue-pause').textContent = playing ? '일시정지' : '재생';
        layer.querySelector('.prologue-buffering').hidden = !buffering;
      }
    });
    async function finish(skip) {
      if (finishing) return;
      finishing = true; player.pause();
      const iris = new IrisOverlay(host, { shape: PROLOGUE_IRIS, reducedMotion, openness: skip ? 1 : 0 });
      try {
        if (skip) await iris.animate(0, 450);
        await onCovered();
        layer.remove(); player.destroy();
        await iris.animate(1, 750);
      } finally {
        iris.remove(); layer.remove();
        obscured.forEach(([node, inert]) => { node.inert = inert; });
        resolve();
      }
    }
    layer.querySelector('.prologue-pause').addEventListener('click', () => {
      if (finishing) return;
      if (player.playing) player.pause(); else player.play();
    });
    layer.querySelector('.prologue-skip').addEventListener('click', () => finish(true));
    player.load().then(() => {
      if (finishing) return;
      layer.querySelector('.prologue-loading').remove();
      layer.querySelector('.prologue-pause').disabled = false;
      if (startTime) player.seek(startTime);
      player.play();
    }).catch(error => {
      console.error('Prologue asset load failed:', error);
      layer.querySelector('.prologue-loading').textContent = '이야기를 불러오지 못했어요. 건너뛰기를 누르면 게임을 시작해요.';
    });
  });
}
