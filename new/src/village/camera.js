export const VIEW={width:450,height:800};
// 마을 = 화면 한 장 크기 구역(720x1280) 4개: 가운데 위 메인, 왼쪽·오른쪽·아래에 하나씩(빈 모서리는 보이지 않음).
// 가장 작게 보면 구역 하나가 화면에 꼭 맞는다.
export const WORLD={width:2160,height:2560};
export const ZOOM={min:.625,max:1.65};
// 메인 구역(광산 입구) 한가운데. 카메라는 bounds(지금 구역) 밖으로 나가지 않는다.
export const HOME={x:1080,y:640,zoom:.625,bounds:{left:720,right:1440,top:0,bottom:1280}};
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function constrain(camera){
 camera.zoom=clamp(camera.zoom,ZOOM.min,ZOOM.max);
 const b=camera.bounds??{left:0,right:WORLD.width,top:0,bottom:WORLD.height};
 const hx=VIEW.width/(2*camera.zoom),hy=VIEW.height/(2*camera.zoom);
 camera.x=clamp(camera.x,b.left+hx,b.right-hx);camera.y=clamp(camera.y,b.top+hy,b.bottom-hy);
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
