// World marker only: no price, arbitrary hit-count label, or clickable floor skip.
import {center} from './model.js';
function oval(c,x,y,rx,ry,fill){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();}
export function drawHoleBase(c,marker,position=null){
 if(!marker)return;const[x,y]=marker.state==='revealed'&&position?[position.x,position.y]:center(marker.id);c.save();
 if(marker.state==='buried'){
  c.lineCap='round';c.lineJoin='round';c.strokeStyle='#ad7c4d';c.lineWidth=5;
  c.beginPath();c.moveTo(x-8,y-6);c.quadraticCurveTo(x,y+1,x+8,y+7);c.moveTo(x-7,y+7);c.quadraticCurveTo(x+1,y,x+8,y-7);c.stroke();
 }else{
  oval(c,x,y+5,22,13,'#9b6d4b');oval(c,x,y+2,21,12,'#f2cf89');oval(c,x,y+3,18,10,'#6d4a3e');oval(c,x,y+4,15.5,7.8,'#3e302e');
  c.strokeStyle='#7c5541';c.lineWidth=2;c.beginPath();c.ellipse(x,y+2,21,12,0,0,Math.PI*2);c.stroke();
 }c.restore();
}
export function drawHoleMarker(c,marker,time,position=null){
 if(!marker)return;const[x,y]=marker.state==='revealed'&&position?[position.x,position.y]:center(marker.id),found=marker.state==='revealed',bob=found?Math.sin(time*3.5)*2.3:0;
 const labelY=Math.max(78,y-(found?61:36))+bob,tipY=labelY+15;
 c.save();c.font='900 12px Game, sans-serif';c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';c.lineWidth=3.2;c.strokeStyle='#684932';c.fillStyle='#fff3c4';
 const label=found?'다음 층':'아래층';c.strokeText(label,x,labelY);c.fillText(label,x,labelY);
 c.beginPath();c.moveTo(x-7,tipY-6);c.quadraticCurveTo(x,tipY-3,x+7,tipY-6);c.lineTo(x,tipY+2);c.closePath();c.fillStyle=found?'#ffdc75':'#fff0b6';c.strokeStyle='#815736';c.lineWidth=1.8;c.stroke();c.fill();
 c.restore();
}
