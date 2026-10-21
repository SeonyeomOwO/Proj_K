import { HEIGHT, PAPER_TRANSITION, WIDTH } from './storyboard.js';

// One uninterrupted pass: accelerating approach, covered cut, then a curling exit.
// Both halves have the same horizontal velocity at the cut; there is no hold pose.
export function paperFlightAt(time) {
  const { start, cut, end } = PAPER_TRANSITION;
  if (time < start || time > end) return null;
  const arriving = time <= cut;
  const u = arriving ? (time - start) / (cut - start) : (time - cut) / (end - cut);
  const roll = Math.sin(u * Math.PI);
  const bend = .008 + .10 * roll * roll;
  const phase = (time - start) * 25;
  if (arriving) {
    const easeOut = 1 - (1 - u) ** 3;
    return {
      x: -150 + 510 * (.15 * u + .85 * u * u),
      y: 250 + (HEIGHT / 2 - 250) * (u * u * (3 - 2 * u))
        + Math.sin(u * Math.PI * 2) * 50 * (1 - u),
      width: 130 + 1070 * u ** 1.75,
      angle: -.8 + .86 * easeOut + Math.sin(u * Math.PI * 3) * .24 * (1 - u),
      squeeze: 1 - .23 * roll * roll,
      shear: .14 * Math.sin(u * Math.PI * 2),
      bend, phase
    };
  }
  const entrySpeed = 510 * 1.85 / (cut - start);
  return {
    x: WIDTH / 2 + entrySpeed * (end - cut) * u + 600 * u * u,
    y: HEIGHT / 2 - 340 * u * u + 60 * roll * roll,
    width: 1200 * (1 - .35 * u * u),
    angle: .06 + u + Math.sin(u * Math.PI * 2) * .08,
    squeeze: 1 - .28 * roll * roll,
    shear: .20 * roll,
    bend, phase
  };
}
