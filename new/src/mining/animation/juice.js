// 디즈니식 과장 연출 도구(마을·광산 공용).
// 예비 동작(움츠림·떨림) → 늘임(가는 방향으로 쭉) → 행 타임(꼭대기에서 둥실) → 쿵·통·출렁 착지 → 어질어질 별.
export const clamp01=k=>Math.max(0,Math.min(1,k));
// 꼭대기에서 느려지는 시간 왜곡(0→1): 처음과 끝은 빠르고 가운데에서 둥실 머문다
export const hang=u=>{const d=1-2*clamp01(u);return .5-.5*Math.sign(d)*Math.abs(d)**1.5;};
// from→to 포물선(높이 h): 땅 위치·떠오른 높이·지금 화면 진행 방향(a)과 빠르기(sp, u .02당 px)
export const arc=(from,to,u,h)=>{const at=v=>{const k=hang(v);return[from.x+(to.x-from.x)*k,from.y+(to.y-from.y)*k,4*h*k*(1-k),k];};
 const [x,y,lift,k]=at(u),[x2,y2,l2]=at(Math.min(1,u+.02));return{x,y,lift,k,a:Math.atan2((y2-l2)-(y-lift),x2-x),sp:Math.hypot(x2-x,(y2-l2)-(y-lift))};};
// 착지: 쿵 눌렸다(0~.1) → 통 튀어 오르고(.1~.4) → 출렁이며 멈춘다(.4~.75). dur로 전체 길이를, amp로 세기를 바꾼다.
// st<0 = 세로로 납작, st>0 = 세로로 길쭉. lift = 통 튀어 오른 높이(px).
export const landing=(age,dur=.75,amp=1)=>{const a=age*.75/dur;if(a<0||a>=.75)return{lift:0,st:0};
 if(a<.1)return{lift:0,st:-.45*amp*Math.sin(a/.1*Math.PI)};
 if(a<.4){const k=(a-.1)/.3;return{lift:Math.sin(k*Math.PI)*24*amp,st:.2*amp*Math.abs(Math.cos(k*Math.PI))};}
 const k=(a-.4)/.35;return{lift:0,st:-.3*amp*Math.cos(k*Math.PI*3)*(1-k)**2};};
// 부딪힘 출렁: 부딪힌 순간 납작(-amp) → 늘었다 줄었다 잦아든다
export const bump=(age,amp=.36,dur=.4)=>age<0||age>=dur?0:-amp*Math.exp(-age*8)*Math.cos(age*30);
// 젤리 변형: 점(x,y)을 축으로 a 방향으로 1+st배 늘이고 직각으로는 줄인다(st<0이면 그 방향으로 납작)
export const jelly=(c,x,y,a,st)=>{c.translate(x,y);c.rotate(a);c.scale(1+st,1-st*.6);c.rotate(-a);c.translate(-x,-y);};
// 작은 별(어질어질·반짝)
export const star=(c,x,y,r,fill,stroke)=>{c.beginPath();for(let j=0;j<10;j++){const rr=j%2?r*.45:r,a=-Math.PI/2+j*Math.PI/5;c.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1.4;c.stroke();}};
// 어질어질: 머리 위로 별 세 개가 빙글빙글(alpha로 나타나고 사라짐)
export const dizzy=(c,x,y,time,alpha=1,r=22,size=7.5,ink='#4a3122')=>{if(alpha<=0)return;c.save();c.globalAlpha*=alpha;for(let j=0;j<3;j++){const a=time*7+j*Math.PI*2/3;star(c,x+Math.cos(a)*r,y+Math.sin(a)*r*.32,size,'#ffe27a',ink);}c.restore();};
// 부들부들: 당기는 세기(0~1)만큼 좌우·위아래로 떤다
export const tremble=(time,amount)=>({x:Math.sin(time*95)*(.6+2.4*amount),y:-Math.abs(Math.cos(time*83))*(.6+2.4*amount)*.6});
