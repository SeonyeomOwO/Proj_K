import {hitCell} from './grid.js';
// Six independent connected excavations. All retain room around the current cart.
export const LAYOUTS=[
 {id:'classic',name:'물결 길',rows:['#####..###','#####..###','#####..###','####...###','####...###','####...###','###....###','##...#####','##...#####','##......##','##......##','#.......##','#.......##','###.....##','###....###','####...###','##########']},
 {id:'fork',name:'갈림길',rows:['##########','###...####','###...####','##.....###','##..#..###','##..#...##','##..##..##','##..##..##','#...#...##','#.......##','##.....###','##.....###','##......##','###.....##','###....###','####...###','##########']},
 {id:'ring',name:'원형 회랑',rows:['##########','####..####','###....###','##......##','##..##..##','#..####..#','#..####..#','#..####..#','##..##..##','##......##','###....###','###....###','##......##','###.....##','###....###','####...###','##########']},
 {id:'chambers',name:'연결된 작업장',rows:['##########','###....###','##......##','##......##','####..####','####..####','##......##','#........#','#........#','####..####','####..####','##......##','##......##','###.....##','###....###','####...###','##########']},
 {id:'braid',name:'나란한 광맥 길',rows:['##########','##......##','##......##','##..##..##','##..##..##','#...##..##','#...##...#','##..##...#','##..##..##','##......##','###....###','###....###','##......##','###.....##','###....###','####...###','##########']},
 {id:'bays',name:'옆으로 열린 채굴장',rows:['##########','####..####','####..####','##....####','#.....####','#.....####','####..####','####.....#','####.....#','####.....#','####..####','##....####','#.......##','###.....##','###....###','####...###','##########']}
];
export const getLayout=id=>LAYOUTS.find(l=>l.id===id)??LAYOUTS[0];

// 2026-11-03 레퍼런스식 '동굴'(뉴 햄찌 광산 기본 맵, 검토용 값): 거의 다 바위인 작은 맵에서 시작해
// 이번 탐사에서 내려간 층(step)마다 조금씩 넓어진다. 10×17 격자 안에 맵을 놓고 바깥은 캘 수 없는 어둠이다.
// 처음 뚫린 곳은 맵 아래쪽 작은 공간(햄찌·수레·공 자리)뿐이고, 아래층 구멍은 맵 위쪽 바위 속에 묻힌다.
// 구멍은 이 층에서 바위를 holeNeed개 부숴야 캘 수 있다(레퍼런스의 X 블록 숫자).
// 기호: ' '=바깥 어둠, '#'=바위, '.'=처음 뚫린 바닥
// 기호 추가(2026-11-04): 'o'=구덩이(바깥 어둠과 같은 캘 수 없는 칸), '~'=물길(뚫린 바닥, 느려짐)
// rare: 깊이(지하 몇 층)에 따라 희귀 광석이 늘어난다(지하 1층 → 31층에서 최대). crates: 황금 해바라기씨 상자 개수 굴림.
export const CAVE={id:'cave',name:'동굴',sizes:[[6,8],[6,9],[7,10],[7,11],[8,12],[8,13],[8,14],[8,15]],pocket:[4,4],holeNeed:{base:5,perStep:2,max:20},
 hazards:{pit:.35,pitPerStep:.12,pitMax:.85,water:.4,waterPerStep:.1,waterMax:.85},
 rare:{start:.16,deep:.48,fullDepth:31},
 // n번째 상자가 나올 확률(앞 상자가 나와야 다음을 굴림). 깊을수록 오르고, 3개 이상이면 잭팟.
 crates:[[.5,.02,.92],[0,.03,.6],[0,.016,.4],[0,.009,.25]]};
export const MAPS=[{id:CAVE.id,name:CAVE.name},...LAYOUTS];
// ── 튜토리얼 전용 첫 층(프롤로그 뒤 첫 탐사의 지하 1층에만, 2026-11-10) ──
// 아래쪽 넓은 처음 공간(햄찌·수레·공) 위로 3칸 너비 통로가 곧게 뚫려 있고, 그 끝 바위가 구멍이다.
// 바위 3개만 깨면 구멍이 풀리고(holeNeed), 구멍 바위는 한 번에 깨진다. 공은 구멍 바로 아래 줄에 두어 위로 곧게 굴리면 들어간다.
// 상자·묻힌 도구 없음. 아래층부터는 보통 동굴.
export const TUTORIAL_CAVE=Object.freeze({
 rows:['          ','          ','          ','          ',
  '  #.#.##  ',
  '  #...##  ',
  '  #...##  ',
  '  #....#  ',
  '  #....#  ',
  '  #....#  ',
  '  #....#  ',
  '  ######  ',
  '          ','          ','          ','          ','          '],
 pocket:{x:3,y:7,w:4,h:4},hole:{x:4,y:4},map:{x:2,y:4,w:6,h:8},
 holeNeed:3,holeHits:1,noCrates:true,ballAt:{x:4.5,y:10.45},cartAt:{x:6.15,y:10.2}
});
export const holeNeedFor=step=>Math.min(CAVE.holeNeed.max,CAVE.holeNeed.base+CAVE.holeNeed.perStep*step);
export const rareShare=depth=>CAVE.rare.start+(CAVE.rare.deep-CAVE.rare.start)*Math.min(1,Math.max(0,(depth-1)/(CAVE.rare.fullDepth-1)));
// bonus: 마스터리 '황금 상자 확률'(%p를 모든 굴림에 더함)
export function crateCount(seed,depth,bonus=0){
 let n=0;for(const [base,per,max] of CAVE.crates){if(roll(seed,depth,90+n)<Math.min(max,base+per*(depth-1))+(base||per*(depth-1)>0?bonus:0))n++;else break;}
 return n;
}
// 물길: 걷는 햄찌는 이 배율로 느려지고, 공·수레는 추가로 감속한다
export const WATER={walk:.5,drag:3.2};
export const inWater=(s,x,y)=>!!s.cells[hitCell(x,y)]?.water;
// 처음 공간과 구멍이 구덩이에 막혀 끊기지 않았는지(구덩이·바깥 어둠만 막힘으로 본다)
function connected(grid,[ax,ay],[bx,by]){
 const seen=new Set([`${ax},${ay}`]),queue=[[ax,ay]];
 for(let i=0;i<queue.length;i++){const[x,y]=queue[i];if(x===bx&&y===by)return true;
  for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,v=grid[ny]?.[nx];if(v===undefined||v===' '||v==='o'||seen.has(`${nx},${ny}`))continue;seen.add(`${nx},${ny}`);queue.push([nx,ny]);}}
 return false;
}
const roll=(seed,step,k)=>{const v=Math.sin(seed*12.9898+step*78.233+k*37.719)*43758.5453;return v-Math.floor(v);};
export function caveLayout(seed=1,step=0){
 const [w,h]=CAVE.sizes[Math.min(Math.max(0,step),CAVE.sizes.length-1)],[pw,ph]=CAVE.pocket,r=k=>roll(seed,step,k);
 const x0=1+Math.floor(r(1)*(8-w+1)),y0=1+Math.round((15-h)/2),grid=Array.from({length:17},()=>Array(10).fill(' '));
 for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++)grid[y][x]='#';
 const px=x0+Math.floor((w-pw)/2),py=y0+h-ph,inPocket=(x,y)=>x>=px&&x<px+pw&&y>=py&&y<py+ph;
 // 테두리 모양: 모서리와 옆면 몇 칸을 깎아 층마다 다른 덩어리 모양을 만든다(처음 공간은 건드리지 않음).
 const corners=[[x0,y0,1],[x0+w-1,y0,-1],[x0,y0+h-1,1],[x0+w-1,y0+h-1,-1]];
 corners.forEach(([x,y,dx],i)=>{if(inPocket(x,y))return;if(r(10+i)>.4)grid[y][x]=' ';if(r(20+i)>.65&&!inPocket(x+dx,y))grid[y][x+dx]=' ';});
 for(let y=y0+1;y<y0+h-1;y++)for(const x of [x0,x0+w-1])if(!inPocket(x,y)&&r(40+y*2+(x===x0?0:1))>.82)grid[y][x]=' ';
 for(let y=py;y<py+ph;y++)for(let x=px;x<px+pw;x++)grid[y][x]='.';
 // 구멍: 맵 위쪽 두 줄의 바위 중 하나
 const top=[];for(let y=y0;y<=y0+1;y++)for(let x=x0;x<x0+w;x++)if(grid[y][x]==='#')top.push([x,y]);
 const [hx,hy]=top[Math.floor(r(60)*top.length)];
 // 방해 요소(구멍 줄과 처음 공간 사이의 안쪽 바위에만, 깊이 내려갈수록 자주):
 // 구덩이 'o' = 캘 수 없는 어둠 칸(돌아가야 함), 물길 '~' = 처음부터 뚫린 바닥이지만 걷기·공·수레가 느려짐
 const inner=[];for(let y=y0+2;y<py;y++)for(let x=x0+1;x<x0+w-1;x++)if(grid[y][x]==='#')inner.push([x,y]);
 const H=CAVE.hazards,pits=r(70)<Math.min(H.pitMax,H.pit+H.pitPerStep*step)?(r(71)<H.pitPerStep*step?2:1):0;
 for(let k=0;k<pits&&inner.length;k++){
  const [x,y]=inner[Math.floor(r(72+k)*inner.length)];if(grid[y][x]!=='#')continue;
  grid[y][x]='o';if(!connected(grid,[px,py],[hx,hy]))grid[y][x]='#';
 }
 if(inner.length&&r(80)<Math.min(H.waterMax,H.water+H.waterPerStep*step)){
  const [sx,sy]=inner[Math.floor(r(81)*inner.length)],len=2+Math.floor(r(82)*3),dir=r(83)<.5?1:-1;
  for(let i=0,x=sx;i<len;i++,x+=dir)if(grid[sy]?.[x]==='#'&&x>x0&&x<x0+w-1)grid[sy][x]='~';
 }
 return{rows:grid.map(row=>row.join('')),pocket:{x:px,y:py,w:pw,h:ph},hole:{x:hx,y:hy},map:{x:x0,y:y0,w,h}};
}
