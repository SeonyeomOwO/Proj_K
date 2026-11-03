import { ASSETS, CUES, DURATION, HEIGHT as H, INITIAL_SHOTS, PAPER_TRANSITION, SHOTS, SHOT_ASSETS, WIDTH as W, assetsOfShots, lastShotIndexOf, shotAt } from './storyboard.js';
import { paperFlightAt } from './paper-flight.js';
import { discoveryAccentAt, discoveryReactionAt } from './reaction-motion.js';
import { OneShotScenes } from './one-shot-scenes.js';
import { MineEnding } from './mine-ending.js';

const clamp = (x, min = 0, max = 1) => Math.min(max, Math.max(min, x));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = x => { const t = clamp(x); return t * t * (3 - 2 * t); };
const out = x => 1 - (1 - clamp(x)) ** 3;
const whole = [0, 0, 1, 1];

// The original artwork stays intact. Crops, camera movement and character transforms happen at playback time.
// progressive: play after the first shots' art is ready and keep loading the rest in story order (holding the story
//   at a shot boundary if a later shot's art is not there yet). release: free art once its last shot is over (game use;
//   the preview page keeps everything so it can seek anywhere). resumeOnShow: continue after the tab comes back.
const LOOKAHEAD = .8, LOAD_PARALLEL = 3, PAPER_END = PAPER_TRANSITION.end, GIVE_UP_MS = 20000;
export class MotionComic {
  constructor(canvas, { onUpdate = () => {}, onEnd = () => {}, reducedMotion = false, progressive = false, release = false, resumeOnShow = false } = {}) {
    this.progressive = progressive; this.release = release; this.buffering = false; this.destroyed = false;
    this.loading = new Map(); this.prepared = new Set(); this.lastUse = Object.fromEntries(Object.keys(ASSETS).map(key => [key, lastShotIndexOf(key)]));
    this.canvas = canvas;
    canvas.width = W; canvas.height = H;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.buffer = document.createElement('canvas');
    this.buffer.width = W; this.buffer.height = H;
    this.b = this.buffer.getContext('2d', { alpha: false });
    this.images = new Map(); this.onUpdate = onUpdate; this.onEnd = onEnd;
    this.oneShots = new OneShotScenes(this);
    this.mineEnding = new MineEnding(this);
    this.time = 0; this.playing = false; this.ready = false; this.reducedMotion = reducedMotion;
    this.sound = new ComicSounds(); this.raf = 0; this.lastStamp = 0;
    this.tick = this.tick.bind(this);
    this.wasPlaying = false;
    this.visibility = () => {
      if (document.hidden) { this.wasPlaying = this.playing; this.pause(); }
      else if (resumeOnShow && this.wasPlaying && !this.destroyed) { this.wasPlaying = false; this.play(); }
    };
    document.addEventListener('visibilitychange', this.visibility);
  }

  // Loads one picture once (repeat calls share the same download). Pictures are prepared (alpha bounds, paper
  // texture, baked ore) one by one as they arrive, so playback never waits for work on art it does not show yet.
  fetchImage(key) {
    if (this.images.has(key)) return Promise.resolve();
    if (!this.loading.has(key)) {
      this.loading.set(key, (async () => {
        const image = new Image(); image.src = new URL(ASSETS[key], import.meta.url).href;
        await image.decode();
        if (this.destroyed) return;
        this.images.set(key, image); this.prepareImage(key);
      })().finally(() => this.loading.delete(key)));
    }
    return this.loading.get(key);
  }
  async fetchImages(keys, parallel = LOAD_PARALLEL) {
    const queue = keys.filter(key => !this.images.has(key));
    await Promise.all(Array.from({ length: Math.min(parallel, queue.length) }, async () => {
      while (queue.length && !this.destroyed) await this.fetchImage(queue.shift());
    }));
  }
  prepareImage(key) {
    if (key === 'paperBack') {
      // The blank reverse of the same flyer is an opaque sheet with transparent edges.
      // Fill its interior underneath the texture so the concealed scene cut cannot bleed through.
      const paper = this.images.get('paperBack');
      this.paperTexture = document.createElement('canvas');
      this.paperTexture.width = paper.width; this.paperTexture.height = paper.height;
      const surface = this.paperTexture.getContext('2d');
      surface.fillStyle = '#f9e4b6';
      surface.fillRect(paper.width * .055, paper.height * .065, paper.width * .89, paper.height * .87);
      surface.drawImage(paper, 0, 0);
    }
    this.mineEnding.prepare(key);
    this.oneShots.prepare(key);
  }
  shotReady(id) { return (SHOT_ASSETS[id] || []).every(key => this.images.has(key)); }

  async load() {
    if (!this.progressive) {
      await this.fetchImages(Object.keys(ASSETS), Object.keys(ASSETS).length);
    } else {
      await this.fetchImages(assetsOfShots(INITIAL_SHOTS));
      // The rest follows the story order while the first shots play. A failed picture is retried when its shot is near.
      this.rest = this.fetchImages(assetsOfShots(SHOTS.map(shot => shot.id))).catch(error => { console.error('Prologue asset load failed:', error); });
    }
    if (this.destroyed) return;
    this.ready = true; this.render(); this.emit();
  }

  // True when every shot between now and a short lookahead can be drawn. Otherwise the story holds at the cut.
  canAdvance(from, seconds) {
    if (!this.progressive) return true;
    const end = Math.min(DURATION, from + seconds + LOOKAHEAD);
    return SHOTS.every(shot => shot.start >= end || shot.end <= from || this.shotReady(shot.id));
  }
  setBuffering(value) {
    if (this.buffering === value) return;
    this.buffering = value; this.emit();
  }
  freeFinished(index) {
    if (!this.release) return;
    // A shot's picture may still show through the cross-fade into the next shot, so free it one shot later.
    for (const key of [...this.images.keys()]) {
      if (this.lastUse[key] >= 0 && this.lastUse[key] < index - 1) this.images.delete(key);
    }
    if (this.time > PAPER_END) this.paperTexture = null;
  }

  emit() { this.onUpdate({ ...shotAt(this.time), playing: this.playing, ready: this.ready, buffering: this.buffering }); }
  play() {
    if (!this.ready || this.playing) return;
    if (this.time >= DURATION) this.time = 0;
    this.playing = true; this.lastStamp = performance.now();
    if (this.sound.enabled) this.sound.unlock();
    this.raf = requestAnimationFrame(this.tick); this.emit();
  }
  pause() { this.playing = false; cancelAnimationFrame(this.raf); this.emit(); }
  seek(time) {
    this.time = shotAt(time).time; this.lastStamp = performance.now();
    if (this.time >= DURATION && this.playing) this.pause();
    if (this.ready) this.render(); this.emit();
  }
  setReducedMotion(value) { this.reducedMotion = value; if (this.ready) this.render(); }
  tick(stamp) {
    if (!this.playing) return;
    const previous = this.time, seconds = Math.max(0, stamp - this.lastStamp) / 1000;
    this.lastStamp = stamp;
    if (!this.canAdvance(previous, seconds)) {
      // Art for the next shot is still arriving: hold the picture (sound and timeline wait too) and keep trying.
      this.bufferSince ??= stamp;
      if (stamp - this.bufferSince > GIVE_UP_MS) {
        // The connection cannot deliver the rest: end the story here instead of hanging; the caller hands over to the game.
        console.error('Prologue art did not arrive in time; ending early.');
        this.bufferSince = null; this.setBuffering(false); this.pause(); this.onEnd(); return;
      }
      if (!this.retryAt || stamp > this.retryAt) {
        this.retryAt = stamp + 2500;
        const missing = SHOTS.filter(shot => shot.start < previous + LOOKAHEAD + 1 && shot.end > previous).flatMap(shot => SHOT_ASSETS[shot.id]).filter(key => !this.images.has(key));
        this.fetchImages([...new Set(missing)]).catch(() => {});
      }
      this.setBuffering(true); this.raf = requestAnimationFrame(this.tick); return;
    }
    this.bufferSince = null;
    this.setBuffering(false);
    this.time = Math.min(DURATION, this.time + seconds);
    for (const cue of CUES) if (cue.time > previous && cue.time <= this.time) this.sound.cue(cue.sound);
    this.render();
    this.freeFinished(shotAt(this.time).index);
    if (this.time >= DURATION) { this.pause(); this.onEnd(); return; }
    this.emit(); this.raf = requestAnimationFrame(this.tick);
  }
  destroy() {
    this.destroyed = true; this.pause(); this.sound.close(); document.removeEventListener('visibilitychange', this.visibility);
    this.images.clear(); this.paperTexture = null;
  }

  render() {
    const { shot, index, local } = shotAt(this.time);
    this.ctx.fillStyle = '#f3dfbb'; this.ctx.fillRect(0, 0, W, H);
    // Never draw a shot whose art is missing (it would throw): show the paper colour until it arrives.
    if (!this.shotReady(shot.id) || (index > 0 && !this.reducedMotion && local < .16 && !this.shotReady(SHOTS[index - 1].id))) return;
    const hiddenCut = shot.id === 'discovery' || shot.id === 'encounter';
    const cross = this.reducedMotion || hiddenCut ? 1 : smooth(local / .16);
    if (cross < 1 && index > 0) {
      const previous = SHOTS[index - 1]; this.drawShot(previous.id, previous.duration, previous.duration);
      this.ctx.drawImage(this.buffer, 0, 0);
    }
    this.drawShot(shot.id, local, shot.duration);
    this.ctx.globalAlpha = index ? cross : 1;
    this.ctx.drawImage(this.buffer, 0, 0); this.ctx.globalAlpha = 1;
    this.paperTransition(this.time);
    if (shot.id === 'foreman') this.mineEnding.curtain(local, this.ctx);
  }

  paperTransition(time) {
    if (this.reducedMotion || !this.paperTexture) return;
    const flight = paperFlightAt(time);
    if (!flight) return;
    const c = this.ctx, image = this.paperTexture;
    const { x, y, width, angle, squeeze, shear, bend, phase } = flight;
    const height = width * image.height / image.width;
    c.save(); c.translate(x, y); c.rotate(angle);
    c.transform(squeeze, 0, shear, 1, 0, 0);
    const strips = 64, dw = width / strips;
    for (let i = 0; i < strips; i++) {
      const u = i / strips;
      // Shear each texture strip along the wave so the curled edge stays continuous.
      const wave = u * Math.PI * 2 + phase;
      const top = -height / 2 + Math.sin(wave) * width * bend;
      const nextTop = -height / 2 + Math.sin(wave + Math.PI * 2 / strips) * width * bend;
      c.save();
      c.transform(1, (nextTop - top) / dw, 0, 1, -width / 2 + i * dw, top);
      c.drawImage(image, u * image.width, 0, image.width / strips, image.height,
        0, 0, dw + .5, height);
      c.restore();
    }
    c.restore();
  }

  crop(key, rect, box, { zoom = 1, focus = [.5, .5], fit = 'cover' } = {}) {
    const c = this.b, image = this.images.get(key);
    const [sx, sy, sw, sh] = [rect[0] * image.width, rect[1] * image.height, rect[2] * image.width, rect[3] * image.height];
    const [x, y, w, h] = box;
    const k = (fit === 'contain' ? Math.min(w / sw, h / sh) : Math.max(w / sw, h / sh)) * zoom;
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.drawImage(image, sx, sy, sw, sh, x + (w - sw * k) * focus[0], y + (h - sh * k) * focus[1], sw * k, sh * k);
    c.restore();
  }
  panel(key, rect, box, options = {}) {
    const c = this.b, [x, y, w, h] = box;
    c.save(); c.shadowColor = '#3b201655'; c.shadowBlur = 18; c.shadowOffsetY = 10;
    c.fillStyle = '#4b2e20'; c.fillRect(x - 6, y - 6, w + 12, h + 12); c.restore();
    c.fillStyle = '#f7e7c8'; c.fillRect(x, y, w, h); this.crop(key, rect, box, options);
  }
  sprite(cell, x, y, size, { angle = 0, sx = 1, sy = 1 } = {}) {
    const c = this.b, image = this.images.get('hero');
    c.save(); c.translate(x, y); c.rotate(angle); c.scale(sx, sy);
    c.drawImage(image, (cell % 2) * image.width / 2, Math.floor(cell / 2) * image.height / 3, image.width / 2, image.height / 3, -size / 2, -size / 2, size, size); c.restore();
  }
  hungerWave(x, y, width, age, direction) {
    if (age <= 0 || age >= 1.25) return;
    const c = this.b, image = this.images.get('hungerWave'), phase = age / 1.25;
    const alpha = smooth(age / .14) * (1 - smooth((age - .48) / .77));
    const moving = !this.reducedMotion;
    // Warp the actual cream/orange wave texture in narrow strips; no extra arcs.
    const source = [.04 * image.width, .34 * image.height, .92 * image.width, .36 * image.height];
    const stretch = moving ? 1 + phase * .22 : 1;
    const height = width * source[3] / source[2];
    c.save(); c.globalAlpha *= alpha;
    c.translate(x + (moving ? direction * phase * width * .2 : 0), y - (moving ? phase * width * .12 : 0));
    c.rotate(direction * -.16); c.scale(direction * stretch, 1);
    const strips = 48, stripWidth = width / strips;
    for (let i = 0; i < strips; i++) {
      const u = i / strips;
      const offset = moving ? Math.sin(u * Math.PI * 4 - age * 12) * width * .065 * Math.sin(phase * Math.PI) : 0;
      c.drawImage(image, source[0] + u * source[2], source[1], source[2] / strips, source[3],
        -width / 2 + i * stripWidth, -height / 2 + offset, stripWidth + .45, height);
    }
    c.restore();
  }
  hungryWalk(t, noticeTime = null) {
    const c = this.b, noticing = noticeTime !== null;
    const image = this.images.get(noticing ? 'heroDiscovery' : 'hungryWalk'), moving = !this.reducedMotion;
    // Perspective: keep the feet on the central path and enlarge the hamster as it approaches.
    const progress = moving ? smooth(t / 4.15) : .7;
    const depth = progress / (1.8 - .8 * progress);
    const size = mix(190, 510, depth), footY = mix(685, 1100, depth), x = W / 2;
    const cycle = (Math.min(t, 4.15) % 1.6) / 1.6;
    const reaction = noticing ? discoveryReactionAt(noticeTime, this.reducedMotion) : null;
    const frame = noticing
      ? reaction.frame
      : (moving && t < 4.15 ? Math.floor(cycle * 4) : 1);
    const settle = moving ? 1 - smooth((t - 3.95) / .2) : 0;
    const bob = -(Math.sin(cycle * Math.PI * 4) ** 2) * size * .012 * settle;
    const sway = Math.sin(cycle * Math.PI * 2) * .012 * settle;
    c.save(); c.fillStyle = '#533a2638'; c.beginPath();
    c.ellipse(x, footY + size * .005, size * .30, size * .045, 0, 0, Math.PI * 2); c.fill();
    c.translate(x, footY + bob); c.rotate(sway);
    if (reaction) {
      c.translate(0, reaction.lift); c.rotate(reaction.tilt);
      c.scale(reaction.sx, reaction.sy);
    }
    // Per-cel sole anchors prevent the lower atlas row from jumping vertically.
    const anchorX = [.516, .514, .518, .523][frame];
    const anchorY = (noticing ? [.922, .922, .913, .913] : [.922, .922, .900, .904])[frame];
    c.drawImage(image, (frame % 2) * image.width / 2, Math.floor(frame / 2) * image.height / 2,
      image.width / 2, image.height / 2, -size * anchorX, -size * anchorY, size, size);
    for (const start of [1.35, 3.05]) {
      this.hungerWave(-size * .235, -size * .19, size * .20, t - start, -1);
      this.hungerWave(size * .235, -size * .19, size * .20, t - start - .08, 1);
    }
    if (noticing) this.discoveryAccent(noticeTime, size);
    c.restore();
  }
  discoveryAccent(t, size) {
    const c = this.b;
    c.save(); c.translate(-size * .30, -size * .86); c.scale(size / 510, size / 510);
    // Three wordless attention rays, staggered slightly to follow the character's take.
    for (let i = 0; i < 3; i++) {
      const accent = discoveryAccentAt(t, i, this.reducedMotion);
      if (!accent.alpha) continue;
      const angle = (-155 + i * 43) * Math.PI / 180;
      const distance = 22 + accent.spread;
      c.save(); c.globalAlpha *= accent.alpha;
      c.translate(Math.cos(angle) * distance, Math.sin(angle) * distance); c.rotate(angle);
      c.scale(accent.scale, accent.scale);
      c.fillStyle = '#ffd85a'; c.strokeStyle = '#693b1d'; c.lineWidth = 4; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(-3, 0);
      c.quadraticCurveTo(8, -7, 34, -9); c.quadraticCurveTo(43, -8, 43, 0);
      c.quadraticCurveTo(43, 8, 34, 9); c.quadraticCurveTo(8, 7, -3, 0);
      c.fill(); c.stroke();
      c.strokeStyle = '#fff4c6'; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(13, -2); c.lineTo(33, -3); c.stroke();
      c.restore();
    }
    c.restore();
  }
  sparkle(x, y, size, phase, color = '#fff8cb') {
    const c = this.b, radius = size * (.6 + .4 * Math.sin(phase));
    c.save(); c.translate(x, y); c.rotate(phase * .08); c.fillStyle = color;
    c.shadowColor = '#ffc237'; c.shadowBlur = 16;
    c.beginPath(); c.moveTo(0, -radius); c.quadraticCurveTo(radius * .17, -radius * .17, radius, 0);
    c.quadraticCurveTo(radius * .17, radius * .17, 0, radius); c.quadraticCurveTo(-radius * .17, radius * .17, -radius, 0);
    c.quadraticCurveTo(-radius * .17, -radius * .17, 0, -radius); c.fill(); c.restore();
  }
  motes(t, amount = 9) {
    for (let i = 0; i < amount; i++) {
      const x = 70 + ((i * 137.3) % 590), y = 80 + ((i * 193.7 - t * 24 + 1800) % 1100);
      this.b.save(); this.b.globalAlpha = .3 + .2 * Math.sin(t * 2 + i); this.sparkle(x, y, 5 + i % 4, t * 2 + i); this.b.restore();
    }
  }
  impact(t, strength = 11) {
    if (this.reducedMotion) return;
    const decay = Math.exp(-t * 14); this.b.translate(Math.sin(t * 90) * strength * decay, Math.cos(t * 73) * strength * decay);
  }
  drawShot(id, t, duration) {
    const c = this.b, p = clamp(t / duration), motion = this.reducedMotion ? 0 : 1;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
    const paper = c.createLinearGradient(0, 0, W, H); paper.addColorStop(0, '#fff0d2'); paper.addColorStop(1, '#d7ad73');
    c.fillStyle = paper; c.fillRect(0, 0, W, H); c.save();
    if (id === 'hungry') {
      this.crop('village', whole, [0, 0, W, H], { zoom: 1.04, focus: [.5, .63] });
      this.hungryWalk(t);
    } else if (id === 'discovery') {
      const push = 1 + .055 * smooth(t / .85) * motion;
      c.translate(W / 2, 840); c.scale(push, push); c.translate(-W / 2, -840);
      this.crop('village', whole, [0, 0, W, H], { zoom: 1.04, focus: [.5, .63] });
      this.hungryWalk(4.15 + t, t);
    } else if (id === 'encounter') {
      this.panel('encounter', [0, 0, 1, .496], [24, 44, 672, 535], { zoom: 1 + .025 * p * motion });
      if (t > 1.6) { const enter = this.reducedMotion ? 1 : out((t - 1.6) / .38); this.panel('encounter', [0, .506, .508, .494], [24 - (1 - enter) * 390, 615, 326, 610]); }
      if (t > 3.25) { const enter = this.reducedMotion ? 1 : out((t - 3.25) / .38); this.panel('encounter', [.523, .506, .477, .494], [370 + (1 - enter) * 390, 615, 326, 610]); }
    } else if (id === 'flyer') {
      this.oneShots.flyer(t);
    } else if (id === 'dream') {
      this.oneShots.dream(t);
    } else if (id === 'run') {
      this.oneShots.run(t, duration);
    } else if (id === 'door') {
      this.oneShots.door(t);
    } else if (id === 'pile') {
      this.oneShots.pile(t);
    } else if (id === 'explain') {
      this.oneShots.explain(t);
    } else if (id === 'reactions') {
      const index = t < 1.05 ? 0 : t < 2.1 ? 1 : 2, local = t - [0, 1.05, 2.1][index];
      const rect = [[0, 0, .324, .443], [.337, 0, .324, .443], [.678, 0, .322, .443]][index];
      if (index === 2 && motion) { c.translate(W / 2, H / 2); c.rotate(Math.sin(local * 3) * .018); c.translate(-W / 2, -H / 2); }
      this.panel('reactions', rect, [24, 55, 672, 1165], { zoom: 1 + .045 * out(local / .5) * motion });
    } else if (id === 'agreement') {
      this.panel('reactions', [0, .455, 1, .545], [24, 300, 672, 620], { fit: 'contain', zoom: 1 + .035 * p * motion });
      if (t > .3) { this.sparkle(144, 226, 18, motion ? t * 5 : 1); this.sparkle(590, 1004, 15, motion ? t * 4 : 1); }
    } else if (id === 'savings') {
      this.panel('purchase', [0, 0, 1, .299], [24, 80, 672, 340], { fit: 'contain' });
      const enter = this.reducedMotion ? 1 : out(t / .7);
      c.save(); c.globalAlpha = enter; this.panel('purchase', [.30, .16, .38, .105], [80, 540 + 30 * (1 - enter), 560, 440], { fit: 'cover', zoom: 1 + .05 * p * motion }); c.restore();
    } else if (id === 'shop') {
      if (t < .9) this.panel('purchase', [0, .308, .494, .353], [24, 225, 672, 720]);
      else if (t < 1.45) { this.impact(t - .9, 6); this.panel('purchase', [.511, .308, .489, .353], [24, 225, 672, 720]); }
      else { const reveal = this.reducedMotion ? 1 : out((t - 1.45) / .4); c.save(); c.globalAlpha = reveal; this.panel('purchase', [0, .672, 1, .328], [24, 400 - 30 * reveal, 672, 400], { fit: 'contain' }); c.restore(); if (reveal > .8) { this.sparkle(150, 345, 22, motion ? t * 4 : 1); this.sparkle(580, 860, 20, motion ? t * 3 : 1); } }
    } else if (id === 'departure') {
      this.oneShots.departure(t);
    } else if (id === 'firstMining') {
      this.mineEnding.comic(t);
    } else if (id === 'foreman') {
      this.mineEnding.meeting(t);
    }
    c.restore();
    const vignette = c.createRadialGradient(W / 2, H / 2, W * .4, W / 2, H / 2, H * .75);
    vignette.addColorStop(0, 'transparent'); vignette.addColorStop(1, '#30170d35'); c.fillStyle = vignette; c.fillRect(0, 0, W, H);
  }
}

// Optional lightweight preview effects; no audio files, speech or background music.
class ComicSounds {
  constructor() { this.enabled = false; this.context = null; }
  unlock() {
    if (!this.enabled) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    try { this.context ||= new Audio(); this.context.resume().catch(() => {}); } catch { this.enabled = false; }
  }
  cue(kind) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const audio = this.context, start = audio.currentTime;
    const settings = { step: [95, 45, .08, .06], rumble: [78, 32, .45, .06], paper: [900, 240, .11, .025], notice: [480, 900, .16, .035], chime: [1100, 1760, .32, .045], whoosh: [480, 95, .2, .03], thump: [115, 40, .17, .08], pop: [370, 170, .1, .04] }[kind];
    if (!settings) return;
    const [from, to, duration, volume] = settings, oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.type = kind === 'chime' || kind === 'notice' ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(from, start); oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
    gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(volume, start + .008); gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain).connect(audio.destination); oscillator.start(start); oscillator.stop(start + duration + .01);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  close() { this.context?.close().catch(() => {}); }
}
