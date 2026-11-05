// Approved village art. Parts move independently; hamster poses/flight timing stay in world.js.
const BASES={home:'home-base','care-house':'care-base',mastery:'mastery-base',playground:'tools-base',storage:'storage-base',mill:'mill-base',totem:'totem-base',well:'well-base'};
const INK='#6b4024';
const fit=(w,h,ratio)=>{const k=Math.min(w/ratio,h);return{w:k*ratio,h:k};};
export function wellOpening(p){const b=fit(p.w,p.h,659/697);return{x:p.x+( .495-.5)*b.w,y:p.y-b.h*.30,r:b.w*.24};}
export function artPanel(c,x,y,w,h,wood=false){
 c.save();c.fillStyle='#80502a';c.beginPath();c.roundRect(x,y+3,w,h,12);c.fill();
 c.fillStyle=wood?'#e7aa58':'#fff0cd';c.strokeStyle=INK;c.lineWidth=2.8;c.beginPath();c.roundRect(x,y,w,h,12);c.fill();c.stroke();
 c.strokeStyle=wood?'#ffe0a0':'#fffbed';c.lineWidth=2;c.beginPath();c.roundRect(x+4,y+4,w-8,h-8,8);c.stroke();c.restore();
}
export class VillageArt{
 static async load(rig){
  const root=new URL('../../assets/village/art-v2/',import.meta.url),r=await fetch(new URL('manifest.json',root));
  if(!r.ok)throw Error('마을 아트 목록을 열 수 없어요');
  const m=await r.json(),images={};await Promise.all(Object.entries(m.sheets).map(async([id,s])=>{images[id]=await rig.image(new URL(s.path,root));}));
  return new VillageArt(m,images);
 }
 constructor(manifest,images){this.manifest=manifest;this.images=images;}
 has(id){return !!BASES[id];}
 // 건물 그림이 실제로 그려지는 크기(비율을 지켜 자리 상자 안에 맞춤)
 size(p){const f=this.manifest.frames[BASES[p.id]];return f?fit(p.w,p.h,f.bounds[2]/f.bounds[3]):{w:p.w,h:p.h};}
 draw(c,id,x,y,w,h,angle=0,sx=1,sy=1){
  const f=this.manifest.frames[id];if(!f)return;
  const size=fit(w,h,f.bounds[2]/f.bounds[3]);c.save();c.translate(x,y);c.rotate(angle);c.scale(sx,sy);
  c.drawImage(this.images[f.sheet],...f.bounds,-size.w/2,-size.h/2,size.w,size.h);c.restore();
 }
 ground(c,z){
  const f=this.manifest.frames[z.id==='arena'?'arena-ground':'terrain-'+z.id],image=this.images[f.sheet];
  if(z.id==='hub'){
   // Place the painted side path on the existing travel gate without moving the game's gate or ball.
   // Ground only is mapped in three strips; every upright object remains an undistorted sprite.
   const cuts=[0,797,919,1672],dest=[0,810,950,1280];
   for(let i=0;i<3;i++)c.drawImage(image,0,cuts[i],941,cuts[i+1]-cuts[i],z.left,z.top+dest[i],720,dest[i+1]-dest[i]);
  }else c.drawImage(image,...f.bounds,z.left,z.top,z.right-z.left,z.bottom-z.top);
 }
 scenery(c,p,time,motion){
  const f=this.manifest.frames[p.id],b=fit(p.w,p.h,f.bounds[2]/f.bounds[3]);
  c.save();c.translate(p.x,p.y);
  // Root stays planted; a small, independently phased sway is enough for the big border trees.
  if(p.tree&&motion)c.transform(1,0,Math.sin(time*.75+p.phase)*.006,1,0,0);
  this.draw(c,p.id,0,-b.h/2,b.w,b.h);c.restore();
 }
 banner(c,x,y,w,h){const f=this.manifest.frames['wood-panel'];c.drawImage(this.images[f.sheet],...f.bounds,x,y,w,h);}
 post(c,x,y){this.draw(c,'gate-post',x,y-34,34,68);}
 // age = 눌린 뒤 흐른 시간(층을 바꾸면 깃발 천이 휙 펄럭였다 출렁 멈춘다), open = 층 고르기 말풍선이 열려 있음(천이 살랑 더 흔들림)
 mineBanner(c,{x,y,kind},number,{time=0,motion=true,age=9,open=false}={}){
  c.save();c.translate(x,y);
  c.fillStyle='#61472a24';c.beginPath();c.ellipse(0,1,15,5,0,0,Math.PI*2);c.fill();
  this.draw(c,'banner-stand',0,-75,104,150,0,.68,1);
  // The stand stays planted. Cloth and its live title/number share the crossbar pivot.
  const flap=motion&&age>=0&&age<.9?Math.sin(age*22)*Math.exp(-age*5.5):0;
  c.translate(0,-114);c.rotate(motion?Math.sin(time*1.7+x)*(open?.06:.025)+flap*.32:0);c.scale(1-flap*.08,1+flap*.12);
  this.draw(c,kind==='floor'?'banner-floor':'banner-best',0,31,76,85);
  c.textAlign='center';c.fillStyle='#75451f';c.font='900 14px Game,sans-serif';
  c.fillText(kind==='floor'?'지하':'최고',0,18);
  const text=String(number);let size=28;c.font=`900 ${size}px Game,sans-serif`;
  while(c.measureText(text).width>47&&size>11)c.font=`900 ${--size}px Game,sans-serif`;
  c.fillStyle='#4b2b18';c.fillText(text,0,46);c.restore();
 }
 facility(c,p,{time=0,motion=true,age=9,naming=false}={}){
  const id=BASES[p.id];if(!id)return;
  const f=this.manifest.frames[id],b=fit(p.w,p.h,f.bounds[2]/f.bounds[3]),t=motion?time:0;
  const hit=motion&&age>=0&&age<1?Math.sin(age*23)*Math.exp(-age*5):0;
  const rumble=motion&&age<0&&age>-.5?(1+age/.5)**1.5:0;
  c.save();c.translate(p.x,p.y);
  c.fillStyle='#61472a24';c.beginPath();c.ellipse(0,0,b.w*.4,9,0,0,Math.PI*2);c.fill();
  // Only props with an established interaction wobble move their base.
  if(p.id==='well'){c.translate(Math.sin(t*80)*rumble*6,0);c.scale(1+hit*.10-rumble*.05,1-hit*.10+rumble*.13);}
  else if(p.id==='totem'||p.id==='storage'){c.scale(1+hit*.07,1-hit*.09);}
  this.draw(c,id,0,-b.h/2,b.w,b.h);
  const part=(name,x,y,w,h,angle=0,sx=1,sy=1)=>this.draw(c,name,(x-.5)*b.w,(y-1)*b.h,w*b.w,h*b.h,angle,sx,sy);
  if(p.id==='home'){
   part('home-wheel',.839,.685,.24,.28,Math.sin(t*.95)*.05+hit*.26);
   part('home-sign',.126,.605,.155,.17,Math.sin(t*1.4+.5)*.045+hit*.16);
  }else if(p.id==='care-house'){
   const breath=motion?Math.sin(t*1.6+1.8)*.025:0;
   part('care-pillow',.47,.813,.33,.24,0,1+breath+hit*.12,1-breath-hit*.16);
   part('care-ball',.69,.64,.105,.24,Math.sin(t*1.7+2)*.05+hit*.22);
  }else if(p.id==='mastery'){
   part('mastery-book',.50,.49,.27,.17,hit*.08,1,1+Math.sin(t*1.1+3)*.025+hit*.12);
   part('mastery-telescope',.817,.268,.25,.25,Math.sin(t*.6+1)*.04+hit*.12);
  }else if(p.id==='playground'){
   part('tools-bird',.746,.724,.18,.24,Math.sin(t*2.4)*.035+hit*.28,1+hit*.1,1-hit*.17);
   part('tools-flag',.861,.145,.24,.19,Math.sin(t*1.8+2.4)*.035+hit*.12);
  }else if(p.id==='mill'){
   // The impulse starts and ends at zero, so collection never snaps the rotor backwards.
   const boost=motion&&age>=0&&age<2?.28*Math.sin(Math.PI*age/2)**2:0;
   part('mill-rotor',.495,.341,.68,.68,t*.65+boost);
  }else if(p.id==='totem'){
   part('totem-flower',.525,.015,.49,.48,Math.sin(t*.8+1)*.055+hit*.2);
  }else if(p.id==='well'){
   c.save();c.textAlign='center';c.fillStyle=INK;c.font='900 15px Game,sans-serif';c.fillText('이름 우물',0,-b.h*.85+5);c.font='900 11px Game,sans-serif';c.fillText('퐁당!',0,-b.h*.70+3);c.restore();
   part('well-bucket',.83,.54,.105,.19,Math.sin(t*1.3)*.045+hit*.18);
   const x=(.495-.5)*b.w,y=-b.h*.30;
   if(age>=0&&age<.9){c.globalAlpha=1-age/.9;c.strokeStyle='#e4ffed';c.lineWidth=2;c.beginPath();c.ellipse(x,y,b.w*(.08+age*.16),b.h*(.025+age*.035),0,0,Math.PI*2);c.stroke();c.globalAlpha=1;}
   if(naming)for(let j=0;j<4;j++){const k=(t*1.3+j*.27)%1;c.globalAlpha=(1-k)*.8;c.fillStyle='#e7ffff';c.beginPath();c.arc(x-22+j*14,y-k*25,3,0,7);c.fill();}c.globalAlpha=1;
   if(motion&&age>=0&&age<.7){c.globalAlpha=1-age/.7;c.fillStyle='#bdebea';c.strokeStyle='#4d9d9b';c.lineWidth=1;
    for(let j=0;j<9;j++){const a=Math.PI*(1.08+.84*j/8),v=75+j%3*22;c.beginPath();c.ellipse(x+Math.cos(a)*v*age*1.6,y+Math.sin(a)*v*age*2.4+260*age*age,3.5,5,0,0,7);c.fill();c.stroke();}c.globalAlpha=1;}
  }
  c.restore();
 }
 // (x,y) = 팻말 다리가 박힌 땅 자리(깊이 정렬 기준)
 sign(c,text,x,y,size=14){
  c.save();c.font=`900 ${size}px Game,sans-serif`;const w=Math.max(86,c.measureText(text).width+36),h=w*319/627,top=y-h+3;
  c.fillStyle='#61472a2e';c.beginPath();c.ellipse(x,y,w*.36,5,0,0,Math.PI*2);c.fill();
  this.draw(c,'facility-sign',x,top+h/2,w,h);c.textAlign='center';c.fillStyle='#5d361f';c.fillText(text,x,top+h*.44+size*.3);c.restore();
 }
}
