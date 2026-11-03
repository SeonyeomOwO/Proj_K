export const IRIS_SHAPES = Object.freeze(['hamster', 'pickaxe', 'ore']);
export const PROLOGUE_IRIS = 'hamster';
export const IRIS_PATHS = Object.freeze({
  hamster: 'M-.76,-.38 C-1,-.77,-.67,-1.05,-.38,-.76 C-.16,-.87,.16,-.87,.38,-.76 C.67,-1.05,1,-.77,.76,-.38 C.92,-.22,1,.03,1,.26 C1,.73,.55,.88,0,.88 C-.55,.88,-1,.73,-1,.26 C-1,.03,-.92,-.22,-.76,-.38 Z',
  pickaxe: 'M-.94,-.55 Q-.22,-1.04,.51,-.58 Q.86,-.36,1,.11 Q.52,-.3,.18,-.32 L.08,-.15 L-.58,.94 Q-.67,1.04,-.79,.96 L-.91,.87 Q-1,.79,-.91,.66 L-.2,-.37 Q-.58,-.49,-.94,-.39 Q-1,-.4,-.94,-.55 Z',
  ore: 'M-.91,-.28 L-.48,-.83 L.16,-.95 L.68,-.57 L.97,.1 L.72,.76 L.1,.94 L-.67,.69 L-1,.14 Z'
});
const clamp = x => Math.max(0, Math.min(1, x));
export function chooseIrisShape(random = Math.random) {
  const value = random();
  return IRIS_SHAPES[Math.min(2, Math.max(0, Math.floor((Number.isFinite(value) ? value : 0) * 3)))];
}
export function irisScale(width, height, openness) {
  const p = clamp(openness);
  return Math.hypot(width, height) * .55 * (p / (1 - p + .04)) ** 1.4;
}
const paths = new Map();
export function drawIris(context, width, height, openness, {
  shape = PROLOGUE_IRIS, center = [.5, .5], reducedMotion = false
} = {}) {
  const p = clamp(openness);
  if (p >= 1) return;
  context.save(); context.fillStyle = '#160f0b';
  if (reducedMotion || p <= 0) {
    context.globalAlpha *= reducedMotion ? 1 - p : 1;
    context.fillRect(0, 0, width, height);
  } else {
    const name = IRIS_SHAPES.includes(shape) ? shape : PROLOGUE_IRIS;
    if (!paths.has(name)) paths.set(name, new Path2D(IRIS_PATHS[name]));
    const scale = irisScale(width, height, p), mask = new Path2D();
    // Keep the aperture anchor inside the thin pickaxe shaft at every scale.
    const offsetX = name === 'pickaxe' ? .4 : 0;
    const offsetY = name === 'pickaxe' ? -.1 : 0;
    mask.rect(0, 0, width, height);
    mask.addPath(paths.get(name), new DOMMatrix([scale, 0, 0, scale, width * center[0] + scale * offsetX, height * center[1] + scale * offsetY]));
    context.fill(mask, 'evenodd');
  }
  context.restore();
}

export class IrisOverlay {
  constructor(host, { shape = chooseIrisShape(), reducedMotion = false, openness = 1 } = {}) {
    this.shape = shape; this.reducedMotion = reducedMotion; this.openness = openness;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 720; this.canvas.height = 1280;
    this.canvas.className = 'iris-transition'; this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:200;pointer-events:auto';
    this.context = this.canvas.getContext('2d');
    host.append(this.canvas); this.draw();
  }
  draw() {
    this.context.clearRect(0, 0, 720, 1280);
    drawIris(this.context, 720, 1280, this.openness, this);
  }
  animate(to, duration = 650) {
    const from = this.openness, start = performance.now();
    return new Promise(resolve => {
      const tick = now => {
        const p = clamp((now - start) / duration), eased = p * p * (3 - 2 * p);
        this.openness = from + (to - from) * eased; this.draw();
        if (p < 1) this.raf = requestAnimationFrame(tick);
        else { this.finish = null; resolve(); }
      };
      this.finish = resolve; this.raf = requestAnimationFrame(tick);
    });
  }
  remove() { cancelAnimationFrame(this.raf); this.finish?.(); this.canvas.remove(); }
}

// Other scene changes select one of the three silhouettes once per transition.
// The prologue caller passes PROLOGUE_IRIS explicitly, so that handoff is always a hamster.
export async function transitionIris(host, { onCovered = () => {}, ...options } = {}) {
  const iris = new IrisOverlay(host, options);
  try { await iris.animate(0, 520); await onCovered(); await iris.animate(1, 650); }
  finally { iris.remove(); }
  return iris.shape;
}
