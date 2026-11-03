import {THEMES} from './mineral-themes.js';
export const DAMAGE_VARIANTS=3,DAMAGE_STAGES=3;
export const DAMAGE_URLS=Array.from({length:DAMAGE_VARIANTS},(_,row)=>Array.from({length:DAMAGE_STAGES},(_,col)=>new URL(`../../assets/mining/impacts/damage-surface-${row+1}-${col+1}-v3.png`,import.meta.url)));
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const mix=(a,b,t)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t));
// A value-map material preserves authored fracture faces in each map's colors.
function material(image,palette,makeCanvas){
 const canvas=makeCanvas(128,128),c=canvas.getContext('2d');c.drawImage(image,0,0,128,128);
 const pixels=c.getImageData(0,0,128,128),top=rgb(palette.top),rim=rgb(palette.rim),strata=rgb(palette.strata[1]),ink=rgb(palette.ink);
 const stops=[[0,ink],[76,mix(ink,strata,.55)],[123,strata],[158,mix(top,strata,.18)],[180,mix(top,rim,.05)],[220,mix(top,rim,.7)],[255,rim]];
 const lut=Array.from({length:256},(_,value)=>{let i=1;while(value>stops[i][0])i++;const[a,ac]=stops[i-1],[b,bc]=stops[i];return mix(ac,bc,(value-a)/(b-a));});
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  const i=(y*128+x)*4,v=Math.round((pixels.data[i]+pixels.data[i+1]+pixels.data[i+2])/3),color=lut[v];
  for(let channel=0;channel<3;channel++)pixels.data[i+channel]=color[channel];
  // The outer strip blends into the connected terrain, without a square rim.
  const edge=Math.min(x,y,127-x,127-y),t=Math.min(1,edge/16);
  pixels.data[i+3]=Math.round(255*t*t*(3-2*t));
 }
 c.putImageData(pixels,0,0);return canvas;
}
export async function loadImpactSprites(load,makeCanvas){
 const sources=await Promise.all(DAMAGE_URLS.map(row=>Promise.all(row.map(load))));
 return Object.fromEntries(THEMES.map(theme=>[theme.id,sources.map(row=>row.map(image=>material(image,theme.palette,makeCanvas)))]));
}
