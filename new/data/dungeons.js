// 던전 밸런스. 입장 규칙과 화면은 이 값을 함께 사용한다.
// 던전은 일반 광맥과 같은 16개 결정 무대로 열린다: 다이아 광산은 결정을 다 캐면 더 단단하게 다시 솟고,
// 광산탑은 여러 광석이 섞인 광맥을 다 깨면 다음 층으로 올라간다.
export const DUNGEONS = Object.freeze({
  mine: Object.freeze({ name: '다이아 광산', seconds: 60, entries: 2, hp: 84, hpGrowth: 1.25, diamondsPerRock: 1 }),
  // mix: 결정마다 뽑는 광석 종류 비율(광산탑은 이것저것 섞인 광맥)
  tower: Object.freeze({ name: '무한의 광산탑', hpBase: 40, hpStep: .2, mix: Object.freeze({ stone: .4, copper: .3, emerald: .2, ruby: .1 }) })
});
// 지수 오버플로 없이 계속 오를 수 있는 곡선. 일반 광맥 층수와 독립적이다. 값은 결정 한 개의 체력이다.
// 광산: 회차(1부터)마다 결정 체력이 hpGrowth배. 광산탑: 층마다 제곱 곡선으로 오른다.
export const mineHp = round => Math.min(1e15, Math.round(DUNGEONS.mine.hp * DUNGEONS.mine.hpGrowth ** Math.max(0, round - 1)));
export const towerHp = floor => Math.min(1e15, Math.round(DUNGEONS.tower.hpBase * (1 + Math.max(0, floor - 1) * DUNGEONS.tower.hpStep) ** 2));
export const towerRewards = floor => ({ diamond: Math.min(1000, 10 + 2 * floor), ruby: Math.min(100, Math.ceil(floor / 5)) });
