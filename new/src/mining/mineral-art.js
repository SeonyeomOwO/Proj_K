import {getMineral} from './mineral-themes.js';
const TAU=Math.PI*2;
function poly(c,p,fill,stroke=null,w=1.2){c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=w;c.lineJoin='round';c.stroke();}}
function oval(c,x,y,rx,ry,fill){c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=fill;c.fill();}
function stroke(c,p,color,w=1){c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=w;c.lineCap='round';c.stroke();}
function prism(c,x,y,r,col,ink,flat=false){
 c.save();c.translate(x,y);
 if(flat){
  const p=[[-.5,-.65],[-.35,-.85],[.15,-1],[.52,-.65],[.52,.65],[0,.93],[-.5,.65]].map(([x,y])=>[x*r,y*r]);
  poly(c,p,col[0],ink,1.25);poly(c,[p[2],p[3],p[4],p[5],[0,-r*.7]],col[2]);poly(c,[p[0],p[1],p[2],[0,-r*.7]],col[1]);
 }else{
  const p=[[-.5,-.55],[0,-1.8],[.5,-.55],[.5,.65],[0,.93],[-.5,.65]].map(([x,y])=>[x*r,y*r]);
  poly(c,p,col[0],ink,1.25);poly(c,[p[1],p[2],p[3],p[4],[0,-r*.5]],col[2]);poly(c,[p[0],p[1],[0,-r*.5]],col[1]);
 }
 stroke(c,[[0,-r*.5],[0,r*.77]],col[1],1);c.restore();
}
function cube(c,x,y,r,col,ink,striated=false){
 const t=[x,y-r],l=[x-r,y-r*.45],m=[x,y+r*.15],right=[x+r,y-r*.45],bottom=[x,y+r*.95];
 poly(c,[l,t,right,m],col[1],ink,1.1);poly(c,[l,m,bottom,[x-r,y+r*.36]],col[0],ink,1.1);poly(c,[m,right,[x+r,y+r*.36],bottom],col[2],ink,1.1);
 if(striated)for(let i=1;i<4;i++)stroke(c,[[x-r+i*r*.22,y-r*.25+i*r*.12],[x-r+i*r*.22,y+r*.22+i*r*.12]],ink+'88',.7);
}
export function drawMineral(c,id,x,y,size=12,variant=0){
 const mineral=getMineral(id);if(!mineral)return false;
 c.save();c.translate(x,y);c.scale(size/12,size/12);c.rotate((variant%3-1)*.12);
 let col=mineral.colors;const ink=mineral.ink;
 if(id==='fluorite'&&variant%2)col=['#87c9b0','#d5efbc','#5e9d94'];
 switch(mineral.shape){
  case 'point':
   c.save();c.rotate(-.32);prism(c,-6,3,5.4,col,ink);c.restore();c.save();c.rotate(.36);prism(c,5,3,4.8,col,ink);c.restore();prism(c,0,0,7.3,col,ink);break;
  case 'column':
   c.save();c.rotate(-.23);prism(c,-6,3,5.1,col,ink,true);c.restore();prism(c,3,-1,7.6,col,ink,true);break;
  case 'cube':
   cube(c,-6,3,5,col,ink,id==='pyrite');cube(c,3,-2,9,col,ink,id==='pyrite');
   if(id==='fluorite')poly(c,[[3,-8],[8,-5],[3,-2],[-2,-5]],variant%2?'#add3b6':'#bcb8dc',null);break;
  case 'banded':
   oval(c,-5,3,8,7,col[2]);oval(c,4,-1,11,9,col[0]);c.save();c.beginPath();c.ellipse(4,-1,10,8,0,0,TAU);c.clip();
   for(let i=0;i<4;i++){c.beginPath();c.ellipse(0,4,4+i*4,3+i*3,0,0,TAU);c.strokeStyle=i%2?col[2]:col[1];c.lineWidth=2;c.stroke();}c.restore();break;
  case 'roseband':
   c.beginPath();c.ellipse(0,0,13,9,-.2,0,TAU);c.fillStyle=col[0];c.fill();c.strokeStyle=ink;c.lineWidth=1.2;c.stroke();c.save();c.clip();
   for(let i=-1;i<3;i++){c.beginPath();c.moveTo(-15,-6+i*6);c.bezierCurveTo(-7,-12+i*6,3,5+i*6,15,-4+i*6);c.strokeStyle=i%2?col[1]:col[2];c.lineWidth=i%2?2.2:2;c.stroke();}c.restore();break;
  case 'rosette':
   // Irregular blue aggregate, not a five-point fantasy star.
   poly(c,[[-12,5],[-12,-2],[-6,-7],[0,-2],[-2,9]],col[0],ink,1.2);poly(c,[[-12,-2],[-6,-7],[-5,1]],col[1]);
   poly(c,[[-4,8],[-4,-6],[2,-12],[8,-5],[8,7]],col[2],ink,1.2);poly(c,[[-4,-6],[2,-12],[2,0]],col[1]);poly(c,[[2,0],[8,-5],[8,7],[1,10]],col[0]);
   poly(c,[[5,8],[7,-1],[13,-4],[15,4],[11,10]],col[0],ink,1.1);poly(c,[[7,-1],[13,-4],[11,3]],col[1]);break;
  case 'metal':
   for(const[dx,dy,r]of[[-6,3,7],[5,3,7],[0,-3,8]]){oval(c,dx,dy,r,r*.75,col[2]);oval(c,dx,dy-1,r*.9,r*.63,col[0]);stroke(c,[[dx-r*.4,dy-2],[dx+r*.2,dy-4]],col[1],1.6);}break;
 }c.restore();return true;
}

// A wrapper lets the original hamster carry the new mineral in its existing paws.
const wrapped=new WeakMap();
export function mineralResources(res){
 if(wrapped.has(res))return wrapped.get(res);
 const value={...res,draw(c,id,x,y,w,h=w,options={}){if(id.startsWith('mineral:')){c.save();c.globalAlpha*=options.alpha??1;drawMineral(c,id.slice(8),x,y,Math.min(w,h)*.42);c.restore();}else res.draw(c,id,x,y,w,h,options);}};
 wrapped.set(res,value);return value;
}
