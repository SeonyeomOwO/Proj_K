// Shared motion for art review and mined drops. Rewards belong to the mining model.
import {noise,ORIGIN,TILE,RISE,COLS,ROWS} from '../grid.js';
import {getTheme} from '../mineral-themes.js';
export const LOOT_WIDTH=[26,36];
const rnd=(seed,i,k)=>noise(i+seed*37,k,seed);
export function floorIsClear(s,x,y,r,{ignoreBall=false,ignoreCart=false}={}){
 if(x<r+5||x>445-r||y<r+5||y>795-r)return false;
 const margin=r+4,minX=Math.max(0,Math.floor((x-margin-ORIGIN)/TILE)),maxX=Math.min(COLS-1,Math.floor((x+margin-ORIGIN)/TILE));
 const minY=Math.max(0,Math.floor((y-margin-RISE-ORIGIN)/TILE)),maxY=Math.min(ROWS-1,Math.floor((y+margin-ORIGIN)/TILE));
 for(let row=minY;row<=maxY;row++)for(let col=minX;col<=maxX;col++){const cell=s.cells[row*COLS+col];if(!cell?.solid)continue;
  const left=ORIGIN+cell.x*TILE,top=ORIGIN+cell.y*TILE;
  const dx=x-Math.max(left,Math.min(left+TILE,x)),dy=y-Math.max(top,Math.min(top+TILE+RISE,y));
  if(dx*dx+dy*dy<(r+4)**2)return false;
 }
 const cart=s.cart??{x:150,y:653,radius:39},ball=s.ball??{x:238,y:696,radius:23};
 return (ignoreCart||Math.hypot(x-cart.x,y-cart.y)>r+cart.radius)&&(ignoreBall||Math.hypot(x-ball.x,y-ball.y)>r+ball.radius);
}
export function floorFragments(s,count=18,seed=1){
 const primary=getTheme(s.themeId).primary??'copper',out=[];
 // Clumps and gaps, with freely sampled coordinates rather than one item per cell.
 const anchors=[[151,426],[169,541],[300,581],[104,606],[270,625]];
 for(let i=0;i<count;i++){
  const width=LOOT_WIDTH[0]+rnd(seed,i,8)*(LOOT_WIDTH[1]-LOOT_WIDTH[0]),radius=width*.45;
  let pos=null;
  for(let j=0;j<2400;j++){
   const k=i*2400+j,a=anchors[Math.floor(rnd(seed,k,10)*anchors.length)],cluster=j%4!==0;
   const theta=rnd(seed,k,11)*Math.PI*2,dist=12+rnd(seed,k,12)*68;
   const x=cluster?a[0]+Math.cos(theta)*dist:65+rnd(seed,k,13)*310;
   const y=cluster?a[1]+Math.sin(theta)*dist:370+rnd(seed,k,14)*278;
   if(floorIsClear(s,x,y,radius)&&out.every(b=>Math.hypot(b.x-x,b.y-y)>b.radius+radius+1)){pos={x,y};break;}
  }
  if(!pos)throw Error('Cannot fit preview ore pieces: '+count);
  out.push({id:i,kind:i%6===0?'stone':s.themeId==='base'&&i%4===0?'jade':primary,...pos,width,radius,variant:Math.floor(rnd(seed,i,7)*3),angle:rnd(seed,i,6)*Math.PI*2,vx:0,vy:0,omega:0,z:0,vz:0,impact:0,friction:1.8+rnd(seed,i,5)*1.1});
 }
 return out;
}
export function createLootField(s,count=18,seed=1,{burst=false,still=false}={}){
 const bodies=floorFragments(s,count,seed);
 for(const [i,b]of bodies.entries()){
  if(still)continue;
  const angle=rnd(seed,i,21)*Math.PI*2,speed=30+rnd(seed,i,22)*55;
  b.vx=Math.cos(angle)*speed;b.vy=Math.sin(angle)*speed;b.omega=(rnd(seed,i,23)-.5)*8;
  b.z=3+rnd(seed,i,24)*12;b.vz=30+rnd(seed,i,25)*65;
 }
 if(burst){
  // The nearest five fragments come from one broken patch, the rest are settled.
  const launch=[...bodies].sort((a,b)=>Math.hypot(a.x-180,a.y-540)-Math.hypot(b.x-180,b.y-540)).slice(0,Math.min(5,count));
  for(const b of bodies){if(!launch.includes(b)){b.vx=b.vy=b.omega=b.z=b.vz=0;continue;}
   const a=Math.atan2(b.y-540,b.x-180)+(rnd(seed,b.id,26)-.5)*.8;
   const speed=100+rnd(seed,b.id,27)*85;b.vx=Math.cos(a)*speed;b.vy=Math.sin(a)*speed;
   b.vz=115+rnd(seed,b.id,28)*70;b.omega=(rnd(seed,b.id,29)-.5)*15;
  }
 }
 return {state:s,bodies,time:0,accumulator:0,seed};
}
function step(field,dt){
 for(const b of field.bodies){
  const nx=b.x+b.vx*dt,ny=b.y+b.vy*dt;
  if(floorIsClear(field.state,nx,b.y,b.radius))b.x=nx;else{b.vx*=-.42;b.omega*=-.6;}
  if(floorIsClear(field.state,b.x,ny,b.radius))b.y=ny;else{b.vy*=-.42;b.omega*=-.6;}
  b.z+=b.vz*dt;
  if(b.z>0||b.vz>0)b.vz-=540*dt;
  if(b.z<0){b.z=0;b.impact=Math.min(.075,Math.abs(b.vz)/1800);b.vz=Math.abs(b.vz)>38?-b.vz*.27:0;}
  const drag=Math.exp(-(b.z>1?.65:b.friction)*dt);b.vx*=drag;b.vy*=drag;
  b.angle+=b.omega*dt;b.omega*=Math.exp(-(b.z>1?.5:b.friction*.95)*dt);b.impact*=Math.exp(-18*dt);
  if(Math.hypot(b.vx,b.vy)<.65)b.vx=b.vy=0;if(Math.abs(b.omega)<.015)b.omega=0;
 }
 for(let pass=0;pass<2;pass++)for(let i=0;i<field.bodies.length;i++)for(let j=i+1;j<field.bodies.length;j++){
  const a=field.bodies[i],b=field.bodies[j];if(Math.abs(a.z-b.z)>22)continue;
  let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),min=a.radius+b.radius;if(d>=min)continue;
  if(d<.001){dx=1;dy=0;d=1;}const nx=dx/d,ny=dy/d,over=(min-d)/2+.02;
  const ax=a.x-nx*over,ay=a.y-ny*over,bx=b.x+nx*over,by=b.y+ny*over;
  if(floorIsClear(field.state,ax,ay,a.radius)){a.x=ax;a.y=ay;}
  if(floorIsClear(field.state,bx,by,b.radius)){b.x=bx;b.y=by;}
  const relative=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
  if(relative<0){const impulse=-relative*.64;a.vx-=nx*impulse;a.vy-=ny*impulse;b.vx+=nx*impulse;b.vy+=ny*impulse;a.omega+=ny*impulse*.014;b.omega-=nx*impulse*.014;}
 }
 field.time+=dt;
}
export function updateLootField(field,dt){
 field.accumulator+=Math.max(0,Math.min(.1,dt));
 while(field.accumulator>=1/120-1e-10){step(field,1/120);field.accumulator-=1/120;}
}
export function settledLoot(s,count=18,seed=1){const field=createLootField(s,count,seed);for(let i=0;i<360;i++)updateLootField(field,1/60);return field;}
