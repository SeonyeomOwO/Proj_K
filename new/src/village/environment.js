// Scenery is separate from the terrain plates, so zoom, depth sorting and later placement edits keep working.
// Local coordinates use a 720 x 1280 zone. The side passages at y=810..950 stay open.
const tree=(id,x,y,w,h)=>({id,x,y,w,h,tree:true});
const prop=(id,x,y,w,h)=>({id,x,y,w,h});
// 배치 원칙(2026-11-05): 큰 나무는 화면 가장자리·위아래 칸 뒤에서 구역 테두리를 감싸고, 바위·덤불은 길과 건물 사이 빈 풀밭에
// 띄엄띄엄(서로·건물·팻말과 겹치지 않게) 놓는다. 길 위·문 앞·팻말 자리는 비워 둔다.
const HUB=[
 tree('tree-olive',25,185,265,300),tree('tree-lime',345,110,230,265),tree('tree-olive',720,205,285,315),
 tree('tree-lime',-90,705,230,280),tree('tree-olive',820,700,280,310),
 tree('tree-olive',10,1460,350,310),tree('tree-lime',705,1475,365,325),
 prop('bush-daisies',22,560,118,86),prop('bush-daisies',700,575,124,90),
 prop('boulder',58,742,70,51),prop('boulder',664,752,64,47),
 prop('bush-daisies',600,1215,100,74),prop('boulder',150,1235,84,62),
];
const WELL=[
 tree('tree-pink',40,295,290,340),tree('tree-pink',690,340,310,370),
 tree('tree-pink',-65,1230,260,265),tree('tree-pink',790,1065,300,350),
 tree('tree-pink',35,1460,340,345),tree('tree-pink',735,1470,360,355),
 prop('bush-daisies',150,392,126,92),prop('bush-daisies',575,410,126,92),
 prop('bush-daisies',26,640,110,82),prop('boulder',704,632,70,52),
 prop('boulder',170,560,66,48),
 prop('bench-honey',590,1010,150,103),prop('boulder',112,1085,80,58),
];
const TOTEM=[
 tree('tree-olive',130,190,275,305),tree('tree-lime',390,135,275,300),tree('tree-olive',710,220,285,320),
 tree('tree-lime',800,690,280,310),tree('tree-olive',710,1435,355,355),tree('tree-lime',5,1455,290,300),
 prop('bush-daisies',395,455,96,72),prop('bush-daisies',112,700,104,78),
 prop('boulder',460,1105,74,54),prop('bush-daisies',590,1205,110,82),prop('boulder',95,1210,80,60),
];
export const SCENERY_BY_ZONE={hub:HUB,well:WELL,totem:TOTEM,arena:[]};
export function sceneryFor(zones){
 return zones.flatMap(z=>(SCENERY_BY_ZONE[z.id]??[]).map((p,i)=>({...p,x:p.x+z.left,y:p.y+z.top,zone:z.id,phase:i*1.71+z.no})));
}
