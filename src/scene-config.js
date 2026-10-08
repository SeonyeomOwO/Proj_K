// Presentation only: ore IDs, damage, rewards and save structure remain in engine.js.
export const MINERALS = [
  {id:'stone',name:'돌 광맥',color:'#aeb3bc'},
  {id:'copper',name:'구리 광맥',color:'#f5a54a'},
  {id:'ruby',name:'루비 광맥',color:'#ff557c'},
  {id:'diamond',name:'다이아 광맥',color:'#d4f6ff'},
  {id:'emerald',name:'에메랄드',color:'#48de93'}
];
// 광석 종류·확률·보상은 data/config.js의 ORE_KINDS가 정한다(결정마다 확률로 섞여 나옴). 여기는 화면 이름만 둔다.
// 다이아몬드는 광맥에 나오지 않고 보석 던전 바위로만 나온다.
// Dense, overlapping growths. Each existing logical ore ID owns one visible growth.
// The last coordinate is its ground contact, so losing a point reveals the ground behind it.
// 광맥 전체 크기 배율(2026-10-01, "돌이 너무 크다" 피드백으로 0.8). 결정 크기와 간격을 VEIN_PIVOT 기준으로 함께 줄여
// 조밀한 덩어리 모양은 유지한다. 엔진의 목표 판정·햄찌 발판(vein-geometry)도 이 값을 그대로 따른다.
export const VEIN_SCALE = .8;
export const VEIN_PIVOT = [483,712];
const RAW_BASES = [
  [430,540],[525,520],[625,555],
  [350,620],[520,630],[690,655],
  [275,705],[425,705],
  [350,765],[540,765],[665,785],
  [430,835],[550,865],[645,860],
  [345,835],[470,905]
];
export const CRYSTAL_BASES = RAW_BASES.map(([x,y])=>[
  Math.round(VEIN_PIVOT[0]+(x-VEIN_PIVOT[0])*VEIN_SCALE),
  Math.round(VEIN_PIVOT[1]+(y-VEIN_PIVOT[1])*VEIN_SCALE)
]);
export const CREW_HOMES = [[150,845],[810,850],[460,990]];
export function crystalShape(id) {
  return {width:(172+(id*17%37))*VEIN_SCALE,height:(190+(id*31%69))*VEIN_SCALE,lean:((id*7%5)-2)*.035};
}
// Source-pixel body-foot anchors keep body size and foot position consistent between poses.
export const ROUND_POSES = {
  idle:{id:'hamster_round_idle',anchor:[345,469]},
  lift:{id:'hamster_round_lift',anchor:[329,480]},
  hit:{id:'hamster_round_hit',anchor:[196,301]},
  recover:{id:'hamster_round_recover',anchor:[197,305]}
};
export const MINER_SCALE = .255;
