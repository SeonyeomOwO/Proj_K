const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

// A compact cartoon take: anticipation, quick stretch, overshoot, then two smaller rebounds.
// The feet remain the pivot, so squash/stretch reads as weight rather than image scaling.
const DISCOVERY_KEYS = [
  // time, width, height, tilt, lift
  [0,    1,    1,     0,     0],
  [.07,  1.13, .87,   .035,  0],
  [.16,  .90,  1.18, -.065, -10],
  [.25,  1.06, .95,  -.025,  0],
  [.36,  .97,  1.05, -.045, -3],
  [.49,  1.01, .99,  -.035,  0],
  [.63,  1,    1,    -.035,  0]
];

export function discoveryReactionAt(time, reducedMotion = false) {
  const frame = time < .08 ? 0 : time < .22 ? 1 : time < .40 ? 2 : 3;
  if (reducedMotion) return { frame, sx: 1, sy: 1, tilt: 0, lift: 0 };
  let next = DISCOVERY_KEYS.findIndex(key => key[0] >= time);
  if (next < 0) next = DISCOVERY_KEYS.length - 1;
  const a = DISCOVERY_KEYS[Math.max(0, next - 1)], b = DISCOVERY_KEYS[next];
  const u = a === b ? 0 : smooth((time - a[0]) / (b[0] - a[0]));
  const values = a.slice(1).map((value, index) => value + (b[index + 1] - value) * u);
  return { frame, sx: values[0], sy: values[1], tilt: values[2], lift: values[3] };
}

export function discoveryAccentAt(time, ray, reducedMotion = false) {
  const age = time - .08 - ray * .025;
  if (age <= 0 || age >= .48) return { scale: 0, alpha: 0, spread: 0 };
  return {
    scale: reducedMotion ? 1 : 1 - Math.exp(-age * 12) * Math.cos(age * 28),
    alpha: smooth(age / .025) * (1 - smooth((age - .27) / .21)),
    spread: reducedMotion ? 0 : 8 * smooth(age / .22)
  };
}
