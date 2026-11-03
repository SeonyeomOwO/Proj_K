// Shared coordinates for terrain, navigation and loose ore. No game state here.
export const COLS=10,ROWS=17,TILE=50,ORIGIN=-25,RISE=25;
export const key=(x,y)=>y*COLS+x;
export const xy=id=>[id%COLS,Math.floor(id/COLS)];
export const center=id=>{const[x,y]=xy(id);return[ORIGIN+(x+.5)*TILE,ORIGIN+(y+.5)*TILE];};
export const isMineable=cell=>!!cell?.solid&&!cell.unbreakable;
export function hitCell(px,py){const x=Math.floor((px-ORIGIN)/TILE),y=Math.floor((py-ORIGIN)/TILE);return x<0||y<0||x>=COLS||y>=ROWS?null:key(x,y);}
export const noise=(x,y,s=0)=>{const v=Math.sin(x*127.1+y*311.7+s*13.7)*43758.5453;return v-Math.floor(v);};
export function neighbors(id){const[x,y]=xy(id);return[[x,y-1],[x+1,y],[x,y+1],[x-1,y]].filter(([a,b])=>a>=0&&b>=0&&a<COLS&&b<ROWS).map(([a,b])=>key(a,b));}
