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
export const CAVE={id:'cave',name:'동굴',sizes:[[6,8],[6,9],[7,10],[7,11],[8,12],[8,13],[8,14],[8,15]],pocket:[4,4],holeNeed:{base:5,perStep:2,max:20}};
export const MAPS=[{id:CAVE.id,name:CAVE.name},...LAYOUTS];
export const holeNeedFor=step=>Math.min(CAVE.holeNeed.max,CAVE.holeNeed.base+CAVE.holeNeed.perStep*step);
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
 return{rows:grid.map(row=>row.join('')),pocket:{x:px,y:py,w:pw,h:ph},hole:{x:hx,y:hy},map:{x:x0,y:y0,w,h}};
}
