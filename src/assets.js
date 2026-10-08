// 시작 화면에 꼭 필요한 시트(광맥·햄찌·곡괭이·아이콘·패널). 나머지(상점 그림·패스·광맥 배너 등)는 첫 화면을 띄운 뒤 조금씩 받는다.
const CORE = ['ui-panels', 'ui-icons', 'world-sprites', 'mineral-families-v2', 'hamster-rig-v1', 'pickaxes-held-v1', 'pickaxes', 'costumes'];
// 나중에 받는 순서(위일수록 먼저): 곧 쓸 가능성이 높은 것부터
const LATER_FIRST = ['vein-banner-copper-v1', 'vein-banner-emerald-v1', 'vein-banner-ruby-v1', 'shop-products-v1'];
const rank = id => { const i = LATER_FIRST.indexOf(id); return i < 0 ? 99 : i; };

export class Assets {
  // lazy=false(기본): 모든 시트를 받고 끝낸다(미리보기·리소스 도구용). lazy=true: 필수 시트만 기다리고 나머지는 warm()으로 받는다.
  async load({ lazy = false, master = false } = {}) {
    this.master = master;   // true: 도구용 — 게임용 WebP 대신 PNG 원본을 쓴다(리소스 내보내기 품질 유지)
    this.manifest = await fetch('assets/manifest.json').then(r => {
      if (!r.ok)
        throw Error('리소스 목록 로드 실패');
      return r.json();
    });
    this.images = {};
    this.pending = {};
    const ids = Object.keys(this.manifest.sheets);
    const first = lazy ? ids.filter(id => CORE.includes(id)) : ids;
    await Promise.all([...first.map(id => this.sheet(id)), this.image(master ? 'assets/world/cave-background.png' : 'assets/world/cave-background.webp').then(im => this.background = im)]);
    return this;
  }
  // 시트 하나를 받는다(같은 시트를 여러 번 불러도 한 번만 받는다). 웹용 WebP가 있으면 그것을, 없으면 PNG를 쓴다.
  sheet(id) {
    const s = this.manifest.sheets[id];
    if (!s)
      return Promise.reject(Error('Unknown sheet ' + id));
    return this.pending[id] ||= this.image(this.master ? s.path : s.web || s.path).then(im => this.images[id] = im);
  }
  // 첫 화면을 띄운 뒤 아직 안 받은 시트를 한 장씩 한가할 때 받는다.
  warm() {
    const rest = Object.keys(this.manifest.sheets).filter(id => !this.pending[id]).sort((a, b) => rank(a) - rank(b));
    const idle = fn => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 300));
    const next = () => {
      const id = rest.shift();
      if (!id)
        return;
      this.sheet(id).catch(() => {}).then(() => idle(next));
    };
    idle(next);
  }
  image(src) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(Error('이미지를 열 수 없습니다: ' + src));
      im.src = src;
    });
  }
  draw(ctx, id, x, y, w, h, fit = true) {
    const f = this.manifest.frames[id];
    if (!f)
      throw Error('Missing sprite ' + id);
    const im = this.images[f.sheet];
    if (!im) {
      this.sheet(f.sheet).catch(() => {});   // 아직 안 받은 시트: 이번엔 건너뛰고 받기를 시작한다
      return false;
    }
    if (fit) {
      const k = Math.min(w / f.w, h / f.h);
      x += (w - f.w * k) / 2;
      y += (h - f.h * k) / 2;
      w = f.w * k;
      h = f.h * k;
    }
    ctx.drawImage(im, f.x, f.y, f.w, f.h, x, y, w, h);
    return true;
  }
  element(id, w = 100, h = w) {
    const c = document.createElement('canvas');
    c.width = w * 2;
    c.height = h * 2;
    c.className = 'icon';
    c.setAttribute('aria-hidden', 'true');
    c.dataset.sprite = id;
    if (!this.draw(c.getContext('2d'), id, 0, 0, c.width, c.height))
      this.sheet(this.manifest.frames[id].sheet).then(() => this.draw(c.getContext('2d'), id, 0, 0, c.width, c.height)).catch(() => {});
    return c;
  }
  apply(root = document) {
    root.querySelectorAll('[data-icon]').forEach(el => {
      const id = el.dataset.icon;
      const c = this.element(id, Number(el.dataset.width) || 100, Number(el.dataset.height) || Number(el.dataset.width) || 100);
      c.className = el.className || 'icon';
      el.replaceWith(c);
    });
  }
}
