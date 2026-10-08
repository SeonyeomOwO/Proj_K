// 광맥 바닥 지형: 엔진(누가 어느 결정을 칠 수 있나)과 화면(햄찌가 어디 서고 어디로 걷나)이 같이 쓴다.
// 좌표는 scene-config의 CRYSTAL_BASES(결정 밑동)와 같은 디자인 좌표다. DOM·Canvas에 의존하지 않는다.
import { CRYSTAL_BASES, crystalShape } from './scene-config.js';

export const HAMSTER_RADIUS = 24;
// 걷는 속도(px/s). 햄찌마다 이 범위에서 정해지고, 엔진은 평균값으로 목표까지 걸어가는 시간을 계산한다.
export const HAMSTER_WALK = { min: 140, max: 200 };
export const HAMSTER_WALK_AVG = (HAMSTER_WALK.min + HAMSTER_WALK.max) / 2;
// 한 걸음 보폭(px). 걸음 박자(통통 뛰기·뒤뚱거림)는 실제 이동 거리에 맞춘다.
export const HAMSTER_STRIDE = 26;
// 햄찌가 걸을 수 있는 바닥. 광맥 양옆과 위쪽 모서리까지 넓혀 광맥을 한 바퀴 둘러쌀 수 있게 한다
// (광맥 뒤쪽은 hidden()이 걸러 주므로 위쪽을 넓혀도 결정 뒤에 숨는 자리는 생기지 않는다).
export const FIELD = { minX: 110, maxX: 855, minY: 440, maxY: 985 };
// 결정 하나가 바닥에서 차지하는 타원. 햄찌는 이 안으로 들어가지 않는다.
export function footprint(id) {
  const [x, y] = CRYSTAL_BASES[id], w = crystalShape(id).width;
  return { x, y: y - 8, rx: w * .4, ry: 30 };
}

export function insideFootprint(px, py, f, r = HAMSTER_RADIUS) {
  const dx = (px - f.x) / (f.rx + r), dy = (py - f.y) / (f.ry + r * .6);
  return dx * dx + dy * dy < 1;
}

export function outOfField(px, py) {
  return px < FIELD.minX || px > FIELD.maxX || py < FIELD.minY || py > FIELD.maxY;
}

// 살아 있는 결정의 바닥을 밟거나 필드를 벗어나면 막힌 자리
export function blocked(s, px, py, ignore = -1) {
  return outOfField(px, py) || s.ores.some(o => o.hp > 0 && o.id !== ignore && insideFootprint(px, py, footprint(o.id)));
}

// 앞쪽(아래)에 있는 살아 있는 결정이 햄찌 몸을 대부분 가리면, 그 자리에 선 햄찌는 결정 뒤에 숨어 보이지 않는다
export function hidden(s, px, py) {
  return s.ores.some(o => {
    if (o.hp <= 0)
      return false;
    const [bx, by] = CRYSTAL_BASES[o.id], { width, height } = crystalShape(o.id);
    if (by <= py + 4)
      return false;
    const overlapX = Math.min(px + 30, bx + width * .38) - Math.max(px - 30, bx - width * .38);
    const overlapY = Math.min(py, by) - Math.max(py - 90, by - height);
    return overlapX > 24 && overlapY > 36;
  });
}

// 결정 주위에서 햄찌가 서서 칠 수 있는 자리: 결정을 빙 둘러 16방향(위쪽·옆·앞쪽 모두).
// 다른 결정 바닥을 밟지 않고, 앞 결정에 가려지지 않는 자리만 남긴다. 빽빽한 광맥 가운데 결정은 자리가 없어
// 바깥 둘레 결정부터 깨지고, 햄찌는 광맥 바깥을 한 바퀴 돌며 선다.
const STAND_ANGLES = Array.from({ length: 16 }, (_, k) => k / 16 * Math.PI * 2);
// extra를 주면 그만큼 바깥 둘레를 돌려준다(안쪽 둘레가 찼을 때 한 바퀴 밖에서 서서 친다).
export function standPoints(s, id, extra = 0) {
  const f = footprint(id);
  return STAND_ANGLES.map(a => [f.x + Math.cos(a) * (f.rx + HAMSTER_RADIUS + 8 + extra), f.y + Math.sin(a) * (f.ry + HAMSTER_RADIUS + 4 + extra * .6)])
    .filter(([x, y]) => !blocked(s, x, y, id) && !hidden(s, x, y));
}

export function exposed(s, id) {
  return standPoints(s, id).length > 0;
}
