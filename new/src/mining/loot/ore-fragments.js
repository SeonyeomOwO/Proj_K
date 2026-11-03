// Review-only loot art. Terrain inclusions and the live mining preview are untouched.
// Width is in logical game pixels. Three silhouettes avoid a field of identical icons.
import {MINERALS} from '../mineral-themes.js';
export const FRAGMENTS=[
 {id:'stone',name:'돌 조각',face:'#b9b1a4',light:'#e2dbc9',dark:'#8c8179',ink:'#635348',form:'rock'},
 {id:'copper',name:'기본 황금빛 광석',face:'#e3ad51',light:'#ffe29b',dark:'#ae7439',ink:'#765231',form:'rock',matrix:'#95928a'},
 {id:'jade',name:'기본 초록빛 광석',face:'#83bb92',light:'#cbdfad',dark:'#52846d',ink:'#4c6550',form:'rock'},
 ...Object.entries(MINERALS).map(([id,m])=>({id,name:m.name,face:m.colors[0],light:m.colors[1],dark:m.colors[2],ink:({quartz:'#5f707c',amethyst:'#59416c',pyrite:'#75532b',malachite:'#355943',azurite:'#354d70',fluorite:'#595572',rhodochrosite:'#7d485d',hematite:'#493e42',aquamarine:'#426773'})[id],form:m.shape}))
];
export const fragmentInfo=id=>FRAGMENTS.find(f=>f.id===id)??FRAGMENTS[0];
const SHAPES=[
 [[-29,-2],[-17,-22],[-2,-17],[12,-23],[28,3],[21,20],[-3,25],[-25,14]],
 [[-28,3],[-20,-15],[-3,-24],[10,-15],[24,-12],[29,8],[12,23],[-17,22]],
 [[-28,-6],[-12,-23],[10,-21],[28,-4],[23,17],[4,26],[-20,20],[-29,8]]
];
function path(c,p){c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}
function plane(c,p,color){path(c,p);c.fillStyle=color;c.fill();}
function stroke(c,p,color,width=2){c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
function pointsFor(info,variant){
 const p=SHAPES[((variant%3)+3)%3].map(v=>[...v]);
 if(info.form==='cube'){p[1]=[-20,-19];p[2]=[4,-24];p[3]=[22,-16];p[4]=[28,3];}
 if(info.form==='column'){for(const v of p){v[0]*=.87;v[1]*=1.04;}p[2][1]=-20;p[3][1]=-18;}
 if(info.form==='metal'){for(const v of p)v[1]*=.85;}
 return p;
}
export function drawFragment(c,id,x,y,width=22,{variant=0,angle=0,shadow=false,alpha=1,sx=1,sy=1}={}){
 const m=fragmentInfo(id),p=pointsFor(m,variant);
 c.save();c.globalAlpha*=alpha;c.translate(x,y);
 if(shadow){c.fillStyle='#35283a30';c.beginPath();c.ellipse(0,width*.34,width*.47,width*.13,0,0,Math.PI*2);c.fill();}
 c.rotate(angle);c.scale(width/60*sx,width/60*sy);c.lineJoin='round';
 path(c,p);c.fillStyle=m.face;c.fill();c.save();c.clip();
 const cut=[p[0],p[1],p[2],p[3],[5,1],[-10,5]];
 // Broad cut face, body, and a darker broken flank; no all-over shine/noise.
 plane(c,[p[3],p[4],p[5],p[6],[3,5],[5,1]],m.dark);
 plane(c,cut,m.light);
 plane(c,[p[0],[-10,5],[3,5],p[6],p[7]],m.face);
 if(m.matrix)plane(c,[[-30,11],[-14,8],[-6,15],[4,9],[13,15],[27,12],[25,30],[-30,30]],m.matrix);
 if(id==='hematite'){
  plane(c,[[-29,13],[-9,18],[4,13],[14,18],[24,15],[25,28],[-30,28]],'#9f6859');
  stroke(c,[[-16,-12],[-4,-16],[4,-12]],'#d3cfd1',3);
 }else if(id==='malachite'){
  c.save();path(c,cut);c.clip();for(let i=0;i<3;i++){c.beginPath();c.ellipse(-8,12,8+i*10,7+i*8,-.2,Math.PI,Math.PI*2);c.strokeStyle=i%2?m.dark:m.face;c.lineWidth=4;c.stroke();}c.restore();
 }else if(id==='rhodochrosite'){
  for(let i=0;i<2;i++){c.beginPath();c.moveTo(-32,-7+i*13);c.bezierCurveTo(-12,-15+i*13,0,13+i*13,32,-1+i*13);c.strokeStyle='#ffe7db';c.lineWidth=3;c.stroke();}
 }else if(id==='fluorite'){
  plane(c,[p[0],p[1],[-4,-21],[-2,1],[-10,5]],'#c5e5bb');plane(c,[p[0],[-10,5],[-5,24],p[7]],'#77b79f');
 }else if(id==='pyrite'){
  for(let i=0;i<3;i++)stroke(c,[[11+i*5,-5],[10+i*5,7+i*2]],'#8d672e',2);
 }else if(id==='quartz'||id==='amethyst'||id==='aquamarine'){
  plane(c,[p[1],p[2],[-1,-2],[-10,5]],m.light);
  stroke(c,[[-10,5],[-4,17]],m.light,1.8);
 }
 c.restore();
 path(c,p);c.strokeStyle=m.ink;c.lineWidth=4;c.stroke();
 // A short broken edge, deliberately simpler than a vein/crystal icon.
 stroke(c,[[p[1][0]+2,p[1][1]+3],[-7,-14],[2,-13]],m.light,2.2);
 c.restore();
}
export function fragmentResources(res,{variant=0,width=null,angle=0,alpha=1,unmirror=1}={}){return {...res,draw(c,id,x,y,w,h=w,options={}){if(id.startsWith('fragment:')){c.save();c.translate(x,y);c.scale(unmirror,1);drawFragment(c,id.slice(9),0,0,width??Math.min(w,h)*1.5,{variant,angle,alpha:(options.alpha??1)*alpha});c.restore();}else res.draw(c,id,x,y,w,h,options);}};}
