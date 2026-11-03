import { PosePlane } from './pose-plane.js';

// Character and prop animation for full-frame shots. Comic-panel shots keep their own pacing.
const clamp = x => Math.max(0, Math.min(1, x));
const mix = (a, b, p) => a + (b - a) * p;
const ease = x => { const p = clamp(x); return p * p * (3 - 2 * p); };
const whole = [0, 0, 1, 1];
const itemKeys = ['oreItem', 'sackItem', 'gemsItem', 'goldItem', 'arrowItem', 'seedItem'];

function poseAt(age, keys) {
  if (age <= keys[0][0]) return keys[0].slice(1);
  for (let i = 1; i < keys.length; i++) {
    if (age <= keys[i][0]) {
      const previous = keys[i - 1], next = keys[i];
      const p = ease((age - previous[0]) / (next[0] - previous[0]));
      return previous.slice(1).map((value, j) => mix(value, next[j + 1], p));
    }
  }
  return keys.at(-1).slice(1);
}

// Width, height, lift: a short wind-up, fast stretch, weighted landing and two settling beats.
const popKeys = [
  [0, .05, .03, 18], [.09, .48, .22, 12], [.23, .86, 1.23, -35],
  [.34, 1.16, .83, 0], [.46, .96, 1.07, -5], [.60, 1.02, .98, 0], [.75, 1, 1, 0]
];
export function propPopAt(age, reduced = false) {
  if (age < 0) return null;
  const [sx, sy, lift] = reduced ? [1, 1, 0] : poseAt(age, popKeys);
  return { sx, sy, lift };
}

export function dreamTimingAt(t, reduced = false) {
  const up = ease((t - .38) / .82), down = ease((t - 3.85) / .85);
  return {
    cameraY: reduced ? (t < .8 || t > 4.25 ? 935 : 405) : mix(935, 405, up * (1 - down)),
    emergeAge: t - 1.48,
    burstAge: t - 1.61,
    chewing: t >= 2.05 && t < 4.05,
    frame: t >= 2.05 && Math.floor((t - 2.05) / .15) % 2 ? 3 : 1
  };
}

export function explanationTimingAt(t, reduced = false) {
  const frame = t < .59 ? 0 : 1;
  if (reduced) return { frame, angle: 0, scale: 1, friendsY: 0, friendsScaleY: 1 };
  // Turn the complete drawing left, exchange poses only when edge-on, then rebound.
  // Both sides keep their real proportions; no separate head, torso or limb assembly.
  let angle, scale;
  if (t < .46) {
    [angle, scale] = poseAt(t, [[0, 0, 1], [.28, 0, 1], [.46, .23, .94]]);
  } else if (t < .59) {
    const p = clamp((t - .46) / .13);
    angle = mix(.23, -Math.PI / 2, p * p); scale = mix(.94, .96, p);
  } else if (t < .72) {
    const p = clamp((t - .59) / .13), out = 1 - (1 - p) ** 3;
    angle = mix(Math.PI / 2, -.20, out); scale = mix(.96, 1.17, out);
  } else {
    [angle, scale] = poseAt(t, [
      [.72, -.20, 1.17], [.86, .085, .965], [1.02, -.035, 1.055], [1.22, .012, .99], [1.43, 0, 1]
    ]);
  }
  const pulse = age => age < 0 || age > .5 ? [0, 1] : poseAt(age, [
    [0, 0, 1], [.055, 2, .992], [.15, -9, 1.012],
    [.26, 1, .996], [.37, -2, 1.003], [.5, 0, 1]
  ]);
  const [y1, s1] = pulse(t - .18), [y2, s2] = pulse(t - .96);
  return { frame, angle, scale, friendsY: y1 + y2, friendsScaleY: s1 * s2 };
}

export class OneShotScenes {
  constructor(player) { this.p = player; this.c = player.b; this.frames = new Map(); }
  get reduced() { return this.p.reducedMotion; }

  // Measures the sprite sheets that are loaded (all of them, or only the one named). Called again as more art arrives.
  prepare(only = null) {
    // Alpha bounds are measured once. Stable bottom pivots keep cels on the floor.
    const layouts = {
      dreamParts: [2, 2], party: [2, 4], doorLeaf: [1, 1], hero: [2, 3],
      tableFriends: [1, 1], tableHero: [2, 1],
      ...Object.fromEntries(itemKeys.map(key => [key, [1, 1]]))
    };
    for (const [key, [columns, rows]] of Object.entries(layouts)) {
      const image = this.p.images.get(key);
      if ((only && only !== key) || !image || this.frames.has(key)) continue;
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, image.width, image.height).data;
      const frames = [];
      for (let cell = 0; cell < columns * rows; cell++) {
        let rect = [(cell % columns) / columns, Math.floor(cell / columns) / rows, 1 / columns, 1 / rows];
        // The seed heap is slightly wider than half the generated atlas.
        if (key === 'dreamParts' && cell === 2) rect = [0, .505, .535, .495];
        if (key === 'dreamParts' && cell === 3) rect = [.535, .505, .465, .495];
        const left = Math.ceil(rect[0] * image.width), top = Math.ceil(rect[1] * image.height);
        const right = Math.floor((rect[0] + rect[2]) * image.width), bottom = Math.floor((rect[1] + rect[3]) * image.height);
        let x0 = right, y0 = bottom, x1 = left, y1 = top;
        for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
          if (pixels[(y * image.width + x) * 4 + 3] < 180) continue;
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
        frames.push(x1 < x0 ? null : [
          Math.max(left, x0 - 2), Math.max(top, y0 - 2),
          Math.min(right, x1 + 3) - Math.max(left, x0 - 2),
          Math.min(bottom, y1 + 3) - Math.max(top, y0 - 2)
        ]);
      }
      if (key === 'tableHero') {
        // Register each complete pose by its two feet, not the raised hand or cell padding.
        const centers = frames.map(r => {
          let left = image.width, right = 0;
          for (let y = Math.floor(r[1] + r[3] * .90); y < r[1] + r[3]; y++) {
            for (let x = r[0]; x < r[0] + r[2]; x++) {
              if (pixels[(y * image.width + x) * 4 + 3] < 180) continue;
              left = Math.min(left, x); right = Math.max(right, x);
            }
          }
          return (left + right) / 2;
        });
        const halfWidth = Math.max(...frames.flatMap((r, i) => [centers[i] - r[0], r[0] + r[2] - centers[i]]));
        const height = Math.max(...frames.map(r => r[3]));
        frames.forEach((r, i) => { frames[i] = [centers[i] - halfWidth, r[1] + r[3] - height, halfWidth * 2, height]; });
      }
      this.frames.set(key, frames);
      if (key === 'tableHero') this.tablePlane = new PosePlane(image, 720, 1280);
    }
  }

  cut(key, cell, x, footY, width, { sx = 1, sy = 1, angle = 0, alpha = 1, height, pivot = .5 } = {}) {
    if (key === 'exchange') { key = itemKeys[cell]; cell = 0; }
    const rect = this.frames.get(key)[cell];
    if (!rect || width <= 0 || alpha <= 0) return;
    const c = this.c, h = height ?? width * rect[3] / rect[2];
    c.save(); c.translate(x, footY); c.rotate(angle); c.scale(sx, sy); c.globalAlpha *= alpha;
    c.drawImage(this.p.images.get(key), ...rect, -width * pivot, -h, width, h); c.restore();
  }

  shadow(x, y, width, alpha = .15) {
    const c = this.c; c.save(); c.globalAlpha *= alpha; c.fillStyle = '#54331e';
    c.beginPath(); c.ellipse(x, y, width / 2, width * .065, 0, 0, Math.PI * 2); c.fill(); c.restore();
  }

  cloudPath(x, y, rx, ry) {
    const c = this.c; c.beginPath();
    for (let i = 0; i <= 160; i++) {
      const a = i / 160 * Math.PI * 2, scallop = 1 + .045 * Math.cos(a * 12);
      const px = x + Math.cos(a) * rx * scallop, py = y + Math.sin(a) * ry * scallop;
      if (!i) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
  }

  cloud(x, y, rx, ry) {
    const c = this.c; this.cloudPath(x, y, rx, ry);
    c.fillStyle = '#fff2cd'; c.strokeStyle = '#674021'; c.lineWidth = 7; c.fill(); c.stroke();
  }

  burst(age, x, y, count = 12, size = 30, force = 1) {
    if (this.reduced || age < 0 || age > 1.5) return;
    for (let i = 0; i < count; i++) {
      const a = age - (i % 3) * .025;
      if (a < 0) continue;
      const vx = (i / Math.max(1, count - 1) * 2 - 1) * 310 * force;
      const vy = -(320 + (i * 67 % 170)) * force;
      const py = y + vy * a + 480 * a * a;
      const spread = count > 10 ? (i / (count - 1) - .5) * 155 : 0;
      this.cut('exchange', i % 5 === 0 ? 3 : 5, x + spread + vx * a, py, size * (.75 + i % 3 * .15), {
        angle: i * .9 + a * (i % 2 ? 6 : -6), alpha: 1 - ease((a - .75) / .5)
      });
    }
  }

  flyer(t) {
    const c = this.c;
    this.p.panel('flyerPlate', whole, [24, 135, 672, 1008]);
    for (const row of [
      { y: 780, start: .55, left: 0, right: 1 },
      { y: 1025, start: 2.9, left: 2, right: 3 }
    ]) {
      for (const [cell, x, start] of [[row.left, 182, row.start], [row.right, 538, row.start + 1.0]]) {
        const age = t - start, state = propPopAt(age, this.reduced);
        if (!state) continue;
        this.shadow(x, row.y - 2, 175, .11);
        this.cut('exchange', cell, x, row.y + state.lift, cell === 3 ? 190 : 226, {
          sx: state.sx, sy: state.sy, angle: this.reduced ? 0 : Math.sin(age * 13) * .07 * Math.exp(-age * 3)
        });
        if (cell === 1) this.burst(age - .22, x, row.y - 90, 5, 17, .45);
      }
      const age = t - row.start - .52;
      if (age >= 0) {
        const [sx, sy] = this.reduced ? [1, 1] : poseAt(age, [
          [0, .02, .25], [.16, 1.22, .76], [.26, .91, 1.12], [.40, 1.03, .98], [.55, 1, 1]
        ]);
        // Stretch from the tail towards the reward, then let the arrowhead overshoot.
        this.cut('exchange', 4, 300, row.y - 68, 120, { sx, sy, pivot: 0, height: 85 });
      }
    }
    if (t > 4.15) {
      this.p.sparkle(590, 850, 23, this.reduced ? 1 : t * 5);
      this.p.sparkle(455, 1010, 17, this.reduced ? 1 : t * 4);
    }
    c.globalAlpha = 1;
  }

  dream(t) {
    const c = this.c, timing = dreamTimingAt(t, this.reduced);
    // One world transform: scenery, real hamster and thought cloud share the camera.
    // Only the imagined hamster animates locally, after the camera has arrived.
    c.save(); c.translate(360, 640); c.scale(1.19, 1.19); c.translate(-360, -timing.cameraY);
    this.p.crop('village', whole, [0, -180, 720, 1720], { zoom: 1.08 });
    c.fillStyle = '#fff4d555'; c.fillRect(0, -180, 720, 1720);
    this.shadow(360, 1205, 430);
    this.cut('dreamParts', 0, 360, 1200, 520);
    for (const [x, y, r] of [[480, 645, 13], [493, 597, 21], [475, 542, 29]]) {
      c.beginPath(); c.ellipse(x, y, r, r * .82, 0, 0, Math.PI * 2);
      c.fillStyle = '#fff2cd'; c.strokeStyle = '#674021'; c.lineWidth = 5; c.fill(); c.stroke();
    }
    this.cloud(360, 285, 314, 285);
    c.save(); this.cloudPath(360, 285, 311, 282); c.clip();
    const halo = c.createRadialGradient(360, 280, 20, 360, 280, 380);
    halo.addColorStop(0, '#ffe39a'); halo.addColorStop(1, '#fff6db');
    c.fillStyle = halo; c.fillRect(0, -30, 720, 640);
    // The mound first sits alone; its compression anticipates the hidden hamster's jump.
    const windUp = !this.reduced && t > 1.22 && t < 1.48 ? Math.sin((t - 1.22) / .26 * Math.PI) : 0;
    const age = timing.emergeAge;
    if (age >= 0) {
      const [sx, sy, lift] = this.reduced ? [1, 1, 0] : poseAt(age, [
        [0, .35, .3, 220], [.12, .7, .8, 95], [.25, .88, 1.17, -40],
        [.37, 1.12, .91, 12], [.50, .97, 1.04, -6], [.65, 1, 1, 0]
      ]);
      const chew = timing.chewing && !this.reduced ? Math.sin((t - 2.05) * Math.PI / .15) : 0;
      this.cut('dreamParts', this.reduced ? 1 : timing.frame, 360, 485 + lift + chew * 3, 390, {
        sx: sx * (1 + chew * .025), sy: sy * (1 - chew * .022),
        angle: this.reduced ? 0 : Math.sin(t * 4) * .018
      });
    }
    this.cut('dreamParts', 2, 360 + windUp * Math.sin(t * 65) * 5, 565, 610, {
      height: 260, sx: 1 + windUp * .025, sy: 1 - windUp * .055
    });
    this.burst(timing.burstAge, 360, 350, 15, 35, .9);
    if (timing.chewing && !this.reduced) {
      const bite = (t - 2.05) % .3;
      for (let i = 0; i < 3; i++) {
        this.cut('exchange', 5, 337 - bite * (110 + i * 40), 280 - bite * 110 + bite * bite * 500,
          10 - i, { angle: bite * 14 + i, alpha: 1 - bite / .3 });
      }
    }
    if (t > 1.2) {
      this.p.sparkle(113, 246, 18, this.reduced ? 1 : t * 3);
      this.p.sparkle(599, 320, 25, this.reduced ? 1 : t * 4);
    }
    c.restore(); c.restore();
  }

  run(t, duration) {
    const c = this.c, p = clamp(t / duration);
    this.p.crop('village', whole, [0, 0, 720, 1280], { zoom: 1.12, focus: [.7 - .3 * p, .55] });
    const x = this.reduced ? 360 : mix(-180, 900, p), stride = this.reduced ? 0 : Math.sin(t * 25);
    this.shadow(x, 1110, 290);
    this.cut('hero', 3, x, 1090 - Math.abs(stride) * 27, 490, {
      sx: 1 + stride * .055, sy: 1 - stride * .055, angle: -.045 + stride * .025
    });
    if (!this.reduced) for (let i = 0; i < 5; i++) {
      const a = (t * 2 + i * .19) % 1;
      c.save(); c.globalAlpha = (1 - a) * .5; c.fillStyle = '#fff2cc';
      c.beginPath(); c.ellipse(x - 170 - a * 180, 1100 - a * 50, 14 + a * 20, 10 + a * 11, 0, 0, Math.PI * 2);
      c.fill(); c.restore();
    }
  }

  door(t) {
    const c = this.c, image = this.p.images.get('homeStages');
    c.drawImage(image, 0, 0, image.width / 2, image.height, 0, 0, 720, 1280);
    const enter = this.reduced ? 1 : ease((t - .1) / .35);
    this.shadow(450, 1052, 290);
    this.cut('hero', 2, 450, 1045, 350, { angle: -.035 * Math.sin(enter * Math.PI) });
    // A rigid plane rotates on one fixed vertical hinge. Perspective and the wood edge
    // come from the same geometry; there is no independent width/height squash.
    const [degrees] = this.reduced ? [60] : poseAt(t, [
      [0, 0], [.09, -2], [.28, 69], [.40, 56], [.57, 62], [.78, 60], [1, 60]
    ]);
    this.rigidDoor(degrees * Math.PI / 180);
    if (t > .18 && t < .65) {
      c.save(); c.translate(390, 1100); this.p.discoveryAccent(t - .18, 510); c.restore();
    }
  }

  rigidDoor(angle) {
    const c = this.c, image = this.p.images.get('doorLeaf'), rect = this.frames.get('doorLeaf')[0];
    const width = 492, height = 860, hingeX = 122, footY = 1050, focal = 4200;
    const project = (u, v, depth = 0) => {
      const x = hingeX + u * Math.cos(angle) - depth * Math.sin(angle);
      const z = u * Math.sin(angle) + depth * Math.cos(angle);
      const scale = focal / (focal - z);
      return [360 + (x - 360) * scale, 640 + (footY + v - 640) * scale];
    };
    const edge = [project(width, -height * .72, 12), project(width, 0, 12),
      project(width, 0), project(width, -height * .72)];
    c.beginPath(); edge.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.closePath(); c.fillStyle = '#855025'; c.strokeStyle = '#482713'; c.lineWidth = 3; c.fill(); c.stroke();
    const strips = 96;
    for (let i = 0; i < strips; i++) {
      const u = i / strips * width, nextU = (i + 1) / strips * width;
      const top = project(u, -height), nextTop = project(nextU, -height), bottom = project(u, 0);
      c.save();
      c.transform((nextTop[0] - top[0]) / (width / strips), (nextTop[1] - top[1]) / (width / strips),
        (bottom[0] - top[0]) / height, (bottom[1] - top[1]) / height, top[0], top[1]);
      c.drawImage(image, rect[0] + rect[2] * i / strips, rect[1], rect[2] / strips, rect[3],
        0, 0, width / strips + .35, height);
      c.restore();
    }
  }

  pile(t) {
    const c = this.c, image = this.p.images.get('pile');
    this.p.crop('home', whole, [0, 0, 720, 1280]);
    const breath = this.reduced ? 0 : Math.sin(t * 2.7);
    c.save(); c.translate(360, 1010); c.scale(1 - breath * .018, 1 + breath * .035);
    c.drawImage(image, -315, -610, 630, 630); c.restore();
    // Soft breath puffs rise in a staggered rhythm, without written snoring marks.
    if (!this.reduced) for (let i = 0; i < 3; i++) {
      const age = (t + i * .36) % 1.8, a = clamp(age / 1.8);
      c.save(); c.globalAlpha = Math.sin(a * Math.PI) * .5;
      c.fillStyle = '#fff9e2'; c.strokeStyle = '#bc8f58'; c.lineWidth = 2;
      c.beginPath(); c.ellipse(490 + Math.sin(age * 3) * 20, 700 - a * 160, 7 + a * 18, 5 + a * 13, -.4, 0, Math.PI * 2);
      c.fill(); c.stroke(); c.restore();
    }
  }

  explain(t) {
    const c = this.c, pose = explanationTimingAt(t, this.reduced);
    const plate = this.p.images.get('tableRoom');
    c.drawImage(plate, 0, 0, 720, 1280);
    this.cut('tableFriends', 0, 495, 810 + pose.friendsY, 650, { sy: pose.friendsScaleY });
    this.turningHero(pose);

    // Restore the stationary tabletop over the lower torsos: natural depth occlusion.
    // Its rear rim follows the background plate, so no cut-off bodies or floating feet.
    c.save(); c.beginPath();
    c.moveTo(0, 780); c.lineTo(461, 704); c.lineTo(720, 778);
    c.lineTo(720, 1280); c.lineTo(0, 1280); c.closePath(); c.clip();
    c.drawImage(plate, 0, 0, 720, 1280); c.restore();
  }

  turningHero({ frame, angle, scale }) {
    this.tablePlane.draw(this.c, this.frames.get('tableHero')[frame], {
      x: 204, footY: 825, width: 420 * scale, angle
    });
  }

  departure(t) {
    const c = this.c;
    this.p.crop('departureBg', whole, [0, 0, 720, 1280]);
    // Four distinct step phases follow the winding path towards the entrance.
    const members = [];
    for (let i = 0; i < 4; i++) {
      const p = clamp(((this.reduced ? 3 : t) + 2.4 - i) / 10);
      const turn = clamp((p - .55) / .45);
      const x = p < .55 ? mix(-110, 500, p / .55) : mix(500, 600, turn);
      const y = p < .55 ? mix(805, 980, p / .55) : mix(980, 550, turn);
      members.push({ i, x, y, size: mix(225, 125, p) });
    }
    members.sort((a, b) => a.y - b.y);
    for (const { i, x, y, size } of members) {
      const step = this.reduced ? 0 : t * (i === 3 ? 7 : 9) + i * 1.7;
      const hop = Math.abs(Math.sin(step)), frame = this.reduced ? 0 : Math.floor(step / Math.PI) % 2;
      this.shadow(x, y + 2, size * .66);
      this.cut('party', i * 2 + frame, x, y - hop * size * .055, size, {
        sx: 1 + Math.sin(step * 2) * .028, sy: 1 - Math.sin(step * 2) * .028, angle: Math.sin(step) * .025
      });
    }
    const pop = propPopAt(t - .6, this.reduced);
    if (pop) {
      const lead = members.find(member => member.i === 0);
      const head = { x: lead.x, y: lead.y - lead.size };
      const bubble = { x: 180 + lead.x * .43, y: head.y - 240 };
      c.save(); c.translate(bubble.x, bubble.y + pop.lift); c.scale(pop.sx, pop.sy);
      this.cloud(0, 0, 154, 110);
      this.cut('dreamParts', 2, 0, 77, 248, { height: 137 });
      this.p.sparkle(-110, -52, 15, this.reduced ? 1 : t * 3);
      this.p.sparkle(113, 4, 12, this.reduced ? 1 : t * 4); c.restore();
      for (const [p, r] of [[.22, 6], [.49, 10], [.76, 15]]) {
        const x = mix(head.x, bubble.x, p), y = mix(head.y - 10, bubble.y + 110, p);
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = '#fff2cd'; c.fill();
        c.strokeStyle = '#674021'; c.lineWidth = 4; c.stroke();
      }
    }
  }
}
