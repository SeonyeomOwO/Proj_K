export const WIDTH = 720;
export const HEIGHT = 1280;
// 원화 PNG(작업용 원본, 40MB). 새 그림을 바꾸면 여기 경로를 고치고 `node tools/build-intro-assets.mjs`를 돌려 웹용 WebP를 다시 만든다.
export const SOURCES = Object.freeze({
  village: '../../assets/intro/motion-v1/village-clean.png',
  home: '../../assets/intro/motion-v1/home-clean.png',
  hero: '../../assets/intro/v1/overlay-hero-poses.png',
  hungryWalk: '../../assets/intro/motion-v1/hungry-walk-cels-v2.png',
  hungerWave: '../../assets/intro/motion-v1/hunger-wave-v2.png',
  heroDiscovery: '../../assets/intro/motion-v1/hero-discovery-cels-v3.png',
  paperBack: '../../assets/intro/motion-v1/flyer-paper-back-v3.png',
  flyerPlate: '../../assets/intro/motion-v1/flyer-empty-exchanges-v6.png',
  oreItem: '../../assets/intro/motion-v1/ore-single-v8.png',
  sackItem: '../../assets/intro/motion-v1/seed-sack-single-v8.png',
  gemsItem: '../../assets/intro/motion-v1/gems-single-v8.png',
  goldItem: '../../assets/intro/motion-v1/gold-seed-single-v8.png',
  arrowItem: '../../assets/intro/motion-v1/arrow-single-v8.png',
  seedItem: '../../assets/intro/motion-v1/ordinary-seed-single-v8.png',
  dreamParts: '../../assets/intro/motion-v1/dream-parts-v6.png',
  homeStages: '../../assets/intro/motion-v1/home-action-stages-v6.png',
  doorLeaf: '../../assets/intro/motion-v1/door-leaf-v6.png',
  tableRoom: '../../assets/intro/motion-v1/table-room-v9.png',
  tableFriends: '../../assets/intro/motion-v1/table-friends-v9.png',
  tableHero: '../../assets/intro/motion-v1/table-hero-flip-v10.png',
  departureBg: '../../assets/intro/motion-v1/departure-background-v6.png',
  party: '../../assets/intro/motion-v1/party-walk-v25.png',
  pile: '../../assets/intro/v1/overlay-sleepy-friends.png',
  encounter: '../../assets/intro/v1/scene-02-flyer-encounter.png',
  reactions: '../../assets/intro/v1/scene-05a-friends-reactions.png',
  purchase: '../../assets/intro/motion-v1/first-pickaxes-v25.png',
  firstMining: '../../assets/intro/motion-v1/scene-06-clean-v27.png',
  mineMeeting: '../../assets/intro/motion-v1/mine-ending-clean-v27.png'
});
// 그림 그대로 쓰는 벡터 원본(웹 폴더로 복사)
export const COPIES = Object.freeze({ mineShadow: '../../assets/intro/motion-v1/foreman-floor-shadow.svg' });
// 게임이 실제로 내려받는 파일: assets/intro/web/<이름>.webp (build-intro-assets.mjs가 만든다). 게임 광석 그림은 게임 것을 그대로 쓴다.
export const ASSETS = Object.freeze({
  ...Object.fromEntries(Object.keys(SOURCES).map(key => [key, `../../assets/intro/web/${key}.webp`])),
  gameOre: '../../assets/season-pass/exported/png/mineral_stone.webp',
  mineShadow: '../../assets/intro/web/mineShadow.svg'
});

const sequence = [
  ['hungry', 4.15, 1, '터덜터덜, 배고픈 햄찌'],
  ['discovery', .63, 1, '어, 저건 뭐지?'],
  ['encounter', 5.22, 2, '광장에서 받은 전단지'],
  ['flyer', 6, 3, '광물과 씨앗의 교환'],
  ['dream', 5, 3, '씨앗에 파묻힌 상상'],
  ['run', 1.4, 4, '집으로 달려가기'],
  ['pile', 2.6, 4, '포개져 퍼진 친구들'],
  ['door', 1, 4, '문을 활짝'],
  ['explain', 1.6, 4, '전단지를 펼치다'],
  ['reactions', 3.4, 5, '의욕, 걱정, 갸우뚱'],
  ['agreement', 1.6, 5, '함께하기로 결심'],
  ['savings', 2.4, 5, '소중한 전 재산'],
  ['shop', 3, 5, '첫 곡괭이'],
  ['departure', 3, 5, '첫 광산을 향해'],
  ['firstMining', 5.5, 6, '처음이라 서툰 곡괭이질'],
  ['foreman', 4.5, 6, '반장님의 그림자']
];
let cursor = 0;
export const SHOTS = Object.freeze(sequence.map(([id, duration, scene, label]) => {
  const shot = Object.freeze({ id, duration, scene, label, start: cursor, end: cursor + duration });
  cursor += duration;
  return shot;
}));
export const DURATION = cursor;
const encounterStart = SHOTS.find(shot => shot.id === 'encounter').start;
const doorStart = SHOTS.find(shot => shot.id === 'door').start;
const miningStart = SHOTS.find(shot => shot.id === 'firstMining').start;
const foremanStart = SHOTS.find(shot => shot.id === 'foreman').start;
export const PAPER_TRANSITION = Object.freeze({
  start: encounterStart - .51,
  cut: encounterStart,
  end: encounterStart + .40
});
export const SCENES = Object.freeze([
  { number: 1, label: '배고픈 햄찌', detail: '셀 걷기 · 배고픔 · 탄력 있는 발견 반응' },
  { number: 2, label: '뜻밖의 전단지', detail: '날아오는 종이 · 광장으로 전환' },
  { number: 3, label: '달콤한 상상', detail: '돌과 씨앗 팝업 · 씨앗 산에서 뿅 · 우물우물' },
  { number: 4, label: '친구들을 깨우다', detail: '퍼진 친구들 · 문 열기 · 전단지 펼치기' },
  { number: 5, label: '첫 광산으로', detail: '반응 컷 · 곡괭이 구매 · 네 친구의 발걸음' },
  { number: 6, label: '반장님과의 만남', detail: '서툰 첫 채굴 · 인간 그림자 · 튜토리얼로' }
].map(scene => Object.freeze({ ...scene, start: SHOTS.find(shot => shot.scene === scene.number).start })));

export function shotAt(time) {
  const safe = Number.isFinite(time) ? Math.min(DURATION, Math.max(0, time)) : 0;
  const index = Math.max(0, SHOTS.findIndex(shot => safe < shot.end));
  const resolved = safe === DURATION ? SHOTS.length - 1 : index;
  const shot = SHOTS[resolved];
  return { shot, index: resolved, local: safe - shot.start, time: safe };
}

// 샷마다 그릴 때 꼭 필요한 그림. 게임에서는 이걸 보고 "곧 나올 샷의 그림"부터 받고(점진 로딩), 다 쓴 그림은 메모리에서 내린다.
// 새 샷이나 새 그림을 쓰면 여기에도 적어야 한다(tests/intro.test.mjs가 빠진 그림이 없는지 확인한다).
const ITEMS = ['oreItem', 'sackItem', 'gemsItem', 'goldItem', 'arrowItem', 'seedItem'];
export const SHOT_ASSETS = Object.freeze({
  hungry: ['village', 'hungryWalk', 'hungerWave'],
  discovery: ['village', 'heroDiscovery', 'hungerWave', 'paperBack'],
  encounter: ['encounter', 'paperBack'],
  flyer: ['flyerPlate', ...ITEMS],
  dream: ['village', 'dreamParts', 'goldItem', 'seedItem'],
  run: ['village', 'hero'],
  pile: ['home', 'pile'],
  door: ['homeStages', 'hero', 'doorLeaf'],
  explain: ['tableRoom', 'tableFriends', 'tableHero'],
  reactions: ['reactions'],
  agreement: ['reactions'],
  savings: ['purchase'],
  shop: ['purchase'],
  departure: ['departureBg', 'party', 'dreamParts'],
  firstMining: ['firstMining', 'gameOre'],
  foreman: ['mineMeeting', 'mineShadow', 'gameOre']
});
// 재생을 시작하기 전에 받아 둘 샷(처음 약 10초). 나머지는 재생하면서 순서대로 받는다.
export const INITIAL_SHOTS = Object.freeze(['hungry', 'discovery', 'encounter']);
export const assetsOfShots = ids => [...new Set(ids.flatMap(id => SHOT_ASSETS[id] || []))];
// 그림 하나를 마지막으로 쓰는 샷의 번호(이 샷이 끝나고 다음 샷의 페이드가 끝나면 메모리에서 내려도 된다)
export const lastShotIndexOf = key => SHOTS.reduce((last, shot, index) => (SHOT_ASSETS[shot.id] || []).includes(key) ? index : last, -1);

export const CUES = Object.freeze([
  [.4, 'step'], [1.2, 'step'], [2, 'step'], [2.8, 'step'], [3.6, 'step'],
  [1.35, 'rumble'], [3.05, 'rumble'], [4.23, 'notice'], [4.47, 'whoosh'],
  [4.9, 'paper'], [6.38, 'paper'], [8.03, 'paper'],
  [10.78, 'pop'], [11.07, 'whoosh'], [11.78, 'pop'],
  [13.13, 'pop'], [13.42, 'whoosh'], [14.13, 'chime'],
  [17.7, 'pop'], [18.15, 'chime'], [21.1, 'whoosh'],
  [doorStart + .3, 'thump'], [26.46, 'whoosh'], [26.72, 'pop'], [27.6, 'pop'], [28.65, 'pop'],
  [29.7, 'pop'], [32.8, 'paper'], [35.9, 'thump'], [36.5, 'chime'], [38.1, 'chime'],
  [miningStart + 1.72, 'thump'], [miningStart + 3.4, 'paper'],
  [foremanStart + 1.65, 'notice'], [foremanStart + 3.68, 'whoosh']
].map(([time, sound]) => ({ time, sound })));
