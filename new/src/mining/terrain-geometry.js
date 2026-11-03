// Exact shared outlines for painting and ball collision. Preserve the approved art.
import {COLS,ROWS,TILE,ORIGIN,key} from './grid.js';

// Clockwise cell edges keep solid ground on the right. Prefer a right turn at
// diagonal contacts, so disconnected islands and interior holes form separate loops.
export function boundaryEdges(cells){const edges=[];for(const cell of cells){if(!cell.solid)continue;const{x,y}=cell,solid=(a,b)=>!!cells[key(a,b)]?.solid&&a>=0&&a<COLS&&b>=0&&b<ROWS;
 if(!solid(x,y-1))edges.push([[x,y],[x+1,y]]);if(!solid(x+1,y))edges.push([[x+1,y],[x+1,y+1]]);if(!solid(x,y+1))edges.push([[x+1,y+1],[x,y+1]]);if(!solid(x-1,y))edges.push([[x,y+1],[x,y]]);
 }return edges;}
export function contours(cells){
 const es=boundaryEdges(cells),used=new Set(),loops=[],eq=(a,b)=>a[0]===b[0]&&a[1]===b[1];
 for(let i=0;i<es.length;i++){if(used.has(i))continue;let at=i;const points=[es[i][0]];
  for(let guard=0;guard<=es.length;guard++){used.add(at);const[a,b]=es[at];if(eq(b,points[0]))break;points.push(b);let candidates=[];es.forEach((e,j)=>{if(!used.has(j)&&eq(e[0],b))candidates.push(j);});
   const dx=b[0]-a[0],dy=b[1]-a[1];candidates.sort((i,j)=>{const score=k=>{const[e,f]=es[k],nx=f[0]-e[0],ny=f[1]-e[1],cross=dx*ny-dy*nx,dot=dx*nx+dy*ny;return cross>0?3:dot>0?2:cross<0?1:0;};return score(j)-score(i);});
   if(!candidates.length)throw Error('Unclosed terrain contour');at=candidates[0];
  }loops.push(points);
 }return loops;
}

const TAU=Math.PI*2;
export function wavePoint(x,y){return [x+3.1*Math.sin(y/51*TAU+.5)+.9*Math.sin(y/133*TAU),y+3.2*Math.sin(x/53*TAU+.2)+Math.sin(x/137*TAU)];}
export function waveContours(loops){
 return loops.map(loop=>{
  const points=loop.map(([x,y])=>[ORIGIN+x*TILE,ORIGIN+y*TILE]),out=[];
  const bends=points.map((p,i)=>{const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length],r=10,la=Math.hypot(a[0]-p[0],a[1]-p[1]),lb=Math.hypot(b[0]-p[0],b[1]-p[1]);return{p,in:[p[0]+(a[0]-p[0])/la*r,p[1]+(a[1]-p[1])/la*r],out:[p[0]+(b[0]-p[0])/lb*r,p[1]+(b[1]-p[1])/lb*r]};});
  for(let i=0;i<bends.length;i++){
   const b=bends[i],next=bends[(i+1)%bends.length];
   for(let n=0;n<8;n++){const t=n/8,u=1-t;out.push([u*u*b.in[0]+2*u*t*b.p[0]+t*t*b.out[0],u*u*b.in[1]+2*u*t*b.p[1]+t*t*b.out[1]]);}
   const steps=Math.ceil(Math.hypot(next.in[0]-b.out[0],next.in[1]-b.out[1])/3);
   for(let n=0;n<steps;n++){const t=n/steps;out.push([b.out[0]+(next.in[0]-b.out[0])*t,b.out[1]+(next.in[1]-b.out[1])*t]);}
  }return out;
 });
}
// Apply depth before the world warp. Otherwise stacked vertical edges become
// alternating protruding slivers instead of a single continuous cliff outline.
export function traceWave(c,loops,dy=0){c.beginPath();for(const pts of loops){pts.forEach(([x,y],i)=>{const[a,b]=wavePoint(x,y+dy);i?c.lineTo(a,b):c.moveTo(a,b);});c.closePath();}}
