export const VIEW={width:450,height:800};
export const WORLD={width:1400,height:1700};
export const ZOOM={min:.55,max:1.65};
export const HOME={x:700,y:865,zoom:.82};
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function constrain(camera){
 camera.zoom=clamp(camera.zoom,ZOOM.min,ZOOM.max);
 const hx=VIEW.width/(2*camera.zoom),hy=VIEW.height/(2*camera.zoom);
 camera.x=clamp(camera.x,hx,WORLD.width-hx);camera.y=clamp(camera.y,hy,WORLD.height-hy);
 return camera;
}
export function worldPoint(camera,p){return{x:camera.x+(p.x-VIEW.width/2)/camera.zoom,y:camera.y+(p.y-VIEW.height/2)/camera.zoom};}
export function screenPoint(camera,p){return{x:(p.x-camera.x)*camera.zoom+VIEW.width/2,y:(p.y-camera.y)*camera.zoom+VIEW.height/2};}
export function pan(camera,dx,dy){camera.x-=dx/camera.zoom;camera.y-=dy/camera.zoom;return constrain(camera);}
export function zoomAt(camera,scale,p){
 const before=worldPoint(camera,p);camera.zoom=clamp(camera.zoom*scale,ZOOM.min,ZOOM.max);
 const after=worldPoint(camera,p);camera.x+=before.x-after.x;camera.y+=before.y-after.y;return constrain(camera);
}
export function pinch(camera,previous,current){
 const middle=a=>({x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2});
 const distance=a=>Math.max(1,Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y));
 const from=middle(previous),to=middle(current);
 zoomAt(camera,distance(current)/distance(previous),from);pan(camera,to.x-from.x,to.y-from.y);
}
