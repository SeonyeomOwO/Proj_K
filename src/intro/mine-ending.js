import { drawIris, PROLOGUE_IRIS } from './iris-transition.js';

const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => { const p = clamp(x); return p * p * (3 - 2 * p); };
export function mineEndingTiming(t, reduced = false) {
  const arrive = ease((t - .55) / 1.15);
  return {
    shadowAlpha: reduced ? arrive : 1,
    shadowY: reduced ? 900 : 900 + (1 - arrive) * 380,
    irisOpen: 1 - ease((t - 3.6) / .9)
  };
}

export class MineEnding {
  constructor(player) { this.p = player; this.c = player.b; }
  // Bakes the game ore into each ending painting once both are loaded (all, or when `only` — the key that just arrived — completes a pair).
  prepare(only = null) {
    const ore = this.p.images.get('gameOre');
    if (!ore) return;
    this.baked ||= new Set();
    // Reuse the game's complete transparent mineral_stone sprite, not a redraw
    // or a cutout from an illustrated scene. Bake it with its floor contact once
    // so the existing comic camera moves the entire panel consistently.
    for (const [key, placements] of [
      ['firstMining', [[.51, .411, .108], [.345, .889, .142], [.665, .925, .13]]],
      ['mineMeeting', [[.51, .497, .215]]]
    ]) {
      if ((only && only !== 'gameOre' && only !== key) || this.baked.has(key) || !this.p.images.has(key)) continue;
      this.baked.add(key);
      const source = this.p.images.get(key), plate = document.createElement('canvas');
      plate.width = source.width; plate.height = source.height;
      const c = plate.getContext('2d');
      c.drawImage(source, 0, 0);
      for (const [center, foot, height] of placements) {
        const x = center * plate.width, y = foot * plate.height;
        const h = height * plate.height, w = h * ore.width / ore.height;
        c.save(); c.fillStyle = '#513719'; c.globalAlpha = .20;
        c.beginPath(); c.ellipse(x, y - h * .025, w * .48, h * .065, 0, 0, Math.PI * 2); c.fill();
        c.restore();
        c.drawImage(ore, x - w / 2, y - h, w, h);
      }
      this.p.images.set(key, plate);
    }
  }
  comic(t) {
    const p = this.p, c = this.c, reduced = p.reducedMotion;
    p.panel('firstMining', [.047, .037, .906, .386], [24, 44, 672, 535], {
      zoom: 1 + (reduced ? 0 : .025 * ease(t / 1.4))
    });
    for (const [start, rect, x, direction] of [
      [1.65, [.047, .446, .435, .508], 24, -1],
      [3.35, [.516, .446, .437, .508], 370, 1]
    ]) {
      if (t < start) continue;
      const appear = reduced ? 1 : ease((t - start) / .28);
      c.save(); c.globalAlpha = appear;
      p.panel('firstMining', rect, [x + (1 - appear) * direction * 58, 615, 326, 610]);
      c.restore();
    }
  }
  meeting(t) {
    const p = this.p, c = this.c, state = mineEndingTiming(t, p.reducedMotion);
    // Characters, tools and ore are one finished painting and never deform or shift.
    c.drawImage(p.images.get('mineMeeting'), 0, 0, 720, 1280);
    if (state.shadowAlpha <= 0) return;
    // Move a complete transparent silhouette into frame. Its head and shoulders
    // travel together; the background never moves and no reveal edge is animated.
    c.save(); c.globalAlpha = state.shadowAlpha;
    c.globalCompositeOperation = 'multiply';
    c.drawImage(p.images.get('mineShadow'), 0, state.shadowY, 720, 420);
    c.restore();
  }
  curtain(t, context) {
    drawIris(context, 720, 1280, mineEndingTiming(t).irisOpen, {
      shape: PROLOGUE_IRIS, reducedMotion: this.p.reducedMotion
    });
  }
}
