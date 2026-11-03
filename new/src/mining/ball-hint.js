import {canEat} from './care.js';
import {ballSpeed} from './ball.js';

// 공 안내 연출(그리기 전용, 게임 상태는 바꾸지 않는다).
// 먹일 수 있는 햄찌가 잠들어 있고 공에 씨앗이 남아 있으면, 멈춰 있는 공이 주기적으로 '또잉' 튀어 올랐다가 쫀득하게 떨어진다.
// 글 안내 없이 "이 공을 굴려야 하는구나"를 보여 주는 용도. 움직임 줄이기에서는 튀지 않고 빛만 맥박친다.
export const BALL_HINT={period:2.4,height:17};
// 시간, 들림(px, 위쪽 +), 가로 배율, 세로 배율: 웅크림 → 쭉 늘어나며 점프 → 꼭대기 → 늘어나며 낙하 → 납작 착지 → 두 번 작게 출렁
const KEYS=[
 [0,0,1,1],[.10,0,1.16,.84],[.22,.7,.88,1.14],[.34,1,.97,1.03],[.46,.38,.9,1.12],
 [.52,0,1.22,.8],[.62,.12,.93,1.07],[.72,0,1.06,.95],[.82,0,.98,1.02],[.9,0,1,1]
];
const ease=x=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};

export function needsFeeding(s){
 return s.phase==='mining'&&!s.aim&&!!s.ball&&!ballSpeed(s.ball)&&s.ball.seeds>0&&s.crew.some(h=>h.sleeping&&canEat(h));
}
export function ballHint(s,reduced=false){
 if(!needsFeeding(s))return null;
 if(reduced)return{lift:0,sx:1,sy:1,glow:.3+.25*Math.sin(s.time*4)};
 const t=s.time%BALL_HINT.period,last=KEYS.at(-1)[0];
 if(t>=last)return{lift:0,sx:1,sy:1,glow:0};
 let i=1;while(KEYS[i][0]<t)i++;
 const a=KEYS[i-1],b=KEYS[i],k=ease((t-a[0])/(b[0]-a[0])),mix=(j)=>a[j]+(b[j]-a[j])*k;
 return{lift:mix(1)*BALL_HINT.height,sx:mix(2),sy:mix(3),glow:t<.6?.35:0};
}
