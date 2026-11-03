// Small, original procedural review sounds. No external recordings or downloads.
export const SOUND_SECONDS={hit:.12,break:.31,land:.14,grasp:.10,deposit:.25};
export function synthesize(type,sampleRate=44100){
 const seconds=SOUND_SECONDS[type];if(!seconds)throw Error('Unknown sound cue: '+type);
 const out=new Float32Array(Math.ceil(seconds*sampleRate));let seed=9317,filtered=0;
 for(let i=0;i<out.length;i++){
  const t=i/sampleRate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/4294967296*2-1;filtered=filtered*.78+noise*.22;
  const sine=(hz,decay)=>Math.sin(t*Math.PI*2*hz)*Math.exp(-t*decay);
  let value=0;
  if(type==='hit')value=sine(710,47)*.16+sine(1460,65)*.055+sine(220,58)*.09+filtered*Math.exp(-t*65)*.32;
  if(type==='break'){
   // One impact cue: a low thump at contact, followed by short crumbling tails.
   value=filtered*Math.exp(-t*13)*.4+sine(148,24)*.17+sine(285,58)*.07+noise*Math.exp(-t*27)*.07;
   for(const delay of [.045,.095,.15])if(t>=delay)value+=noise*.055*Math.exp(-(t-delay)*65);
  }
  if(type==='land')value=sine(130,38)*.15+filtered*Math.exp(-t*36)*.23;
  if(type==='grasp')value=sine(460,62)*.08+filtered*Math.exp(-t*50)*.12;
  if(type==='deposit')value=sine(172,26)*.19+sine(315,37)*.065+filtered*Math.exp(-t*29)*.25;
  const attack=Math.min(1,t/.0015),tail=Math.min(1,(seconds-t)/.015);
  out[i]=value*attack*tail;
 }
 return out;
}
export function takeSoundCues(events,now,seen){
 const breaks=new Set(events.filter(e=>e.type==='break').map(e=>`${e.id}/${e.time}`)),out=[];
 const blasts=new Set(events.filter(e=>e.type==='blast').map(e=>`${e.worker}/${e.time}`)),playedBlasts=new Set();
 for(const e of events){
  if(seen.has(e))continue;seen.add(e);
  if(!SOUND_SECONDS[e.type]||now-e.time>.14)continue;
  if(e.type==='hit'&&breaks.has(`${e.id}/${e.time}`))continue;
  const blast=`${e.worker}/${e.time}`;
  if(e.type==='break'&&blasts.has(blast)){if(playedBlasts.has(blast))continue;playedBlasts.add(blast);}
  out.push(e);
 }
 return out;
}
export class MineSound{
 constructor({createContext=()=>new (globalThis.AudioContext??globalThis.webkitAudioContext)()}={}){
  this.createContext=createContext;this.enabled=false;this.seen=new WeakSet();this.voices=new Set();this.buffers=new Map();
 }
 async setEnabled(value){
  const request=this.request=(this.request??0)+1;
  if(!value){this.enabled=false;this.stop();return false;}
  try{
   if(!this.context){this.context=this.createContext();this.master=this.context.createGain();this.master.gain.value=.38;this.master.connect(this.context.destination);}
   await this.context.resume();if(request!==this.request)return this.enabled;this.enabled=this.context.state==='running';return this.enabled;
  }catch{this.enabled=false;return false;}
 }
 sync(state,visible=true){
  if(this.state!==state){this.stop();this.seen=new WeakSet();this.state=state;}
  const cues=takeSoundCues(state.events,state.time,this.seen);
  if(!this.enabled||state.paused||!visible||this.context?.state!=='running'){this.stop();return;}
  for(const e of cues){
   if(this.voices.size>=8)break;
   if(!this.buffers.has(e.type)){const pcm=synthesize(e.type,this.context.sampleRate),buffer=this.context.createBuffer(1,pcm.length,this.context.sampleRate);buffer.copyToChannel(pcm,0);this.buffers.set(e.type,buffer);}
   const source=this.context.createBufferSource();source.buffer=this.buffers.get(e.type);source.playbackRate.value=.96+((e.worker??e.dropId??0)%4)*.025;
   const pan=this.context.createStereoPanner?.();if(pan){pan.pan.value=Math.max(-.65,Math.min(.65,((e.x??225)-225)/350));source.connect(pan);pan.connect(this.master);}else source.connect(this.master);
   this.voices.add(source);source.onended=()=>{this.voices.delete(source);source.disconnect();pan?.disconnect();};source.start();
  }
 }
 stop(){for(const voice of this.voices){try{voice.stop();}catch{}}this.voices.clear();}
}
