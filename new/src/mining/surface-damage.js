import {center,TILE,noise,isMineable} from './grid.js';
export function damageFrame(s,cell,breaking=false){
 const damage=cell.maxHp-cell.hp;if(!damage&&!breaking)return null;
 // Shaded surfaces retain the map's lighting direction; use authored variants.
 return {variant:Math.floor(noise(cell.id,s.seed,153)*3),stage:breaking?2:damage/cell.maxHp<.5?0:1};
}
export function damageImage(s,cell,damageTiles,breaking=false){
 const frame=damageFrame(s,cell,breaking);return frame&&damageTiles?.[s.themeId||'base']?.[frame.variant]?.[frame.stage];
}
export function paintDamageSurface(c,s,cell,damageTiles){
 if(!isMineable(cell)||cell.hp>=cell.maxHp)return false;
 const image=damageImage(s,cell,damageTiles);if(!image)return false;
 const[x,y]=center(cell.id);c.drawImage(image,x-TILE/2,y-TILE/2,TILE,TILE);return true;
}
