// Animation direction 02. All times are visual seconds, never gameplay events.
// Foot contact is the origin. The rigid tool follows the grip, not body scaling.
const clamp=x=>Math.max(0,Math.min(1,x));
const mod=(x,n)=>((x%n)+n)%n;
const mix=(a,b,k)=>a+(b-a)*k;
const smooth=x=>x*x*(3-2*x);
const REST={angle:.13,gripX:22,gripY:-25,tilt:0,sx:1,sy:1,bob:0,shift:0,spin:0,size:1,alpha:1,propAngle:0,propY:0,pawLift:0};
const pose=(v={},stage='idle')=>({...REST,...v,stage});
function track(t,keys){
 if(t<=keys[0][0])return {...keys[0][1]};
 for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){
  const [ta,a]=keys[i-1],[tb,b,ease='smooth']=keys[i];let k=clamp((t-ta)/(tb-ta));
  k=ease==='in'?k*k*k:ease==='out'?1-(1-k)**3:ease==='linear'?k:smooth(k);
  return {...Object.fromEntries(Object.keys(REST).map(key=>[key,mix(a[key],b[key],k)])),stage:k>=1-1e-8?b.stage:a.stage};
 }
 return {...keys.at(-1)[1]};
}
const R=pose();
const LOAD=pose({sx:1.23,sy:.81,tilt:-.105,angle:-.14,gripX:6,gripY:-27},'load');
const LIFT=pose({sx:.88,sy:1.135,tilt:-.19,angle:-.62,gripX:-28,gripY:-40,bob:-2},'lift');
const HIT=pose({sx:1.36,sy:.735,tilt:.17,angle:1.25,gripX:31,gripY:-25},'hit');
const REBOUND=pose({sx:.89,sy:1.12,tilt:-.085,angle:.80,gripX:24,gripY:-28,bob:-7},'rebound');
const SETTLE=pose({sx:1.11,sy:.90,tilt:.045,angle:.25,gripX:23,gripY:-25},'settle');
export const MINING_KEYS=[[0,HIT],[.05,HIT],[.16,REBOUND,'out'],[.30,SETTLE],[.50,R],[1.10,R],[1.43,LOAD],[1.82,LIFT,'out'],[1.96,LIFT],[2.1,HIT,'in']];
export const MOTION_INFO={
 idle:{duration:3.2,beats:'작게 숨 들이쉬기 · 잠깐 멈춤 · 길게 내쉬기'},
 mine:{duration:2.1,beats:'꾹 준비 · 들어 올려 멈춤 · 탁! · 짧은 눌림 · 잔반동'},
 walk:{duration:.96,beats:'디딤 · 몸이 뒤따라 올라옴 · 착지 · 반대쪽 디딤'},
 tired:{duration:4.1,beats:'무겁게 준비 · 힘겹게 들기 · 내려찍기 · 긴 회복'},
 carry:{duration:1.3,beats:'묵직하게 디딤 · 짐이 한 박자 늦게 흔들림'},
 sleep:{duration:3.5,beats:'꾸벅 · 버티기 · 푹 꺼짐 · 잔반동 · 새근새근',once:true},
 startle:{duration:1.15,beats:'움찔 · 쭉 튀어 오름 · 공중 정점 · 착지 · 안정',once:true},
 eat:{duration:2.1,beats:'씨앗 들어 올리기 · 두 번 오물 · 잠깐 멈춤 · 꿀꺽'},
 full:{duration:2.8,beats:'배를 감싸기 · 만족스럽게 기대기 · 긴 숨'},
 drill:{duration:1.2,beats:'몸으로 버티기 · 도구의 짧은 진동 · 반동 흡수'},
 bomb:{duration:2.4,beats:'숙여 놓기 · 손을 떼기 · 귀를 막고 웅크리기',once:true},
 blown:{duration:2,beats:'발사 직전 눌림 · 쭉 발사 · 공중 회전 · 착지 · 잠',once:true},
 pajamas:{duration:3,beats:'졸린 준비 · 한 번 툭 · 그대로 다시 꾸벅'},
 suction:{duration:2,beats:'깜짝 버티기 · 방향으로 늘어남 · 회전하며 쏙',once:true},
 rest:{duration:3.8,beats:'자리 잡기 · 편하게 내려앉기 · 느린 호흡',once:true},
 peek:{duration:3.2,beats:'아래에서 준비 · 빼꼼 · 좌우 살피기 · 쏙'}
};

export function elasticPose(clip,t=0,index=0,{loop=false}={}){
 const info=MOTION_INFO[clip]??MOTION_INFO.idle;
 const time=info.once?(loop?mod(t,info.duration):Math.max(0,t)):mod(t+index*.43,info.duration);
 let p;
 if(['mine','tired','pajamas'].includes(clip)){
  p=track(time/info.duration*2.1,MINING_KEYS);
  const phase=time/info.duration*2.1;
  p.stage=phase<.05?'hit':phase<.16?'rebound':phase<.5?'settle':phase<1.10?'idle':phase<1.43?'load':phase<1.82?'lift':phase<1.96?'hold':'strike';
  if(clip==='tired'){p.sx=mix(1.08,p.sx,.76);p.sy=mix(.91,p.sy,.76);p.tilt+=.045;p.bob*=.45;}
  if(clip==='pajamas'){p.sx=mix(1.16,p.sx,.55);p.sy=mix(.77,p.sy,.55);p.bob*=.30;}
  return p;
 }
 if(clip==='walk'||clip==='carry'){
  const heavy=clip==='carry',step=time/(info.duration/2),phase=mod(step,1),side=Math.floor(step)%2?-1:1;
  p=track(phase,[[0,pose({sx:1.13,sy:.885,tilt:-.065*side},'plant')],[.12,pose({sx:1.13,sy:.885,tilt:-.065*side},'push')],[.38,pose({sx:.92,sy:1.085,bob:heavy?-5:-12,tilt:.09*side},'float'),'out'],[.65,pose({sx:.97,sy:1.03,bob:heavy?-4:-10,tilt:.08*side},'fall')],[1,pose({sx:1.13,sy:.885,tilt:.065*side},'plant'),'in']]);
  if(heavy){p.sx=mix(1.08,p.sx,.6);p.sy=mix(.94,p.sy,.6);p.tilt-=.055;p.propY=Math.sin((phase-.12)*Math.PI*2)*2.4;p.propAngle=Math.sin((phase-.16)*Math.PI*2)*.055;}
  p.angle+=Math.sin(step*Math.PI)*.12;return p;
 }
 if(clip==='startle')return track(time,[[0,pose({sx:1.14,sy:.83,tilt:-.08},'flinch')],[.065,pose({sx:1.24,sy:.80,tilt:-.10},'load')],[.145,pose({sx:.79,sy:1.26,bob:-15,tilt:.06,pawLift:12},'launch'),'out'],[.26,pose({sx:.94,sy:1.06,bob:-39,tilt:-.04,pawLift:8},'apex'),'out'],[.40,pose({sx:.9,sy:1.11,bob:-19,tilt:.04,pawLift:4},'fall'),'in'],[.475,pose({sx:1.32,sy:.755},'land'),'in'],[.55,pose({sx:.95,sy:1.05,bob:-3},'rebound'),'out'],[.65,R],[1.15,R]]);
 if(clip==='sleep'){
  p=track(time,[[0,pose({sx:1.04,sy:.94,tilt:.07},'droop')],[.32,pose({sx:1.16,sy:.84,tilt:.13},'nod')],[.48,pose({sx:.99,sy:1,tilt:-.03},'resist')],[.78,pose({sx:1.34,sy:.69,tilt:-.10},'collapse'),'in'],[.92,pose({sx:1.17,sy:.83,tilt:-.08},'rebound'),'out'],[1.12,pose({sx:1.24,sy:.75,tilt:-.10},'sleep')]]);
  if(time>1.12){const b=Math.sin((time-1.12)*2);p.sy+=b*.016;p.sx-=b*.012;}return p;
 }
 if(clip==='rest'){
  p=track(time,[[0,R],[.35,pose({sx:1.16,sy:.86,tilt:-.06},'settle')],[.54,pose({sx:1.07,sy:.94,tilt:-.04},'rebound')],[.78,pose({sx:1.11,sy:.90,tilt:-.06},'rest')]]);
  if(time>.78){const b=Math.sin((time-.78)*1.7);p.sy+=b*.018;p.sx-=b*.014;}return p;
 }
 if(clip==='eat'){
  const chew=track(mod(time,.70),[[0,pose({sx:1.02,sy:.98,propY:2},'chew')],[.10,pose({sx:1.13,sy:.90,tilt:.025,propY:-1},'bite'),'in'],[.20,pose({sx:.98,sy:1.02,propY:0},'rebound'),'out'],[.31,pose({sx:1.11,sy:.91,tilt:-.025,propY:-1},'bite'),'in'],[.44,pose({sx:1.04,sy:.96,propY:1},'chew')],[.70,pose({sx:1.02,sy:.98,propY:2},'pause')]]);
  if(time<.24){const k=1-smooth(time/.24);chew.propY+=k*10;chew.stage='lift-seed';}
  if(time>1.68)return track(time,[[1.68,chew],[1.79,pose({sx:.94,sy:1.06,tilt:-.06,propY:2},'swallow')],[1.98,pose({sx:1.09,sy:.92,propY:4},'satisfied')],[2.1,pose({sx:1.02,sy:.98,propY:12},'satisfied')]]);
  return chew;
 }
 if(clip==='full')return track(time,[[0,pose({sx:1.10,sy:.95},'belly')],[.35,pose({sx:1.18,sy:.88,tilt:-.055},'pat')],[.52,pose({sx:1.10,sy:.97,tilt:-.04},'rebound')],[1.2,pose({sx:1.13,sy:.95,tilt:-.075},'satisfied')],[2.3,pose({sx:1.16,sy:.91,tilt:.02},'exhale')],[2.8,pose({sx:1.10,sy:.95},'belly')]]);
 if(clip==='drill'){
  const pulse=Math.sin(time*Math.PI*36),sway=Math.sin(time/1.2*Math.PI*2);
  return pose({sx:1.13+pulse*.015,sy:.88-pulse*.01,tilt:.12+sway*.018,shift:pulse*.7,propY:pulse*.8,propAngle:pulse*.018},'drill');
 }
 if(clip==='bomb')return track(time,[[0,pose({propY:-19,propAngle:-.1},'hold')],[.55,pose({sx:1.24,sy:.80,tilt:.1,propY:0},'place')],[.78,pose({sx:1.22,sy:.82,tilt:.08},'release')],[1.05,pose({sx:.96,sy:1.04,tilt:-.04,pawLift:1},'cover'),'out'],[1.22,pose({sx:1.25,sy:.79,tilt:-.06,pawLift:1},'brace')],[2.4,pose({sx:1.25,sy:.79,tilt:-.06,pawLift:1},'brace')]]);
 if(clip==='blown')return track(time,[[0,pose({sx:1.27,sy:.79},'load')],[.07,pose({sx:1.32,sy:.75},'load')],[.17,pose({sx:.77,sy:1.29,bob:-24,spin:-.2},'launch'),'out'],[.55,pose({sx:.94,sy:1.06,bob:-93,spin:-3.1},'apex'),'out'],[.91,pose({sx:.86,sy:1.16,bob:-34,spin:-5.8},'fall'),'in'],[1.05,pose({sx:1.39,sy:.72,spin:-Math.PI*2},'land'),'in'],[1.18,pose({sx:.94,sy:1.06,bob:-8,spin:-Math.PI*2},'rebound'),'out'],[1.35,pose({sx:1.25,sy:.76,tilt:-.10,spin:-Math.PI*2},'sleep')],[2,pose({sx:1.25,sy:.76,tilt:-.10,spin:-Math.PI*2},'sleep')]]);
 if(clip==='suction')return track(time,[[0,R],[.18,pose({sx:1.23,sy:.81,tilt:-.08},'resist')],[.38,pose({sx:.77,sy:1.29,bob:-11,tilt:.12},'stretch'),'in'],[.75,pose({sx:.86,sy:1.16,bob:-26,size:.78,spin:1.1},'suction'),'in'],[1.5,pose({sx:.95,sy:1.05,bob:-3,size:.20,spin:5.1,alpha:.85},'suction'),'in'],[1.88,pose({size:.025,spin:6.8,alpha:0},'gone')],[2,pose({size:.025,spin:6.8,alpha:0},'gone')]]);
 if(clip==='peek')return track(time,[[0,pose({bob:24,sx:1.15,sy:.86},'hide')],[.4,pose({bob:24,sx:1.20,sy:.83},'load')],[.65,pose({bob:-5,sx:.93,sy:1.07},'peek'),'out'],[.84,pose({bob:0,sx:1.03,sy:.97},'settle')],[1.3,pose({tilt:-.08},'look')],[1.7,pose({tilt:.08},'look')],[2.3,R],[2.65,pose({bob:24,sx:1.15,sy:.86},'hide'),'in'],[3.2,pose({bob:24,sx:1.15,sy:.86},'hide')]]);
 return track(time,[[0,R],[1.0,pose({sx:.975,sy:1.035,tilt:-.016},'inhale')],[1.35,pose({sx:.975,sy:1.035,tilt:-.016},'hold')],[2.65,pose({sx:1.018,sy:.98,tilt:.012},'exhale')],[3.2,R]]);
}

// Deform the attachment's origin with the body. Keep props and paws rigid.
export function bodySocket(p,x,y){const cos=Math.cos(p.tilt),sin=Math.sin(p.tilt);return [(x*cos-y*sin)*p.sx,(x*sin+y*cos)*p.sy];}
