// ── 황금 기운 연출(2026-11-10) ──
// 도구 놀이터에서 황금 해바라기씨로 배운 단계 합이 '황금 기운'(s.glory, game-state.js startMining)이다.
// 단계(tier 0~5)가 오를수록 광산이 눈에 띄게 화려해진다:
//  1 햄찌 발밑 금빛 고리 + 몸 둘레 금빛 + 반짝이 · 던진 햄찌 금빛 꼬리 · 곡괭이 금 불꽃
//  2 빛이 더 진하고 커짐 · 바위가 깨지면 금 조각이 튐
//  3 머리 위를 도는 별 고리 · 착지 금먼지 · 부딪히면 화면이 쿵
//  4 발밑에서 금빛 불꽃이 일렁 · 화면 가장자리 금빛
//  5 무지개 반짝이 · 빛기둥
// 게임 규칙에는 쓰지 않는다(연출만). reducedMotion이면 움직임 없이 은은한 빛만 남긴다.
import {star} from './animation/juice.js';
import {ACTOR_SIZE,FOOT_OFFSET} from './mining-contact.js';
const GOLD='#ffd65a',PALE='#fff3b0',INK='#a8701c';
const RAINBOW=['#ff9fb2','#ffd65a','#9be38a','#8fd3ff','#c9a2ff'];
export const gloryTier=s=>s.glory?.tier??0;
const bodyY=h=>h.y+FOOT_OFFSET-38*ACTOR_SIZE;
const sparkle=(c,x,y,r,color,a=1)=>{c.save();c.globalAlpha*=a;c.fillStyle=color;c.beginPath();for(let i=0;i<8;i++){const q=i*Math.PI/4,d=i%2?r*.28:r;c.lineTo(x+Math.cos(q)*d,y+Math.sin(q)*d);}c.closePath();c.fill();c.restore();};

// 햄찌 뒤(몸보다 먼저 그림): 발밑 빛 · 몸 둘레 기운 · 별 고리 · 금빛 불꽃 · 빛기둥
export function gloryAura(c,s,h,i,still){
 const t=gloryTier(s);if(!t)return;
 const x=h.x,fy=h.y+FOOT_OFFSET,by=bodyY(h),time=still?0:s.time+i*.77,pulse=.5+.5*Math.sin(time*3.2);
 c.save();c.globalCompositeOperation='lighter';
 // 발밑 금빛 웅덩이
 const gr=18+t*3+pulse*4,g=c.createRadialGradient(x,fy-2,1,x,fy-2,gr);g.addColorStop(0,`rgba(255,214,90,${.5+t*.07})`);g.addColorStop(.6,`rgba(255,200,70,${.18+t*.04})`);g.addColorStop(1,'rgba(255,214,90,0)');
 c.fillStyle=g;c.beginPath();c.ellipse(x,fy-2,gr,gr*.45,0,0,Math.PI*2);c.fill();
 // 몸 둘레 기운(단계마다 진하고 크게)
 {const r=21+t*3+pulse*3,b=c.createRadialGradient(x,by,4,x,by,r);b.addColorStop(0,`rgba(255,226,130,${.16+t*.05})`);b.addColorStop(1,'rgba(255,200,80,0)');c.fillStyle=b;c.beginPath();c.arc(x,by,r,0,Math.PI*2);c.fill();}
 // 발밑 금빛 고리(숨 쉬듯 커졌다 작아짐)
 c.globalAlpha=.35+pulse*.35;c.strokeStyle=GOLD;c.lineWidth=1.6+t*.3;c.beginPath();c.ellipse(x,fy-2,12+t*1.5+pulse*3,4.5+t*.5+pulse,0,0,Math.PI*2);c.stroke();c.globalAlpha=1;
 // 빛기둥(최고 단계)
 if(t>=5){const w=13+pulse*4,p=c.createLinearGradient(x,fy,x,fy-110);p.addColorStop(0,'rgba(255,236,160,.22)');p.addColorStop(1,'rgba(255,236,160,0)');c.fillStyle=p;c.beginPath();c.moveTo(x-w,fy);c.lineTo(x-w*.4,fy-110);c.lineTo(x+w*.4,fy-110);c.lineTo(x+w,fy);c.closePath();c.fill();}
 // 발밑에서 일렁이는 금빛 불꽃
 if(t>=4&&!still)for(let j=0;j<5;j++){const k=(time*1.6+j*.2)%1,fx=x+(j-2)*6+Math.sin(time*5+j)*2,hgt=(10+t*2)*(1-k*.3),yy=fy-3-k*16;
  c.globalAlpha=(1-k)*.55;c.fillStyle=j%2?'#ffb347':GOLD;c.beginPath();c.moveTo(fx-3.5,yy);c.quadraticCurveTo(fx-4,yy-hgt*.5,fx,yy-hgt);c.quadraticCurveTo(fx+4,yy-hgt*.5,fx+3.5,yy);c.closePath();c.fill();}
 c.globalAlpha=1;c.globalCompositeOperation='source-over';
 // 위로 떠오르는 반짝이(단계가 높을수록 많고, 5단계는 무지개)
 if(!still){const n=1+t*2;for(let j=0;j<n;j++){const k=(time*.7+j/n)%1,ang=j*2.4,sx=x+Math.cos(ang+time*.5)*(12+t*1.5),sy=fy-6-k*(34+t*6);
  sparkle(c,sx,sy,(1.6+t*.45)*(1-k*.4),t>=5?RAINBOW[j%RAINBOW.length]:j%3?GOLD:PALE,Math.sin(k*Math.PI)*.95);}}
 c.restore();
}
// 햄찌 앞(몸 다음에 그림): 머리 위를 도는 별 고리
export function gloryHalo(c,s,h,i,still){
 const t=gloryTier(s);if(t<3)return;
 const x=h.x,y=bodyY(h)-22,time=still?0:s.time*2.2+i,n=t>=5?5:t;
 c.save();c.globalAlpha=.9;c.strokeStyle='rgba(255,230,140,.55)';c.lineWidth=1.4;c.beginPath();c.ellipse(x,y,15,4.5,0,0,Math.PI*2);c.stroke();
 for(let j=0;j<n;j++){const a=time+j*Math.PI*2/n;star(c,x+Math.cos(a)*15,y+Math.sin(a)*4.5,3+(t>=5?.8:0),t>=5?RAINBOW[j%RAINBOW.length]:GOLD,INK);}
 c.restore();
}

// 던진 햄찌·수레의 금빛 꼬리: 지나온 자리를 잠깐 기억해 가늘어지는 혜성 꼬리로 그린다
const trails=new Map();
export function gloryTrail(c,s,key,x,y,flying,still){
 const t=gloryTier(s);let list=trails.get(key);
 if(!t||still||!flying){if(list)trails.delete(key);return;}
 if(!list||list.at(-1)?.t>s.time)trails.set(key,list=[]);
 if(!list.length||list.at(-1).t<s.time)list.push({x,y,t:s.time});
 const keep=.1+t*.05;while(list.length&&s.time-list[0].t>keep)list.shift();
 if(list.length<2)return;
 c.save();c.lineCap='round';c.globalCompositeOperation='lighter';
 for(let k=1;k<list.length;k++){const a=list[k-1],b=list[k],u=1-(s.time-b.t)/keep;
  c.globalAlpha=u*.75;c.strokeStyle=t>=5?RAINBOW[k%RAINBOW.length]:k%2?GOLD:'#ffb347';c.lineWidth=(3+t*2.2)*u;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();}
 c.globalCompositeOperation='source-over';
 // 꼬리에서 떨어지는 반짝이
 for(let k=0;k<list.length;k+=2){const p=list[k],u=1-(s.time-p.t)/keep;sparkle(c,p.x+Math.sin(p.t*91)*6,p.y+Math.cos(p.t*77)*6+(1-u)*8,2+t*.5,t>=5?RAINBOW[k%RAINBOW.length]:PALE,u);}
 c.restore();
}

// 사건 연출: 곡괭이 금 불꽃 · 던진 햄찌가 쾅(slam) · 바위가 깨질 때 금 조각 · 반짝 일격 · 착지 금먼지
export function gloryEvent(c,s,e,still){
 const t=gloryTier(s),age=s.time-e.time;if(age<0)return;
 if(e.type==='slam'){
  // 던진 햄찌가 바위를 쾅: 단계가 없어도 기본 충격, 단계마다 고리·별·빛이 커진다
  const L=.42+t*.04;if(age>=L)return;const k=age/L,e3=1-(1-k)**3,R=18+t*8;
  c.save();c.globalAlpha=(1-k);
  if(age<.08){c.globalCompositeOperation='lighter';const f=c.createRadialGradient(e.x,e.y,2,e.x,e.y,R*1.6);f.addColorStop(0,'rgba(255,248,210,.95)');f.addColorStop(1,'rgba(255,214,90,0)');c.fillStyle=f;c.beginPath();c.arc(e.x,e.y,R*1.6,0,Math.PI*2);c.fill();c.globalCompositeOperation='source-over';}
  c.strokeStyle=t?GOLD:PALE;c.lineWidth=(3+t)*(1-k)+1;c.beginPath();c.ellipse(e.x,e.y+6,8+e3*R*2.2,5+e3*R*1.1,0,0,Math.PI*2);c.stroke();
  if(t>=2){c.lineWidth=2*(1-k);c.beginPath();c.ellipse(e.x,e.y+6,4+e3*R*1.4,3+e3*R*.7,0,0,Math.PI*2);c.stroke();}
  // 사방으로 뻗는 빛줄기
  const n=6+t*2;c.strokeStyle=PALE;c.lineCap='round';for(let j=0;j<n;j++){const a=j/n*Math.PI*2+e.x,r0=6+e3*R*.6,r1=r0+(8+t*3)*(1-k);c.lineWidth=2.2*(1-k)+.4;c.beginPath();c.moveTo(e.x+Math.cos(a)*r0,e.y+Math.sin(a)*r0*.7);c.lineTo(e.x+Math.cos(a)*r1,e.y+Math.sin(a)*r1*.7);c.stroke();}
  if(t>=1)for(let j=0;j<3+t;j++){const a=j/(3+t)*Math.PI*2+.4,d=10+e3*R*1.3;star(c,e.x+Math.cos(a)*d,e.y+Math.sin(a)*d*.7-e3*10,(3.5+t*.6)*(1-k*.5),t>=5?RAINBOW[j%RAINBOW.length]:GOLD,INK);}
  c.restore();return;
 }
 if(!t)return;
 if(e.type==='hit'&&e.worker!=null&&!still){
  // 곡괭이가 닿을 때 금 불꽃이 튄다(단계마다 더 많이·멀리)
  if(age>=.28)return;const k=age/.28,n=1+t*2;c.save();c.globalCompositeOperation='lighter';c.lineCap='round';
  for(let j=0;j<n;j++){const a=-Math.PI/2+((j+.5)/n-.5)*Math.PI*1.5+Math.sin(e.time*53+j)*.3,v=22+t*7+(j%3)*6,d=v*k,px=e.x+Math.cos(a)*d,py=e.y+Math.sin(a)*d+30*k*k;
   c.globalAlpha=1-k;c.strokeStyle=j%2?GOLD:'#ffb347';c.lineWidth=2.2-k;c.beginPath();c.moveTo(px,py);c.lineTo(px-Math.cos(a)*(5+t),py-Math.sin(a)*(5+t));c.stroke();}
  c.restore();
  if(e.crit&&age<.45){const q=age/.45;c.save();c.globalAlpha=1-q;c.font=`900 ${13+t*2}px Game,sans-serif`;c.textAlign='center';c.lineJoin='round';c.lineWidth=3.5;c.strokeStyle='#7a4a12';const y=e.y-20-q*22;c.strokeText('반짝!',e.x,y);c.fillStyle=PALE;c.fillText('반짝!',e.x,y);c.restore();}
  return;
 }
 if(e.type==='break'&&t>=2&&!still){
  // 깨진 바위에서 금 조각이 포물선을 그리며 튄다
  if(age>=.6)return;const k=age/.6,n=2+t*2;c.save();
  for(let j=0;j<n;j++){const a=-Math.PI*(.1+.8*(j+.5)/n),v=60+(j%3)*25+t*8,px=e.x+Math.cos(a)*v*age,py=e.y+Math.sin(a)*v*age+180*age*age;
   c.globalAlpha=1-k*k;c.save();c.translate(px,py);c.rotate(age*12+j);c.fillStyle=t>=5?RAINBOW[j%RAINBOW.length]:j%2?GOLD:'#ffe9a0';c.strokeStyle=INK;c.lineWidth=1;c.beginPath();c.moveTo(0,-4);c.lineTo(3,0);c.lineTo(0,4);c.lineTo(-3,0);c.closePath();c.fill();c.stroke();c.restore();}
  if(age<.2){c.globalAlpha=(1-age/.2)*.8;c.strokeStyle=GOLD;c.lineWidth=3;c.beginPath();c.ellipse(e.x,e.y,10+age*170,7+age*100,0,0,Math.PI*2);c.stroke();}
  c.restore();return;
 }
 if(e.type==='land'&&t>=3&&!still){
  if(age>=.35)return;const k=age/.35;c.save();c.globalAlpha=(1-k)*.85;
  for(let j=0;j<6;j++){const a=j/6*Math.PI*2,d=8+k*30;sparkle(c,e.x+Math.cos(a)*d,e.y+4+Math.sin(a)*d*.4-k*8,3*(1-k*.5),GOLD);}
  c.restore();return;
 }
 if(e.type==='floor'&&!still){
  // 새 층에 내려서면 햄찌들 둘레로 금빛 고리가 퍼진다(힘이 차오르는 느낌)
  if(age>=.8)return;const k=age/.8;c.save();c.globalAlpha=(1-k)*.8;c.strokeStyle=GOLD;c.lineWidth=3*(1-k)+1;
  for(const h of s.crew){c.beginPath();c.ellipse(h.x,h.y+FOOT_OFFSET-2,10+k*34,4+k*13,0,0,Math.PI*2);c.stroke();}
  c.restore();
 }
}
// 던진 햄찌가 세게 부딪히면 화면이 쿵(3단계부터, 단계마다 조금 더)
export function gloryShake(s,still){
 const t=gloryTier(s);if(t<3||still)return{x:0,y:0};
 let a=0;for(const e of s.events??[])if(e.type==='slam'){const age=s.time-e.time;if(age>=0&&age<.22)a=Math.max(a,(1+t*.8)*(1-age/.22));}
 return a?{x:Math.sin(s.time*97)*a,y:Math.cos(s.time*83)*a*.7}:{x:0,y:0};
}
// 4단계부터 화면 가장자리가 은은한 금빛으로 숨 쉰다
export function gloryVignette(c,s,still){
 const t=gloryTier(s);if(t<4)return;
 const p=still?.5:.5+.5*Math.sin(s.time*1.6),a=(t>=5?.2:.13)+p*.06,g=c.createRadialGradient(225,400,260,225,400,520);
 g.addColorStop(0,'rgba(255,214,90,0)');g.addColorStop(1,`rgba(255,200,70,${a})`);
 c.save();c.globalCompositeOperation='lighter';c.fillStyle=g;c.fillRect(0,0,450,800);c.restore();
}
