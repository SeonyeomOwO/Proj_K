import { CONFIG as C, CREW_PER_TEAM } from '../data/config.js';
import { DUNGEONS } from '../data/dungeons.js';
import { stats, unitTeam } from './engine.js';
import { CRYSTAL_BASES, CREW_HOMES, crystalShape } from './scene-config.js';
import { drawHamsterRig, equippedPickaxe, sampleHamsterPose } from './hamster-rig.js';
import { FIELD, blocked, hidden, footprint, insideFootprint, standPoints, HAMSTER_WALK, HAMSTER_STRIDE } from './vein-geometry.js';
// Renderer only. 장착 팀마다 3마리가 나오고, 햄찌 한 마리마다 엔진의 자기 타격 이벤트(e.unit)를 표현한다.
// 각자 목표 결정 옆의 보이는 자리로 걸어가 결정 바닥을 피해 돌아가며, 결정과 함께 밑동 y 순서로 그려 겹치지 않는다.
// 모든 종류는 몸통·곡괭이·앞발 분리 원화와 동일한 채굴 리그를 쓴다.
const VEIN_CENTER = [500, 720];
// 바위 하나만 나오는 무대는 루비 바위뿐이다. 던전은 일반 층처럼 결정 16개 무대(결정 종류만 다르다).
const single = s => s.rubyStage;
// 타격 후 회복 자세가 끝날 때까지 걷지 않는 시간(초). 엔진의 이동 시간 추정에도 같은 값이 들어간다.
const RECOVER_HOLD = .45;
// 폭죽·색종이 색(구리=금빛·주황, 에메랄드=초록, 루비=분홍·빨강)
const FW_COLORS = {
  copper: ['#ffb25a', '#ffe2a0', '#ff8a2a', '#fff3d1'],
  emerald: ['#6dffb8', '#c4ffe4', '#2fe08c', '#f0fff7', '#d9ff7a'],
  ruby: ['#ff7a9c', '#ffc7d6', '#ff3d6e', '#fff0f4', '#ffd36b', '#ff5fa0']
};
// 폭죽 세기: 구리는 소박하게, 에메랄드는 화려하게, 루비는 가장 화려하게.
// size·speed=알갱이 크기·퍼지는 속도, glitter=반짝이 알갱이 비율, split=끝에서 잔불꽃으로 쪼개지는 비율, flash=터질 때 빛 번짐 크기,
// paper·paperSpan=색종이 수와 쏟아지는 길이, fountain·fountainRate=양옆 분수 지속 시간(초)과 초당 알갱이 수, shards=광물 조각 수, banner=배너가 보이는 시간(초)
const FW_STYLE = {
  copper: { size: 1, speed: 1, glitter: .4, split: 0, flash: 1, paper: 50, paperSpan: 400, fountain: 0, fountainRate: 0, shards: 18, banner: 2.7 },
  emerald: { size: 1.12, speed: 1.1, glitter: .5, split: .25, flash: 1.3, paper: 110, paperSpan: 700, fountain: 1.8, fountainRate: 38, shards: 40, banner: 3 },
  ruby: { size: 1.3, speed: 1.2, glitter: .65, split: .4, flash: 1.7, paper: 210, paperSpan: 1300, fountain: 3, fountainRate: 70, shards: 72, banner: 3.5 }
};
// 승인된 광맥 알림 PNG에는 제목과 보너스 문구가 함께 들어 있다(돌 층은 연출 없음).
const STAGE = {
  copper: { banner: 'vein_banner_copper', glow: '255,150,60' },
  emerald: { banner: 'vein_banner_emerald', glow: '60,230,150' },
  ruby: { banner: 'vein_banner_ruby', glow: '255,70,110' }
};
const DUNGEON_POS=[490,665], DUNGEON_SIZE=390;
// inner: 수레 원화의 안쪽 입구(뒤 왼쪽→뒤 오른쪽→앞 오른쪽→앞 왼쪽), pieces: 그 안의 광물 조각 자리.
// 둘 다 수레 밑변 가운데(527, 1147) 기준 좌표. 화면에서 원화를 보고 잰 값.
const CRATE={x:399,y:990,w:256,h:157,mouth:[527,1030],
  inner:[[-22,-137],[73,-105],[38,-55],[-65,-85]],
  pieces:[[-6,-122],[-30,-100],[4,-112],[38,-96],[-8,-94],[-44,-84],[-14,-80],[20,-78],[46,-74],[18,-62]]};
const short=n=>n>=1e9?(n/1e9).toFixed(1)+'B':n>=1e6?(n/1e6).toFixed(1)+'M':n>=1000?(n/1000).toFixed(1)+'K':String(Math.floor(n));
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const rand=(a,b)=>a+Math.random()*(b-a);
const easeOutBack=t=>1+2.2*(t-1)**3+1.2*(t-1)**2;

export class World {
  constructor(canvas, assets, mineralOverride = null) {
    this.ctx = canvas.getContext('2d');
    this.assets = assets;
    this.clock = 0;
    this.mineralOverride = mineralOverride;
    this.tiles = CRYSTAL_BASES.map((pos,id)=>({id,pos,...crystalShape(id)}));
    this.drawOrder = [...this.tiles].sort((a, b) => a.pos[1] - b.pos[1]);
    this.clear();
  }
  clear() {
    this.fx = [];
    this.parts = [];
    this.hitAt = new Map();
    this.miner = null;
    this.crew = [];
    this.activeMiner = 0;
    this.lastFloor = null;
    this.popStart = -1;
    this.crateBump = 9;
    this.celebrate = 9;
    this.failAt = -9;
    this.pillFlash = null;
    this.quake = 0;
    this.quakeAt = -9;
    this.crateKinds = [];
    this.stageKey = null;
    this.stagePending = null;
    this.stageFx = null;
    this.motes = [];
    this.fw = { queue: [], rockets: [], sparks: [], paper: [], fountains: [], t: 0 };
  }
  shakeScreen(amount) {
    if (this.clock - this.quakeAt > .1 || amount > this.quake) {
      this.quake = amount;
      this.quakeAt = this.clock;
    }
  }
  // 결정 하나의 종류. ?mineral=… 미리보기만 모든 결정을 한 종류로 덮는다.
  kindOf(ore) { return this.mineralOverride || ore?.kind || 'stone'; }
  impactPoint(id,dungeon) {
    const [x,y]=dungeon?DUNGEON_POS:CRYSTAL_BASES[id];
    const m=this.miner||{x:200,y:850};
    return [x+Math.sign(m.x-x)*45,y-50];
  }
  events(events, s) {
    const motion = s.settings.motion;
    if (!this.crew.length) this.updateMiner(s,0);
    let from = null, chained = [], blastAt = null;
    // 연쇄 대상은 엔진이 고른 그대로 두고, 번개 경로만 가까운 광석부터 이어 선이 엉키지 않게 한다
    const flushBolts = () => {
      let p = from, i = 0;
      while (p && chained.length) {
        chained.sort((u, v) => Math.hypot(u[0] - p[0], u[1] - p[1]) - Math.hypot(v[0] - p[0], v[1] - p[1]));
        const q = chained.shift();
        this.fx.push({ type: 'bolt', t: 0, delay: i++ * .035, a: p, b: q, seed: Math.random() * 99 });
        p = q;
      }
      chained = [];
    };
    for (const e of events) {
      if (e.type === 'hit') {
        if (!e.chain && !e.blast) {
          // 친 햄찌 본인이 내려찍는다. 아직 걷는 중이면: 자리에 거의 왔으면 그 자리에 세우고 치고,
          // 멀리 있으면 걷기를 끊지 않는다(피해 숫자는 결정에 그대로 뜸). 걷다가 곡괭이질이 끼어드는 것을 막는다.
          const swinger=this.crew[e.unit||0]||this.crew[0];
          if (swinger) {
            const left = swinger.moving && swinger.goal ? Math.hypot(swinger.goal[0]-swinger.x, swinger.goal[1]-swinger.y) : 0;
            if (left < 60) {
              // 순간이동하지 않고 그 자리에 멈춰 친 뒤, 회복이 끝나면 남은 몇 걸음을 마저 걷는다
              // 그 자리를 이번 목표의 자리로 삼아 다시 걷지 않는다(멈췄다 걷다를 반복하지 않게)
              if (swinger.moving) { swinger.moving = false; swinger.v = 0; swinger.park = [swinger.x, swinger.y]; swinger.parkFor = swinger.goalFor; if (swinger.target) swinger.face = swinger.target[0] < swinger.x ? -1 : 1; }
              this.miner = swinger; swinger.hitAt = this.clock;
            }
          }
          if (e.crit) this.shakeScreen(4);
        }
        const [x, y] = this.impactPoint(e.id, e.dungeon);
        const site = e.dungeon ? DUNGEON_POS : CRYSTAL_BASES[e.id];
        this.hitAt.set(e.dungeon ? 'dungeon' : e.id, this.clock);
        if (e.chain)
          chained.push(site);
        else if (!e.blast) {
          flushBolts();
          from = [x, y];
          this.fx.push({ type: 'arc', t: 0, x, y, mx:this.miner.x, my:this.miner.y-35, face:this.miner.face });
        }
        this.fx.push({ type: 'spark', t: 0, x: e.chain ? site[0] : x, y: e.chain ? site[1] : y, big: !e.chain });
        // 팀이 많으면 숫자가 화면을 덮는다: 동시에 떠 있는 숫자를 제한하고, 보조 팀의 연쇄 숫자는 생략
        const nums = this.fx.filter(f => f.type === 'num' && f.t < .9).length;
        if (nums >= 16 || (e.chain && (e.team || 0) > 0) || (nums >= 9 && !e.crit && (e.team || 0) > 0))
          continue;
        this.fx.push({ type: 'num', t: 0, x: (e.chain ? site[0] : x) + rand(-22, 22), y: (e.chain ? site[1] : y) - 20, text: short(e.damage) + (e.crit ? '!' : ''), crit: e.crit, chain: e.chain });
      }
      if (e.type === 'break') {
        const [x, y] = CRYSTAL_BASES[e.id], kind = this.mineralOverride || e.kind || 'stone', brokenKey = 'mineral_' + kind + '_broken';
        if (!blastAt)
          blastAt = [x, y];
        if (motion)
          for (let k = 0; k < (s.crew.length > 2 ? 4 : 7); k++) {
            const a = rand(-Math.PI * .95, -Math.PI * .05), v = rand(260, 540);
            this.parts.push({ key: brokenKey, x: x + rand(-30, 30), y: y + rand(-20, 20), vx: Math.cos(a) * v, vy: Math.sin(a) * v, spin: rand(-9, 9), rot: rand(0, 6), size: rand(26, 44), t: 0, life: rand(.55, .8) });
          }
        this.fx.push({ type: 'dust', t: 0, x, y });
        this.shakeScreen(s.crew.length > 2 ? 3 : 5);
        this.fx.push({ type: 'drop', t: 0, x, y, reward: e.reward, key: brokenKey, kind, delay: rand(0, .08) });
      }
      // 루비 광맥 층을 모두 깼다: 루비 보너스가 광맥 한가운데에서 크게 떠오른다
      if (e.type === 'stageClear') {
        this.fx.push({ type: 'rubygain', t: 0, x: 440, y: 640, amount: e.ruby, big: true, delay: .25 });
        this.shakeScreen(7);
      }
      if (e.type === 'floor') {
        this.celebrate = 0;
        this.shakeScreen(9);
      }
      // 던전: 광산은 결정이 더 단단해져 다시 솟고, 광산탑은 한 층 올라간다. 위쪽 알약이 잠깐 그 소식을 알려 준다.
      if (e.type === 'dungeonRefill' || e.type === 'towerFloor') {
        this.pillFlash = { at: this.clock, text: e.type === 'towerFloor' ? e.floor + '층 돌파!' : e.level + '회차 · 더 단단해졌어요!' };
        this.shakeScreen(7);
      }
      // 같은 층 재도전: 광맥이 다시 솟아오르고 시간 표시가 잠깐 흔들린다
      if (e.type === 'floorFail') {
        this.popStart = this.clock;
        this.failAt = this.clock;
      }
    }
    flushBolts();
    // 부채꼴 타격(cleave)은 blast로 표시되지만 폭발이 아니므로 폭발 링은 진짜 폭발 채굴일 때만
    if (blastAt && events.some(e => e.blast && !e.cleave))
      this.fx.push({ type: 'ring', t: 0, x: blastAt[0], y: blastAt[1] });
    this.fx = this.fx.slice(-140);
    this.parts = this.parts.slice(-120);
  }
  // 햄찌마다 따로 움직인다: 엔진이 정한 자기 목표 결정(s.unitTargets[u]) 옆의 보이는 자리로 걷고,
  // 할 일이 없으면(빌드 선택 중 등) 근처를 어슬렁거린다. 단일 바위에서는 바위 밑동을 따라 늘어선다.
  updateMiner(s,dt) {
    const n=s.crew.length*CREW_PER_TEAM, idle=s.draft&&!s.rubyStage, rock=single(s);
    this.crew.length=Math.min(this.crew.length,n);
    for(let u=0;u<n;u++) {
      const k=unitTeam(u), type=s.crew[k];
      let m=this.crew[u];
      if(!m) {
        const home=CREW_HOMES[u%CREW_HOMES.length], [sx,sy]=this.freeSpot(s,home[0]+rand(-60,60),home[1]+rand(-30,20));
        m=this.crew[u]={x:sx,y:sy,moving:false,face:Math.random()<.5?-1:1,hitAt:-9,index:u,team:k,type,speed:rand(HAMSTER_WALK.min,HAMSTER_WALK.max),v:0,step:Math.random()*2,goal:null,goalFor:null,waitUntil:0};
      }
      m.team=k; m.type=type;
      let site=null;
      if(rock) {
        site=DUNGEON_POS;
        const a=Math.PI*(.06+.88*(n===1?.5:u/(n-1)));
        m.goal=[site[0]+Math.cos(a)*255, site[1]+185+Math.sin(a)*75]; m.goalFor='rock';
      } else {
        const t=idle?null:s.unitTargets?.[u];
        if(t!=null&&s.ores[t]?.hp>0) {
          site=CRYSTAL_BASES[t];
          // 설 자리는 엔진이 정한다(s.unitSpots). 엔진의 타격 시각이 그 자리까지 걷는 시간을 기준으로 잡혀 있다.
          const spot=s.unitSpots?.[u];
          if(m.parkFor===t&&m.park&&!this.solid(s,m.park[0],m.park[1])) { m.goal=m.park; m.goalFor=t; }
          else if(spot&&!this.solid(s,spot[0],spot[1])) { m.goal=spot; m.goalFor=t; m.parkFor=null; }
          else if(m.goalFor!==t||!m.goal) { m.goal=this.pickSpot(m,standPoints(s,t),s,t); m.goalFor=t; }
        } else if(!idle&&s.ores.some(o=>o.hp>0)&&m.goal&&!this.solid(s,m.goal[0],m.goal[1])) {
          // 채굴 중인데 목표가 막 비었으면(엔진이 곧 새 목표를 줌) 서성이지 않고 그 자리에서 기다린다
        } else if(m.goalFor!=='wander'||(!m.moving&&this.clock>m.waitUntil)||this.solid(s,m.goal[0],m.goal[1])||(!single(s)&&hidden(s,m.goal[0],m.goal[1]))) {
          // 어슬렁: 근처 빈 땅으로 한 걸음, 잠깐 쉬었다 다시
          m.goal=this.freeSpot(s,m.x+rand(-120,120),m.y+rand(-50,60)); m.goalFor='wander'; m.waitUntil=this.clock+rand(1.2,3.2);
        }
      }
      this.walk(s,m,dt);
      if(site&&!m.moving) m.face=site[0]<m.x?-1:1;
      m.target=site;
    }
    this.separate(s);
    if(!this.miner||!this.crew.includes(this.miner))this.miner=this.crew[0];
  }
  // 던전·루비 바위 중에는 광맥이 화면에 없으므로 결정 바닥으로 막지 않는다
  solid(s,x,y) {
    return single(s)?x<FIELD.minX||x>FIELD.maxX||y<FIELD.minY||y>FIELD.maxY:blocked(s,x,y);
  }
  // 목표 결정 주변의 빈 자리 중 다른 햄찌가 이미 잡지 않은, 지금 위치에서 가까운 곳
  pickSpot(m,spots,s,t) {
    if(!spots.length) { const f=footprint(t); return this.freeSpot(s,f.x+(m.x<f.x?-1:1)*(f.rx+40),f.y+f.ry+30); }
    const taken=p=>this.crew.some(o=>o!==m&&o.goal&&Math.hypot(o.goal[0]-p[0],o.goal[1]-p[1])<44);
    const free=spots.filter(p=>!taken(p)), pool=free.length?free:spots;
    return pool.reduce((a,p)=>Math.hypot(p[0]-m.x,p[1]-m.y)<Math.hypot(a[0]-m.x,a[1]-m.y)?p:a);
  }
  // (x,y) 근처에서 결정 바닥이 아니고 앞 결정에 가려지지도 않는 땅을 찾는다
  freeSpot(s,x,y) {
    for(let r=0;r<420;r+=26) for(let i=0;i<8;i++) {
      const a=i/8*Math.PI*2+r, px=clamp(x+Math.cos(a)*r,FIELD.minX+4,FIELD.maxX-4), py=clamp(y+Math.sin(a)*r*.6,FIELD.minY+4,FIELD.maxY-4);
      if(!this.solid(s,px,py)&&(single(s)||!hidden(s,px,py))) return [px,py];
    }
    return [clamp(x,FIELD.minX,FIELD.maxX),FIELD.maxY-4];
  }
  // 목표로 걷되 결정 바닥은 밟지 않는다: 막히면 방향을 조금씩 틀어 옆으로 돌아간다.
  // 새 광맥이 발밑에 솟아 이미 바닥 안에 있으면 가장 가까운 바깥으로 빠져나온다.
  walk(s,m,dt) {
    const [gx,gy]=m.goal, dx=gx-m.x, dy=gy-m.y, len=Math.hypot(dx,dy);
    // 서 있는 햄찌는 자리에서 조금(14px 미만) 밀려도 다시 걷지 않는다. 걷기↔곡괭이질이 번갈아 깜빡이는 것을 막는다.
    if(!m.moving&&len<14){m.v=0;return;}
    // 곡괭이를 내려찍고 회복하는 동안(0.45초)은 출발하지 않는다. 회복 자세로 미끄러지듯 걷는 것을 막는다.
    if(!m.moving&&this.clock-m.hitAt<RECOVER_HOLD&&s.settings.motion){m.v=0;return;}
    m.moving=len>3;
    if(!m.moving){m.x=gx;m.y=gy;m.v=0;return;}
    if(dt<=0) return;
    if(!s.settings.motion){m.x=gx;m.y=gy;m.moving=false;m.v=0;return;}
    // 출발할 때 천천히 붙는 가속, 도착할 때 감속(남은 거리로 멈출 수 있는 속도 이하)
    const want=Math.min(m.speed,Math.sqrt(2*420*len)+15);
    m.v+=clamp(want-m.v,-700*dt,380*dt);
    const stepLen=Math.min(len,m.v*dt);
    m.step+=stepLen/HAMSTER_STRIDE;
    // 결정 뒤(가려진 자리)에 있으면 곧장 목표로 빠져나온다. 결정이 앞에 그려지므로 광맥 뒤로 지나가는 모습이 된다.
    if(!single(s)&&hidden(s,m.x,m.y)) {
      m.x+=dx/len*stepLen*1.3; m.y+=dy/len*stepLen*1.3; m.face=dx<0?-1:1; return;
    }
    const inside=!single(s)&&s.ores.find(o=>o.hp>0&&insideFootprint(m.x,m.y,footprint(o.id)));
    if(inside) {
      const f=footprint(inside.id), ox=m.x-f.x, oy=(m.y-f.y)||1, ol=Math.hypot(ox,oy)||1;
      m.x+=ox/ol*stepLen*1.6; m.y+=oy/ol*stepLen*1.6; m.face=ox<0?-1:1; return;
    }
    const base=Math.atan2(dy,dx);
    for(const turn of [0,.45,-.45,.9,-.9,1.35,-1.35,1.8,-1.8]) {
      const a=base+turn, nx=m.x+Math.cos(a)*stepLen, ny=m.y+Math.sin(a)*stepLen;
      if(!this.solid(s,nx,ny)||Math.hypot(gx-nx,gy-ny)<4) { m.x=nx; m.y=ny; m.face=Math.cos(a)<0?-1:1; return; }
    }
    m.moving=false;
  }
  // 햄찌끼리 너무 붙으면 살짝 밀어낸다(서로 겹쳐 한 덩어리로 보이지 않게).
  // 자리에 선 햄찌는 밀지 않는다: 걷는 햄찌만 비켜 간다. 선 햄찌를 밀면 다시 걷고 또 밀리며 동작이 뒤섞인다.
  separate(s) {
    for(let i=0;i<this.crew.length;i++) for(let j=i+1;j<this.crew.length;j++) {
      const a=this.crew[i], b=this.crew[j];
      if(!a.moving&&!b.moving) continue;
      const dx=b.x-a.x, dy=(b.y-a.y)*1.6, d=Math.hypot(dx,dy);
      if(d>0&&d<34) {
        const push=(34-d)/(a.moving&&b.moving?2:1), ux=dx/d, uy=dy/d/1.6;
        if(a.moving&&!this.solid(s,a.x-ux*push,a.y-uy*push)){a.x-=ux*push;a.y-=uy*push;}
        if(b.moving&&!this.solid(s,b.x+ux*push,b.y+uy*push)){b.x+=ux*push;b.y+=uy*push;}
      }
    }
  }
  // 층 종류가 바뀐 순간을 잡는다. 구리·에메랄드·루비 광맥 층이 새로 열리면 연출을 예약하고,
  // 빌드 선택 창이 떠 있거나 던전·루비 바위 중이면 끝난 뒤에 보여 준다. 같은 층 재도전에서 종류가 그대로면 다시 하지 않는다.
  trackStage(s) {
    const key = s.floor + ':' + s.floorKind;
    if (this.stageKey !== key) {
      if (this.stageKey !== null)
        this.stagePending = s.floorKind && s.floorKind !== 'stone' ? s.floorKind : null;
      this.stageKey = key;
    }
    if (this.stagePending && !s.draft && !single(s)) {
      this.startStageFx(s, this.stagePending);
      this.stagePending = null;
    }
  }
  startStageFx(s, kind) {
    const motion = s.settings.motion;
    this.stageFx = { kind, t: 0 };
    if (!motion)
      return;
    this.shakeScreen(kind === 'ruby' ? 8 : kind === 'emerald' ? 6 : 5);
    this.launchFireworks(kind);
    // 그 광물 조각이 광맥 한가운데에서 사방으로 터져 나온다
    const count = FW_STYLE[kind].shards, key = 'mineral_' + kind + '_broken', boost = FW_STYLE[kind].speed;
    for (let i = 0; i < count; i++) {
      const ang = rand(0, Math.PI * 2), v = rand(300, 760) * boost;
      this.parts.push({ key, x: 480 + rand(-60, 60), y: 640 + rand(-50, 50), vx: Math.cos(ang) * v, vy: Math.sin(ang) * v * .8 - 260, spin: rand(-12, 12), rot: rand(0, 6), size: rand(26, 52), t: 0, life: rand(.9, 1.5) });
    }
  }
  // ── 폭죽 ────────────────────────────────────────────────────────────────────────────────
  // 로켓이 아래에서 올라가 터지면 불꽃 알갱이가 모양대로 퍼졌다가 꼬리를 끌며 떨어진다. 색종이도 함께 쏟아진다.
  // 구리=소박한 3발, 에메랄드=별·네잎 클로버·겹링·수양버들에 옆 분수와 잔불꽃, 루비=겹하트·꽃·겹링이 쉼 없이 터지고 마지막에 한꺼번에 터지는 피날레.
  launchFireworks(kind) {
    const plan = {
      copper: [],   // 구리는 폭죽 없이 번쩍임·광물 조각·색종이·배너만
      emerald: [['star', .05], ['ring2', .3], ['star', .55], ['clover', .8], ['willow', 1.05], ['star', 1.3], ['ring2', 1.55], ['willow', 1.8]],
      ruby: [['heart2', .05], ['ring2', .2], ['heart2', .4], ['flower', .6], ['heart2', .8], ['willow', .95], ['ring2', 1.15], ['heart2', 1.35], ['round', 1.5], ['heart2', 1.7], ['willow', 1.85], ['flower', 2], ['ring2', 2.15],
        ['heart2', 2.5], ['heart2', 2.56], ['round', 2.62], ['heart2', 2.68], ['ring2', 2.74], ['round', 2.8]]
    }[kind] || [];
    // 화면 위쪽은 HUD가 덮으므로 광맥 둘레 빈 땅(좌우·아래)과 광맥 위에서 터뜨린다
    // 하트·별 같은 모양은 잘 보이게 위쪽 자리에서, 링·둥근 폭죽은 아래쪽·옆자리에서 터뜨린다
    const high = [[200, 590], [760, 570], [480, 540], [330, 650], [640, 650]], low = [[150, 800], [800, 790], [480, 880], [220, 940], [740, 940], [310, 740], [650, 740]];
    const shaped = ['heart', 'heart2', 'star', 'clover', 'flower'];
    let hi = 0, lo = 0;
    plan.forEach(([shape, at]) => {
      const [bx, by] = shaped.includes(shape) ? high[hi++ % high.length] : low[lo++ % low.length];
      this.fw.queue.push({ at: this.fw.t + at, shape, kind, bx: bx + rand(-40, 40), by: by + rand(-30, 30) });
    });
    const pal = FW_COLORS[kind], st = FW_STYLE[kind];
    for (let i = 0; i < st.paper; i++)
      this.fw.paper.push({ x: rand(-20, 960), y: rand(-st.paperSpan, -20), vx: rand(-40, 40), vy: rand(380, 620), sway: rand(0, 6), swayAmp: rand(30, 90), rot: rand(0, 6), spin: rand(-8, 8), w: rand(14, 26), h: rand(8, 14), color: pal[i % pal.length] });
    // 양옆 땅에서 불꽃 분수가 솟는다(에메랄드·루비)
    if (st.fountain)
      for (const dir of [1, -1])
        this.fw.fountains.push({ kind, dir, x: dir > 0 ? 70 : 870, from: this.fw.t + .15, until: this.fw.t + st.fountain, rate: st.fountainRate, acc: 0 });
  }
  fireworkVectors(shape) {
    const out = [], TAU = Math.PI * 2;
    const round = (n, lo, hi) => { for (let i = 0; i < n; i++) { const a = rand(0, TAU), v = rand(lo, hi); out.push([Math.cos(a) * v, Math.sin(a) * v]); } };
    const ring = (n, v) => { for (let i = 0; i < n; i++) { const a = i / n * TAU; out.push([Math.cos(a) * v, Math.sin(a) * v]); } };
    const heart = (n, k) => {
      for (let i = 0; i < n; i++) {
        const t = i / n * TAU;
        const hx = 16 * Math.sin(t) ** 3, hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        out.push([hx * k, hy * k - k * 1.1]);
      }
    };
    // 꽃잎 곡선 r=|cos(k·θ)|: 꽃잎 끝 쪽 알갱이가 더 빨리 나간다
    const petals = (n, k, v) => { for (let i = 0; i < n; i++) { const a = i / n * TAU, r = .22 + .78 * Math.abs(Math.cos(k * a)); out.push([Math.cos(a) * v * r, Math.sin(a) * v * r]); } };
    if (shape === 'round')
      round(38, 170, 560);
    else if (shape === 'ring')
      for (let i = 0; i < 32; i++) {
        const a = i / 32 * TAU, v = 470 + rand(-14, 14);
        out.push([Math.cos(a) * v, Math.sin(a) * v]);
      }
    else if (shape === 'ring2') {
      ring(34, 480);
      ring(22, 280);
    }
    else if (shape === 'star') {
      // 5각 별: 각도마다 반지름 비율이 달라 꼭짓점 쪽 알갱이가 더 빨리 나간다
      for (let i = 0; i < 60; i++) {
        const a = i / 60 * TAU, m = ((a + Math.PI / 2) % (TAU / 5) + TAU / 5) % (TAU / 5), r = Math.cos(Math.PI / 5) / Math.cos(m - Math.PI / 5);
        const v = 215 * r * (r > 1.18 ? 1.05 : 1);
        out.push([Math.cos(a) * v * 1.9, Math.sin(a) * v * 1.9]);
      }
    }
    else if (shape === 'heart')
      heart(56, 27);
    else if (shape === 'heart2') {
      heart(60, 29);
      heart(32, 14);
    }
    else if (shape === 'clover') {
      petals(64, 2, 470);
      round(10, 40, 140);
    }
    else if (shape === 'flower') {
      petals(72, 3, 500);
      ring(18, 150);
    }
    else if (shape === 'willow')
      round(48, 120, 430);
    return out;
  }
  burstFirework(f) {
    const pal = FW_COLORS[f.kind], fw = this.fw, st = FW_STYLE[f.kind], willow = f.shape === 'willow';
    for (const [vx, vy] of this.fireworkVectors(f.shape)) {
      const life = willow ? rand(2, 2.9) : rand(1.15, 1.85);
      fw.sparks.push({
        x: f.bx, y: f.by, px: f.bx, py: f.by, vx: vx * st.speed, vy: vy * st.speed, age: 0, life,
        color: willow ? pal[Math.random() < .6 ? 3 : 1] : pal[Math.floor(Math.random() * pal.length)],
        size: rand(5.5, 9) * st.size, glitter: Math.random() < st.glitter, split: !willow && Math.random() < st.split,
        drag: willow ? 1.5 : 2.4, grav: willow ? 260 : 170
      });
    }
    // 터지는 순간의 빛 번짐과 작은 흔들림
    fw.sparks.push({ flash: true, x: f.bx, y: f.by, age: 0, life: .3 + st.flash * .06, color: pal[1], size: st.flash });
    this.shakeScreen(f.kind === 'ruby' ? 4 : 3);
  }
  drawFireworks(s, dt) {
    const fw = this.fw;
    if (!fw || (!fw.queue.length && !fw.rockets.length && !fw.sparks.length && !fw.paper.length && !fw.fountains.length))
      return;
    if (!s.settings.motion) {
      fw.fountains = [];
      fw.queue = [];
      fw.rockets = [];
      fw.sparks = [];
      fw.paper = [];
      return;
    }
    const ctx = this.ctx;
    fw.t += dt;
    // 예약된 폭죽을 로켓으로 쏘아 올린다
    fw.queue = fw.queue.filter(q => {
      if (q.at > fw.t)
        return true;
      fw.rockets.push({ ...q, x0: q.bx + rand(-60, 60), y0: 1040, t: 0, dur: rand(.5, .68), trail: [] });
      return false;
    });
    // 양옆 땅에서 솟는 불꽃 분수
    fw.fountains = fw.fountains.filter(f => {
      if (fw.t >= f.until)
        return false;
      if (fw.t < f.from)
        return true;
      f.acc += f.rate * dt;
      const pal = FW_COLORS[f.kind];
      for (; f.acc >= 1; f.acc--)
        fw.sparks.push({ x: f.x, y: 1130, px: f.x, py: 1130, vx: f.dir * rand(40, 330), vy: -rand(760, 1150), age: 0, life: rand(.9, 1.5), color: pal[Math.floor(Math.random() * pal.length)], size: rand(4, 7), glitter: Math.random() < .5, drag: 1.6, grav: 760 });
      return true;
    });
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    // 로켓: 위로 솟으며 꼬리를 남긴다
    fw.rockets = fw.rockets.filter(r => {
      r.t += dt;
      const p = Math.min(1, r.t / r.dur), e = 1 - (1 - p) ** 2.2;
      r.x = r.x0 + (r.bx - r.x0) * e + Math.sin(r.t * 28) * 3 * (1 - p);
      r.y = r.y0 + (r.by - r.y0) * e;
      r.trail.push([r.x, r.y]);
      if (r.trail.length > 12)
        r.trail.shift();
      const col = FW_COLORS[r.kind][0];
      r.trail.forEach(([tx, ty], i) => {
        ctx.fillStyle = col;
        ctx.globalAlpha = (i / r.trail.length) * .8;
        ctx.beginPath();
        ctx.arc(tx, ty, 2.2 + i * .45, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(r.x, r.y, 6, 0, Math.PI * 2);
      ctx.fill();
      if (p >= 1) {
        this.burstFirework(r);
        return false;
      }
      return true;
    });
    // 불꽃 알갱이: 퍼지다가 공기 저항으로 느려지고 중력으로 떨어지며, 끝에서 반짝인다
    const born = [];
    fw.sparks = fw.sparks.filter(k => {
      k.age += dt;
      if (k.age >= k.life)
        return false;
      const a = 1 - k.age / k.life;
      if (k.flash) {
        const R = 190 * k.size * (1 - a * .45);
        const g = ctx.createRadialGradient(k.x, k.y, 0, k.x, k.y, R);
        g.addColorStop(0, `rgba(255,255,255,${Math.min(1, .85 * a * k.size)})`);
        g.addColorStop(.4, `rgba(255,235,200,${.3 * a * k.size})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.fillRect(k.x - R, k.y - R, R * 2, R * 2);
        return true;
      }
      // 절반쯤 날아간 알갱이가 작은 잔불꽃 두 개로 쪼개진다
      if (k.split && k.age > k.life * .5) {
        k.split = false;
        for (let i = 0; i < 2; i++) {
          const ang = rand(0, Math.PI * 2), v = rand(70, 190);
          born.push({ x: k.x, y: k.y, px: k.x, py: k.y, vx: k.vx * .3 + Math.cos(ang) * v, vy: k.vy * .3 + Math.sin(ang) * v, age: 0, life: rand(.5, .85), color: k.color, size: k.size * .65, glitter: true, drag: 2.4, grav: 170 });
        }
      }
      k.px = k.x;
      k.py = k.y;
      const drag = Math.exp(-(k.drag || 2.4) * dt);
      k.vx *= drag;
      k.vy = k.vy * drag + (k.grav || 170) * dt;
      k.x += k.vx * dt;
      k.y += k.vy * dt;
      const tw = k.age > k.life * .55 ? .55 + .45 * Math.sin(k.age * 55 + k.x) : 1;
      const alpha = Math.max(0, a ** .8 * tw);
      ctx.strokeStyle = k.color;
      ctx.beginPath();
      ctx.moveTo(k.px - k.vx * .03, k.py - k.vy * .03);
      ctx.lineTo(k.x, k.y);
      ctx.globalAlpha = alpha * .3;
      ctx.lineWidth = k.size * 2.6 * (.5 + a * .5);
      ctx.stroke();
      ctx.globalAlpha = alpha;
      ctx.lineWidth = k.size * (.55 + a * .6);
      ctx.stroke();
      if (k.glitter && a > .15) {
        ctx.fillStyle = '#fff';
        ctx.globalAlpha *= .9;
        ctx.beginPath();
        ctx.arc(k.x, k.y, k.size * .6, 0, Math.PI * 2);
        ctx.fill();
      }
      return true;
    });
    if (born.length)
      fw.sparks.push(...born);
    if (fw.sparks.length > 1800)
      fw.sparks.splice(0, fw.sparks.length - 1800);
    ctx.restore();
    // 색종이: 팔랑이며 쏟아진다
    ctx.save();
    fw.paper = fw.paper.filter(c => {
      c.y += c.vy * dt;
      c.x += c.vx * dt + Math.cos(this.clock * 3 + c.sway) * c.swayAmp * dt;
      c.rot += c.spin * dt;
      if (c.y > 1700)
        return false;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.scale(1, Math.cos(this.clock * 7 + c.sway));
      ctx.globalAlpha = .92;
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      ctx.restore();
      return true;
    });
    ctx.restore();
  }  // 구리·에메랄드·루비 층에서는 광맥 뒤가 그 색으로 은은하게 빛나고, 작은 반짝임이 천천히 떠오른다
  drawStageGlow(s, dt) {
    const kind = s.floorKind, st = STAGE[kind];
    if (!st)
      return;
    const ctx = this.ctx, motion = s.settings.motion, pulse = motion ? .5 + .5 * Math.sin(this.clock * (kind === 'ruby' ? 4 : 2.2)) : .5;
    const g = ctx.createRadialGradient(480, 690, 40, 480, 690, 470);
    g.addColorStop(0, `rgba(${st.glow},${.2 + .1 * pulse})`);
    g.addColorStop(.6, `rgba(${st.glow},${.08 + .04 * pulse})`);
    g.addColorStop(1, `rgba(${st.glow},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 230, 941, 900);
    if (!motion)
      return;
    if (Math.random() < dt * (kind === 'ruby' ? 9 : 6))
      this.motes.push({ x: rand(250, 730), y: rand(620, 900), vy: -rand(45, 95), vx: rand(-14, 14), t: 0, life: rand(1.3, 2.1), size: rand(9, 20), spin: rand(0, 6) });
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const m of this.motes) {
      m.t += dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      const k = m.t / m.life, a = Math.sin(Math.PI * Math.min(1, k)) * .9, r = m.size * (.6 + .4 * Math.sin(this.clock * 6 + m.spin));
      ctx.fillStyle = `rgba(${st.glow},${a})`;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y - r);
      ctx.quadraticCurveTo(m.x, m.y, m.x + r * .55, m.y);
      ctx.quadraticCurveTo(m.x, m.y, m.x, m.y + r);
      ctx.quadraticCurveTo(m.x, m.y, m.x - r * .55, m.y);
      ctx.quadraticCurveTo(m.x, m.y, m.x, m.y - r);
      ctx.fill();
    }
    ctx.restore();
    this.motes = this.motes.filter(m => m.t < m.life).slice(-70);
  }
  // 새 광맥 층 연출: 화면이 번쩍이고(루비·에메랄드는 폭죽 동안 맥박처럼 반복), 이름 배너가 통통 튀어 나왔다 사라진다
  drawStageFx(s, dt) {
    const f = this.stageFx;
    if (!f)
      return;
    f.t += dt;
    const st = STAGE[f.kind], fs = FW_STYLE[f.kind], motion = s.settings.motion, T = motion ? fs.banner : 1.6, t = f.t;
    if (t >= T) {
      this.stageFx = null;
      return;
    }
    const ctx = this.ctx, fade = clamp((T - t) / .5, 0, 1);
    if (motion) {
      if (t < .3) {
        ctx.fillStyle = `rgba(${st.glow},${Math.min(.55, .32 * fs.flash * (1 - t / .3))})`;
        ctx.fillRect(-20, -20, 981, 1712);
      }
      // 루비·에메랄드는 폭죽이 이어지는 동안 화면 전체가 그 색으로 맥박치듯 번쩍인다
      const throb = f.kind === 'ruby' ? .1 : f.kind === 'emerald' ? .05 : 0;
      if (throb && t < T - .6) {
        ctx.fillStyle = `rgba(${st.glow},${throb * (.5 + .5 * Math.sin(t * (f.kind === 'ruby' ? 13 : 9))) * clamp((T - .6 - t) / .6, 0, 1)})`;
        ctx.fillRect(-20, -20, 981, 1712);
      }
    }
    const pop = motion ? (t < .45 ? easeOutBack(t / .45) : 1) : 1, rise = motion && t > T - .5 ? -(1 - fade) * 60 : 0, tilt = motion && t < .45 ? (1 - t / .45) * -.12 : 0;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(C.designWidth / 2, 450 + rise);
    ctx.rotate(tilt);
    ctx.scale(pop, pop);
    // 투명 여백을 포함한 원본 비율로 그려 승인된 제목·보너스 정렬을 보존한다.
    // 시간/내구도 아래에 배치하고, 기존 팝업·기울기·페이드 연출은 그대로 적용한다.
    const frame = this.assets.manifest.frames[st.banner], width = 720, height = width * frame.h / frame.w;
    this.assets.draw(ctx, st.banner, -width / 2, -height / 2, width, height);
    ctx.restore();
  }
  render(s, dt) {
    const ctx = this.ctx, a = this.assets;
    this.clock += dt;
    // 새 층이 열리거나 던전 무대가 바뀌면(들어감·다시 솟음·다음 층·나옴) 결정이 솟아오른다
    const stageKey = s.floor + ':' + (s.dungeon ? s.dungeon.kind + s.dungeon.level : '');
    if (this.lastFloor !== stageKey) {
      if (this.lastFloor !== null)
        this.popStart = this.clock;
      this.lastFloor = stageKey;
    }
    this.trackStage(s);
    this.updateMiner(s, dt);
    ctx.clearRect(0, 0, C.designWidth, C.designHeight);
    // 화면 흔들림: 파괴·치명타·층 클리어 때 짧게. 배경을 조금 크게 깔아 가장자리가 비지 않게 한다.
    const q = this.quake, qt = this.clock - this.quakeAt, qk = s.settings.motion && qt < .16 ? q * (1 - qt / .16) : 0;
    ctx.save();
    if (qk)
      ctx.translate(Math.sin(qt * 140) * qk, Math.cos(qt * 110) * qk * .6);
    ctx.drawImage(a.background, -12, -12, 965, 1696);
    if (single(s))
      this.drawDungeon(s);
    else if (!s.dungeon)
      this.drawStageGlow(s, dt);
    this.drawCrate(s);
    // 결정과 햄찌를 밑동(발) y 순서로 한 번에 그린다: 뒤쪽 햄찌는 앞 결정에 가려지고, 결정 위에 올라선 것처럼 보이지 않는다
    const items = this.crew.map(m => ({ y: m.y + .5, draw: () => this.drawHamster(s, m) }));
    if (!single(s))
      items.push(...this.crystalItems(s));
    items.sort((p, q) => p.y - q.y).forEach(it => it.draw());
    this.drawDurability(s);
    if (s.dungeon)
      this.drawDungeonPill(s);
    else if (!single(s))
      this.drawTimer(s);
    this.drawEffects(s, dt);
    this.drawFireworks(s, dt);
    this.drawStageFx(s, dt);
    ctx.restore();
    if (single(s)) {
      const left = C.rubyStageSeconds - s.rubyStage.elapsed;
      ctx.fillStyle = '#5a1626ee';
      ctx.beginPath();
      ctx.roundRect(292, 236, 425, 62, 18);
      ctx.fill();
      ctx.fillStyle = '#ffd0dc';
      ctx.font = '900 32px HamsterKR';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('루비 바위 · ' + Math.max(0, Math.ceil(left)) + '초', 505, 278);
    }
  }
  // 던전 안내: 위쪽 알약에 이름과 남은 시간(광산)·층(광산탑), 내구도 막대 아래 작은 알약에 얻은 것.
  // 회차·층이 바뀌면 알약이 잠깐 그 소식으로 바뀐다.
  drawDungeonPill(s) {
    const ctx = this.ctx, d = s.dungeon, mine = d.kind === 'mine';
    const left = Math.max(0, Math.ceil(DUNGEONS.mine.seconds - d.elapsed)), urgent = mine && left <= 10;
    const flash = this.pillFlash && this.clock - this.pillFlash.at < 1.5 ? this.pillFlash : null;
    const pop = flash && s.settings.motion ? 1 + .12 * Math.max(0, 1 - (this.clock - flash.at) / .25) : 1;
    ctx.save();
    ctx.translate(487, 268);
    ctx.scale(pop, pop);
    ctx.fillStyle = flash ? '#7a4a12' : urgent ? '#5a1f1a' : '#262522';
    ctx.strokeStyle = '#1b1210';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-190, -24, 380, 48, 22);
    ctx.fill();
    ctx.stroke();
    ctx.font = '900 30px HamsterKR, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = flash ? '#fff4c9' : urgent ? '#ff8a73' : '#ffe991';
    ctx.fillText(flash ? flash.text : mine ? DUNGEONS.mine.name + ' · ' + left + '초' : DUNGEONS.tower.name.replace('무한의 ', '') + ' · ' + d.level + '층', 0, 2);
    ctx.restore();
    ctx.save();
    ctx.translate(487, 362);
    ctx.fillStyle = '#262522cc';
    ctx.beginPath();
    ctx.roundRect(-160, -17, 320, 34, 17);
    ctx.fill();
    ctx.font = '900 22px HamsterKR, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#d8f2ff';
    ctx.fillText(mine ? '다이아 +' + short(d.earned) + ' · ' + d.level + '회차' : '다이아 +' + short(d.earned) + ' · 루비 +' + short(d.ruby), 0, 1);
    ctx.restore();
  }
  // 살아 있는 결정마다 그리기 항목 하나(정렬 기준은 밑동 y)
  crystalItems(s) {
    const motion=s.settings.motion, items=[];
    for(const tile of this.drawOrder) {
      const ore=s.ores[tile.id];if(ore.hp<=0)continue;
      const age=this.popStart<0?9:this.clock-this.popStart-tile.id*.015;
      const scale=!motion||age>=.35?1:age<=0?0:easeOutBack(age/.35);
      if(scale<=0)continue;
      items.push({y:tile.pos[1],draw:()=>this.drawCrystal(s,tile,ore,motion,scale)});
    }
    return items;
  }
  drawCrystal(s,tile,ore,motion,scale) {
    const ctx=this.ctx;
    {
      const [x,y]=tile.pos;
      const since=this.clock-(this.hitAt.get(tile.id)??-9);
      ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
      ctx.fillStyle='rgba(28,34,30,.2)';ctx.beginPath();ctx.ellipse(0,-5,tile.width*.43,23,0,0,Math.PI*2);ctx.fill();
      // 맞은 결정: 밑동 기준으로 납작하게 눌렸다 튀고, 좌우로 크게 흔들린다
      const hitK=motion&&since<.16?1-since/.16:0;
      const shake=hitK?Math.sin(since*110)*8*hitK:0;
      ctx.translate(shake,0);ctx.rotate(tile.lean+(hitK?Math.sin(since*70)*.03*hitK:0));
      if(hitK)ctx.scale(1+.07*hitK,1-.09*hitK);
      const broken=ore.hp<ore.maxHp*.4;
      const key='mineral_'+this.kindOf(ore)+(broken?'_broken':'');
      const f=this.assets.manifest.frames[key],width=tile.width*(broken?.82:1),height=width*f.h/f.w;
      // Different heights keep the cluster organic; every base stays fixed while it fractures.
      const stretch=broken?1:tile.height/height;
      this.assets.draw(ctx,key,-width/2,-height*stretch,width,height*stretch,false);
      if(since<.1&&motion){
        // 하얗게 번쩍: 같은 원화를 더하기 합성으로 한 번 더 그린다(원화 색은 바꾸지 않음)
        ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.55*(1-since/.1);
        this.assets.draw(ctx,key,-width/2,-height*stretch,width,height*stretch,false);
        ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1-since/.1;
        this.assets.draw(ctx,'spark',-44,-height*.6,88,88);
      }
      ctx.restore();
    }
  }
  // 던전 바위(다이아몬드 — 다이아몬드는 던전에서만 나온다)와 환생 직후 루비 바위. 루비 바위는 붉은 빛이 맥동해 보너스 스테이지임을 알린다.
  drawDungeon(s) {
    const ctx = this.ctx, rock = single(s), since = this.clock - (this.hitAt.get('dungeon') ?? -9);
    if (s.rubyStage && s.settings.motion) {
      const glow = ctx.createRadialGradient(DUNGEON_POS[0], DUNGEON_POS[1], 40, DUNGEON_POS[0], DUNGEON_POS[1], 300);
      glow.addColorStop(0, 'rgba(255,70,110,' + (.32 + .12 * Math.sin(this.clock * 5)) + ')');
      glow.addColorStop(1, 'rgba(255,70,110,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(DUNGEON_POS[0] - 300, DUNGEON_POS[1] - 300, 600, 600);
    }
    ctx.save();
    ctx.translate(DUNGEON_POS[0], DUNGEON_POS[1]);
    if (since < .12 && s.settings.motion)
      ctx.translate(Math.sin(since * 120) * 6, 0);
    const rockKind = 'ruby';
    this.assets.draw(ctx, 'mineral_' + rockKind + (rock.hp < rock.maxHp * .4 ? '_broken' : ''), -DUNGEON_SIZE / 2, -DUNGEON_SIZE / 2, DUNGEON_SIZE, DUNGEON_SIZE);
    ctx.restore();
  }
  // 광맥 전체 내구도. 네 칸이 남은 비율만큼 부분적으로 찬다.
  drawDurability(s) {
    const ctx = this.ctx;
    const rocks = single(s) ? [single(s)] : s.ores;
    const ratio = rocks.reduce((n, o) => n + o.hp, 0) / rocks.reduce((n, o) => n + o.maxHp, 0);
    ctx.fillStyle = '#262522';
    ctx.beginPath();
    ctx.roundRect(378, 303, 218, 34, 14);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = '#5c6065';
      ctx.fillRect(386 + i * 50, 310, 44, 20);
      ctx.fillStyle = '#ffbf45';
      ctx.fillRect(386 + i * 50, 310, 44 * clamp(ratio * 4 - i, 0, 1), 20);
    }
  }
  // 층 제한 시간. 내구도 막대 바로 위, 10초 이하면 붉게 깜빡이고 실패 직후엔 흔들린다.
  drawTimer(s) {
    const ctx = this.ctx, left = Math.max(0, Math.ceil(C.floorSeconds - (s.floorElapsed || 0)));
    const sinceFail = this.clock - this.failAt, urgent = left <= 10 || sinceFail < .8;
    const shake = sinceFail < .5 && s.settings.motion ? Math.sin(sinceFail * 60) * 8 * (1 - sinceFail / .5) : 0;
    const pulse = urgent && s.settings.motion ? 1 + .06 * Math.max(0, Math.sin(this.clock * 9)) : 1;
    ctx.save();
    ctx.translate(487 + shake, 268);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = urgent ? '#5a1f1a' : '#262522';
    ctx.strokeStyle = '#1b1210';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-74, -24, 148, 48, 22);
    ctx.fill();
    ctx.stroke();
    ctx.font = '900 32px HamsterKR, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = urgent ? '#ff8a73' : '#ffe991';
    ctx.fillText(left + '초', 0, 2);
    ctx.restore();
  }
  drawCrate(s) {
    const bump = this.crateBump < .14 ? 1 + .06 * Math.sin(this.crateBump / .14 * Math.PI) : 1;
    const ctx = this.ctx, cx = CRATE.x + CRATE.w / 2, by = CRATE.y + CRATE.h;
    ctx.save();
    ctx.translate(cx, by);
    ctx.scale(2 - bump, bump);
    this.assets.draw(ctx, 'ore_crate', -CRATE.w / 2, -CRATE.h, CRATE.w, CRATE.h);
    // 수레 안쪽 입구(원화 좌표 기준 사각형)로 잘라 작은 광물 조각을 넣는다. 테두리 밖으로 삐져나오지 않게.
    // 조각 종류는 최근에 담긴 광석을 따른다(처음엔 전부 돌). 구리·에메랄드·루비를 캘 때마다 한 칸씩 바뀐다.
    ctx.save();
    ctx.beginPath();
    for(const [x,y] of CRATE.inner) ctx.lineTo(x,y);
    ctx.closePath();
    ctx.clip();
    CRATE.pieces.forEach(([x,y],i)=>this.assets.draw(ctx,'mineral_'+(this.mineralOverride||this.crateKinds[i]||'stone')+'_broken',x-18,y-16,36,32));
    ctx.restore();
    ctx.restore();
  }
  // 햄찌 한 마리: 자기 타격 시계(s.unitClocks[u])에 맞춰 타격 직전에 뒤로 젖혀 들어 올렸다가(예비 동작)
  // 엔진의 hit 이벤트 순간 내려찍는다. 내려찍는 프레임엔 몸이 납작하게 눌렸다 튄다. 걷는 중엔 통통 뛴다.
  drawHamster(s,m) {
    const ctx=this.ctx,a=this.assets,motion=s.settings.motion,mining=s.autoMine&&(!s.draft||!!s.rubyStage);
    const period=stats(s).interval*CREW_PER_TEAM;
    const toHit=period-(s.unitClocks?.[m.index]??0);
    const pose=sampleHamsterPose({clock:this.clock,index:m.index,motion,mining,moving:m.moving,hasTarget:!!m.target,step:m.step,speed:m.v,period,toHit,sinceHit:this.clock-m.hitAt});
    a.draw(ctx,'shadow',m.x-40*pose.sx,m.y-11,80*pose.sx,22);
    m.rig=drawHamsterRig(ctx,a,{type:m.type,weapon:equippedPickaxe(s,m.type),pose,x:m.x,y:m.y,face:m.face});
    if(pose.stage==='lift'&&toHit<Math.min(.62,period*.45)*.5){
      ctx.save();ctx.strokeStyle='#fff0b4';ctx.lineWidth=3;ctx.lineCap='round';
      for(let j=0;j<2;j++){ctx.beginPath();ctx.moveTo(m.x-m.face*(48+j*7),m.y-74-j*8);ctx.lineTo(m.x-m.face*(52+j*9),m.y-81-j*10);ctx.stroke();}
      ctx.restore();
    }
  }
  drawEffects(s, dt) {
    const ctx = this.ctx, a = this.assets, motion = s.settings.motion;
    this.crateBump += dt;
    this.celebrate += dt;
    for (const p of this.parts) {
      p.t += dt;
      p.vy += 1500 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      ctx.save();
      ctx.globalAlpha = clamp((p.life - p.t) / (p.life * .35), 0, 1);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      a.draw(ctx, p.key, -p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
    this.parts = this.parts.filter(p => p.t < p.life);
    for (const f of this.fx) {
      f.t += dt;
      const t = f.t - (f.delay || 0);
      if (t < 0 || (!motion && f.type !== 'drop' && f.type !== 'gain'))
        continue;
      ctx.save();
      if (f.type === 'arc' && t < .16) {
        const m = {x:f.mx??this.miner.x,y:f.my??this.miner.y,face:f.face??this.miner.face}, k = .72 + t * 1.8;
        ctx.globalAlpha = 1 - t / .16;
        ctx.translate((m.x + f.x) / 2, (m.y + f.y) / 2 - 30);
        ctx.scale(m.face * k, k);
        a.draw(ctx, 'strike_arc', -80, -85, 160, 170);
      }
      if (f.type === 'spark' && t < .22) {
        const k = (f.big ? 76 : 58) * (.7 + t * 2.4);
        ctx.globalAlpha = 1 - t / .22;
        a.draw(ctx, 'spark', f.x - k / 2, f.y - k / 2, k, k);
      }
      if (f.type === 'bolt' && t < .28)
        this.drawBolt(f, t);
      if (f.type === 'ring' && t < .38) {
        const k = t / .38;
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#ffb347';
        ctx.lineWidth = 14 * (1 - k) + 2;
        ctx.shadowBlur = 16;
        ctx.shadowColor = '#ff8a2a';
        ctx.beginPath();
        ctx.arc(f.x, f.y, 30 + k * 150, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (f.type === 'dust' && t < .45) {
        const k = t / .45;
        ctx.globalAlpha = .35 * (1 - k);
        ctx.fillStyle = '#c9c3b4';
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(f.x + Math.cos(i * 1.6) * 40 * k, f.y + 20 + Math.sin(i * 1.6) * 18 * k, 26 + 44 * k, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (f.type === 'drop') {
        const k = Math.min(1, t / .55), [tx, ty] = CRATE.mouth;
        if (k < 1) {
          const x = f.x + (tx - f.x) * k, y = f.y + (ty - f.y) * k - 170 * Math.sin(Math.PI * k);
          ctx.translate(x, y);
          ctx.rotate(k * 6);
          a.draw(ctx, f.key||'drop_copper', -24, -24, 48, 48);
        }
        else if (!f.done) {
          f.done = true;
          this.crateBump = 0;
          // 돌이 아닌 광석은 수레 조각 한 칸을 그 종류로 바꾼다
          if (f.kind && f.kind !== 'stone')
            this.crateKinds[Math.floor(Math.random() * CRATE.pieces.length)] = f.kind;
          if (f.reward > 0)
            this.fx.push({ type: 'gain', t: 0, text: '+' + short(f.reward), key:f.key });
        }
      }
      // 루비 결정을 깼을 때: 깬 자리에서 루비 아이콘과 +N이 떠오른다
      if (f.type === 'rubygain' && t < 1.3) {
        const k = t / 1.3, y = f.y - 90 * (1 - (1 - k) ** 2);
        ctx.globalAlpha = clamp((1.3 - t) / .4, 0, 1);
        const pop = (t < .15 ? 1 + (.15 - t) * 3 : 1) * (f.big ? 1.7 : 1);
        ctx.translate(f.x, y);
        ctx.scale(pop, pop);
        a.draw(ctx, 'ruby', -62, -34, 56, 56);
        ctx.font = '900 40px HamsterKR, sans-serif';
        ctx.textAlign = 'left';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#4a0f22';
        ctx.fillStyle = '#ffc2d2';
        ctx.strokeText('+' + f.amount, -2, 8);
        ctx.fillText('+' + f.amount, -2, 8);
      }
      if (f.type === 'gain' && t < .8) {
        ctx.globalAlpha = clamp((.8 - t) / .3, 0, 1);
        const y = 1000 - t * 50;
        a.draw(ctx, f.key||'drop_copper', 572, y - 34, 40, 40);
        ctx.font = '900 34px HamsterKR, sans-serif';
        ctx.textAlign = 'left';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 7;
        ctx.strokeStyle = '#322218';
        ctx.fillStyle = '#fff4c9';
        ctx.strokeText(f.text, 616, y);
        ctx.fillText(f.text, 616, y);
      }
      ctx.restore();
    }
    // 피해 숫자는 번개·불꽃 위에 오도록 마지막에
    if (motion)
      for (const f of this.fx) {
        const t = f.t - (f.delay || 0);
        if (f.type === 'num' && t >= 0 && t < .9) {
          ctx.save();
          this.drawNumber(f, t);
          ctx.restore();
        }
      }
    this.fx = this.fx.filter(f => f.t - (f.delay || 0) < (f.type === 'drop' ? .6 : f.type === 'rubygain' ? 1.4 : 1));
  }
  // 앞 광석에서 다음 광석으로 이어지는 지그재그 번개. 몇 프레임마다 모양이 바뀐다.
  drawBolt(f, t) {
    const ctx = this.ctx, [x1, y1] = f.a, [x2, y2] = f.b;
    const len = Math.hypot(x2 - x1, y2 - y1) || 1, nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
    const flick = Math.floor(t / .045), pts = [[x1, y1]];
    for (let i = 1; i < 7; i++) {
      const off = Math.sin(f.seed + i * 12.9898 + flick * 78.233) * 43758.5453 % 1 * 22;
      pts.push([x1 + (x2 - x1) * i / 7 + nx * off, y1 + (y2 - y1) * i / 7 + ny * off]);
    }
    pts.push([x2, y2]);
    const line = () => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); };
    ctx.globalAlpha = t < .2 ? 1 : 1 - (t - .2) / .08;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = '#5cecff';
    ctx.shadowBlur = 18;
    line();
    ctx.strokeStyle = 'rgba(72,234,255,.5)';
    ctx.lineWidth = 20;
    ctx.stroke();
    line();
    ctx.strokeStyle = '#8ff3ff';
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.shadowBlur = 0;
    line();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.stroke();
  }
  drawNumber(f, t) {
    const ctx = this.ctx;
    const pop = t < .1 ? 1.45 - t * 4.5 : 1;
    const size = (f.crit ? 50 : f.chain ? 33 : 40) * pop;
    ctx.globalAlpha = clamp((.9 - t) / .3, 0, 1);
    ctx.font = '900 ' + size.toFixed(1) + 'px HamsterKR, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 8;
    ctx.strokeStyle = f.chain ? '#13374a' : '#432311';
    ctx.fillStyle = f.crit ? '#ff9a3c' : f.chain ? '#c9f7ff' : '#ffca71';
    const y = f.y - t * 80;
    ctx.strokeText(f.text, f.x, y);
    ctx.fillText(f.text, f.x, y);
  }
}
