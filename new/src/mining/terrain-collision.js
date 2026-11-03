import {RISE} from './grid.js';
import {contours,waveContours,wavePoint} from './terrain-geometry.js';
const WIDTH=450,HEIGHT=800,BUCKET=32,cache=new WeakMap();
// Paint uses these four silhouettes. The soft shadow is intentionally not a
// wall. Only the bottom outline extends beyond its fill (4.5px stroke / 2).
export const TERRAIN_LAYERS=[{dy:0,rim:0},{dy:RISE-16,rim:0},{dy:RISE-7,rim:0},{dy:RISE,rim:2.25}];
function geometry(s){
 let g=cache.get(s);if(g?.revision===s.revision&&g?.navRevision===s.navRevision)return g;
 const base=waveContours(contours(s.cells)),segments=[],buckets=new Map(),occupied=new Uint8Array(WIDTH*HEIGHT);
 for(const {dy,rim}of TERRAIN_LAYERS){
  const loops=base.map(loop=>loop.map(([x,y])=>wavePoint(x,y+dy))),crossings=Array.from({length:HEIGHT},()=>[]);
  for(const loop of loops)for(let i=0;i<loop.length;i++){
   const a=loop[i],b=loop[(i+1)%loop.length],edge={ax:a[0],ay:a[1],bx:b[0],by:b[1],rim},id=segments.length;segments.push(edge);
   const minX=Math.floor((Math.min(a[0],b[0])-rim)/BUCKET),maxX=Math.floor((Math.max(a[0],b[0])+rim)/BUCKET);
   const minY=Math.floor((Math.min(a[1],b[1])-rim)/BUCKET),maxY=Math.floor((Math.max(a[1],b[1])+rim)/BUCKET);
   for(let row=minY;row<=maxY;row++)for(let col=minX;col<=maxX;col++){const key=`${col},${row}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(id);}
   if(a[1]===b[1])continue;
   const from=Math.max(0,Math.ceil(Math.min(a[1],b[1])-.5)),to=Math.min(HEIGHT-1,Math.ceil(Math.max(a[1],b[1])-.5)-1);
   for(let y=from;y<=to;y++)crossings[y].push(a[0]+(y+.5-a[1])*(b[0]-a[0])/(b[1]-a[1]));
  }
  // Even-odd fill matches the renderer, including islands and enclosed holes.
  for(let y=0;y<HEIGHT;y++){
   const xs=crossings[y].sort((a,b)=>a-b);
   for(let i=0;i+1<xs.length;i+=2){const left=Math.max(0,Math.ceil(xs[i]-.5)),right=Math.min(WIDTH,Math.ceil(xs[i+1]-.5));if(right>left)occupied.fill(1,y*WIDTH+left,y*WIDTH+right);}
  }
 }
 g={revision:s.revision,navRevision:s.navRevision,segments,buckets,occupied};cache.set(s,g);return g;
}
export function terrainContact(s,x,y,r=0){
 const g=geometry(s),inside=x>=0&&x<WIDTH&&y>=0&&y<HEIGHT&&g.occupied[Math.floor(y)*WIDTH+Math.floor(x)]!==0;
 let contact=null,deepest=-Infinity;const seen=new Set(),reach=r+2.25;
 for(let row=Math.floor((y-reach)/BUCKET);row<=Math.floor((y+reach)/BUCKET);row++)for(let col=Math.floor((x-reach)/BUCKET);col<=Math.floor((x+reach)/BUCKET);col++){
  for(const id of g.buckets.get(`${col},${row}`)??[]){if(seen.has(id))continue;seen.add(id);
   const e=g.segments[id],dx=e.bx-e.ax,dy=e.by-e.ay,len=dx*dx+dy*dy;
   const t=len?Math.max(0,Math.min(1,((x-e.ax)*dx+(y-e.ay)*dy)/len)):0;
   const px=e.ax+dx*t,py=e.ay+dy*t,d=Math.hypot(x-px,y-py),penetration=r+e.rim-d;
   if(penetration>deepest&&penetration>1e-6){deepest=penetration;contact={x:px,y:py,nx:(x-px)/(d||1),ny:(y-py)/(d||1),penetration,type:'terrain'};}
  }
 }
 return contact??(inside?{x,y,nx:0,ny:0,penetration:r+1,type:'terrain'}:null);
}
export function ballWorldContact(s,x,y,r){
 const bounds=[{gap:x-r,nx:1,ny:0},{gap:WIDTH-x-r,nx:-1,ny:0},{gap:y-r,nx:0,ny:1},{gap:HEIGHT-y-r,nx:0,ny:-1}];
 const bound=bounds.find(b=>b.gap<0);if(bound)return {...bound,x,y,penetration:-bound.gap,type:'boundary'};
 const wall=terrainContact(s,x,y,r);if(wall)return wall;
 const cart=s.cart,d=Math.hypot(x-cart.x,y-cart.y),gap=r+cart.radius;
 if(d<gap)return {x:cart.x,y:cart.y,nx:(x-cart.x)/(d||1),ny:(y-cart.y)/(d||1),penetration:gap-d,type:'cart'};
 return null;
}
export const ballPositionClear=(s,x,y,r=s.ball.radius)=>ballWorldContact(s,x,y,r)===null;
