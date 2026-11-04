// 층 도구·대장 왕관 그림(그림 파일 없이 캔버스로 그리는 1차 시안). 마을 원화처럼 진한 테두리 + 단색 면.
const INK='#5a3b26';
function outline(c,w=1.6){c.lineJoin='round';c.lineCap='round';c.strokeStyle=INK;c.lineWidth=w;c.fill();c.stroke();}
// size: 대략 지름(px)
export function drawToolIcon(c,type,x,y,size=22,time=0){
 const k=size/22;c.save();c.translate(x,y);c.scale(k,k);
 if(type==='flag'){
  c.beginPath();c.moveTo(-1,10);c.lineTo(-1,-14);c.strokeStyle=INK;c.lineWidth=2.4;c.stroke();
  const wave=Math.sin(time*5)*1.5;c.fillStyle='#f6c945';c.beginPath();c.moveTo(0,-14);c.quadraticCurveTo(7,-16+wave,13,-12);c.quadraticCurveTo(8,-8-wave,13,-4);c.quadraticCurveTo(6,-6+wave,0,-5);c.closePath();outline(c);
  c.fillStyle='#8a5a2b';c.beginPath();c.arc(6.5,-9.5,2.4,0,Math.PI*2);c.fill();
  c.fillStyle='#d9b07a';c.beginPath();c.ellipse(-1,10,5,2,0,0,Math.PI*2);outline(c,1.2);
 }else if(type==='bomb'){
  c.fillStyle='#4a3a35';c.beginPath();c.arc(0,2,9,0,Math.PI*2);outline(c);
  c.fillStyle='#f6c945';for(let i=0;i<6;i++){const a=i*Math.PI/3;c.beginPath();c.ellipse(Math.cos(a)*4,2+Math.sin(a)*4,2.6,1.4,a,0,Math.PI*2);c.fill();}
  c.fillStyle='#7a4a24';c.beginPath();c.arc(0,2,2.2,0,Math.PI*2);c.fill();
  c.beginPath();c.moveTo(3,-6);c.quadraticCurveTo(7,-12,10,-10);c.strokeStyle=INK;c.lineWidth=1.6;c.stroke();
  c.fillStyle=Math.sin(time*14)>0?'#ffdd55':'#ff8a3d';c.beginPath();c.arc(10,-10,2.2,0,Math.PI*2);c.fill();
 }else if(type==='honey'){
  c.fillStyle='#f2b94a';c.beginPath();c.roundRect(-7,-5,14,14,4);outline(c);
  c.fillStyle='#fff1b8';c.beginPath();c.roundRect(-4,-1,3,7,1.5);c.fill();
  c.fillStyle='#c98a3a';c.beginPath();c.roundRect(-5,-10,10,5,2);outline(c,1.3);
 }else if(type==='mirror'){
  c.fillStyle='#bfe2f2';c.beginPath();c.ellipse(0,0,6.5,10,.25,0,Math.PI*2);outline(c);
  c.fillStyle='#ffffff';c.beginPath();c.ellipse(-2,-3,1.6,4,.25,0,Math.PI*2);c.fill();
  const tw=(Math.sin(time*6)+1)/2;c.globalAlpha=tw;c.fillStyle='#fff8c8';c.beginPath();c.arc(7,-8,1.8,0,Math.PI*2);c.fill();
 }else if(type==='sour'){
  c.fillStyle='#9fd26b';c.beginPath();c.arc(0,2,8,0,Math.PI*2);outline(c);
  c.fillStyle='#6aa344';c.beginPath();c.ellipse(4,-7,4,2,-.6,0,Math.PI*2);outline(c,1.2);
  c.fillStyle='#e9f7c9';c.beginPath();c.arc(-3,-1,1.8,0,Math.PI*2);c.fill();
 }else if(type==='woodpecker'){
  c.fillStyle='#b98252';c.beginPath();c.roundRect(-5,-8,10,18,3);outline(c);
  c.fillStyle='#e05a4a';c.beginPath();c.arc(0,-11,5,0,Math.PI*2);outline(c,1.3);
  const peck=Math.max(0,Math.sin(time*18))*2;c.fillStyle='#f2c14e';c.beginPath();c.moveTo(4,-12);c.lineTo(10+peck,-11);c.lineTo(4,-9);c.closePath();outline(c,1.1);
  c.fillStyle=INK;c.beginPath();c.arc(1.5,-12,1,0,Math.PI*2);c.fill();
 }else if(type==='pot'){
  c.fillStyle='#c9714a';c.beginPath();c.moveTo(-7,0);c.lineTo(7,0);c.lineTo(5,10);c.lineTo(-5,10);c.closePath();outline(c);
  c.strokeStyle='#5f9a3e';c.lineWidth=2;c.beginPath();c.moveTo(0,0);c.lineTo(0,-8);c.stroke();
  c.fillStyle='#f6c945';for(let i=0;i<6;i++){const a=i*Math.PI/3;c.beginPath();c.ellipse(Math.cos(a)*3.6,-11+Math.sin(a)*3.6,2.4,1.3,a,0,Math.PI*2);c.fill();}
  c.fillStyle='#7a4a24';c.beginPath();c.arc(0,-11,2,0,Math.PI*2);c.fill();
 }
 c.restore();
}
// 대장 햄찌 왕관(머리 위에서 살짝 흔들림)
export function drawCrown(c,x,y,time=0){
 c.save();c.translate(x,y+Math.sin(time*3)*1.2);
 c.fillStyle='#f6c945';c.beginPath();c.moveTo(-9,4);c.lineTo(-9,-4);c.lineTo(-4.5,0);c.lineTo(0,-7);c.lineTo(4.5,0);c.lineTo(9,-4);c.lineTo(9,4);c.closePath();outline(c,1.6);
 c.fillStyle='#e0634f';c.beginPath();c.arc(0,1,1.8,0,Math.PI*2);c.fill();
 c.restore();
}
