// Geological facts are sourced; full-map palettes and placement are game art.
// Mineral hardness does not set HP or rewards. Those remain prototype values.
export const MINERALS = {
 quartz: {name:'석영',family:'석영 · SiO₂',shape:'point',colors:['#c8d5df','#f7faf2','#91a4b6'],ink:'#71869b',fact:'무색·흰색이 흔하며, 끝이 뾰족한 육각기둥 결정으로 나타납니다.',source:'https://commonminerals.esci.umn.edu/minerals-o-s/quartz',publisher:'미네소타대학교'},
 amethyst: {name:'자수정',family:'석영의 보라색 변종',shape:'point',colors:['#aa80d0','#e8cafa','#77509c'],ink:'#6c467e',fact:'자수정은 석영의 보라색 변종으로, 육각기둥과 뾰족한 끝이 특징입니다.',source:'https://www.gia.edu/amethyst-description',publisher:'GIA'},
 pyrite: {name:'황철석',family:'황화철 · FeS₂',shape:'cube',colors:['#d3ac4f','#ffdf87','#9a772f'],ink:'#87602c',fact:'황동빛 금속 광택을 띠며 정육면체 결정과 표면의 가는 줄이 흔합니다.',source:'https://commonminerals.esci.umn.edu/minerals-o-s/pyrite',publisher:'미네소타대학교'},
 malachite: {name:'공작석',family:'구리 탄산염 광물',shape:'banded',colors:['#56a17a','#b2d792','#2d6b54'],ink:'#315d43',fact:'초록색 광물로, 띠 무늬를 가진 덩어리와 둥근 집합체로도 나타납니다.',source:'https://museum.wales/mineralogy-of-wales/database/?mineral=395&name=Malachite',publisher:'웨일스 국립박물관'},
 azurite: {name:'남동석',family:'구리 탄산염 광물',shape:'rosette',colors:['#527fc2','#a9cae9','#355289'],ink:'#354c74',fact:'푸른색 결정 집합체를 이루며, 구리 광상에서 공작석과 함께 나타날 수 있습니다.',source:'https://museum.wales/mineralogy-of-wales/database/?mineral=42',publisher:'웨일스 국립박물관'},
 fluorite: {name:'형석',family:'불화칼슘 · CaF₂',shape:'cube',colors:['#a19bcc','#d7efcc','#71659c'],ink:'#64607c',fact:'보라·초록 등 색이 다양하며 정육면체와 팔면체 결정, 색 띠가 나타납니다.',source:'https://commonminerals.esci.umn.edu/minerals-f/fluorite',publisher:'미네소타대학교'},
 rhodochrosite: {name:'능망간석',family:'망간 탄산염 · MnCO₃',shape:'roseband',colors:['#d67f98','#ffe1df','#a65274'],ink:'#98546d',fact:'분홍색에서 붉은색을 띠며, 흰색과 분홍색이 반복되는 띠 무늬가 흔합니다.',source:'https://www.gia.edu/gems-gemology/fall-2019-rhodochrosite-imitation',publisher:'GIA'},
 hematite: {name:'적철석',family:'산화철 · Fe₂O₃',shape:'metal',colors:['#73727b','#b8b7bb','#494750'],ink:'#4e3f46',fact:'금속성 회색·검은색 또는 흙 같은 적갈색이며, 가루 자국은 적갈색입니다.',source:'https://commonminerals.esci.umn.edu/minerals-g-m/hematite',publisher:'미네소타대학교'},
 aquamarine: {name:'아쿠아마린',family:'녹주석의 청록~청색 변종',shape:'column',colors:['#7fc6d0','#ddf5e7','#4f99b0'],ink:'#4d8793',fact:'녹주석의 연한 청록~청색 변종으로, 길쭉한 육각기둥 결정이 특징입니다.',source:'https://www.gia.edu/gia-website/aquamarine',publisher:'GIA'}
};

function palette(top,floor,strata,rim,ink,motif){return {top,floor,strata,rim,ink,motif};}
export const THEMES = [
 {id:'base',name:'기본 광산',title:'따뜻한 물결 광산',tag:'확정 배경',primary:null,secondary:null,pattern:'base',layout:'classic',blurb:'확정한 크림색 지면과 황토빛 바닥을 그대로 유지합니다.',palette:palette('#f4d38a','#c29260',['#805a50','#b36c4e','#ea985d'],'#fff0bd','#6d4d3b','#d9b369')},
 {id:'quartz',name:'석영',title:'우윳빛 석영굴',tag:'흰 결정 · 가는 광맥',primary:'quartz',secondary:'pyrite',pattern:'vein',layout:'chambers',blurb:'우윳빛 면과 가는 밝은 광맥, 끝이 뾰족한 결정 무리로 구분합니다.',palette:palette('#e4ded3','#9a9599',['#77717e','#aaa1ad','#c9c4c3'],'#fff8e8','#69606b','#b8b4b8')},
 {id:'amethyst',name:'자수정',title:'보랏빛 자수정굴',tag:'보라 결정 · 정동 무늬',primary:'amethyst',secondary:'quartz',pattern:'geode',layout:'ring',blurb:'보랏빛 지층에 동그란 결정 주머니와 뾰족한 결정 무리를 놓습니다.',palette:palette('#c6a7dc','#88759b',['#5d4b73','#90629c','#b782ba'],'#efd5f5','#594667','#aa8bbd')},
 {id:'pyrite',name:'황철석',title:'황동빛 황철석맥',tag:'금빛 정육면체 · 줄 무늬',primary:'pyrite',secondary:'quartz',pattern:'square',layout:'fork',blurb:'황동빛 네모 결정과 짧은 평행선, 갈라지는 광맥 길을 조합합니다.',palette:palette('#ddc081','#947e5e',['#665548','#9d8453','#c8a95e'],'#fff0bb','#64503c','#b79b58')},
 {id:'malachite',name:'공작석',title:'초록 공작석층',tag:'초록 띠 · 둥근 덩어리',primary:'malachite',secondary:'azurite',pattern:'rings',layout:'braid',blurb:'초록색 곡선 띠와 둥근 광물 덩어리, 둘로 나뉘었다 만나는 길입니다.',palette:palette('#b4d0a6','#6c9079',['#3e655b','#608c71','#89b389'],'#e2edb9','#3d6152','#8db78b')},
 {id:'azurite',name:'남동석',title:'짙푸른 남동석층',tag:'푸른 결정 꽃 · 초록 흔적',primary:'azurite',secondary:'malachite',pattern:'rosette',layout:'bays',blurb:'푸른 결정 집합체와 작은 초록 광물, 옆으로 들어간 작업 공간을 만듭니다.',palette:palette('#a6bfd8','#647e9d',['#435771','#667fac','#86a4c4'],'#dce9e8','#3c526d','#829fbe')},
 {id:'fluorite',name:'형석',title:'민트·보라 형석굴',tag:'두 색의 정육면체',primary:'fluorite',secondary:'quartz',pattern:'zones',layout:'ring',blurb:'민트와 보라색 구역이 이어지고, 네모 결정의 안쪽에도 색 띠가 보입니다.',palette:palette('#b8d8c5','#85759d',['#5c5276','#8b79b0','#a9afd0'],'#e9f0c7','#575875','#98b8b5')},
 {id:'rhodochrosite',name:'능망간석',title:'장밋빛 능망간석층',tag:'분홍·흰 띠 · 둥근 결',primary:'rhodochrosite',secondary:'quartz',pattern:'rosebands',layout:'chambers',blurb:'분홍색과 크림색 띠가 굽이치며, 둥근 단면 무늬가 반복됩니다.',palette:palette('#e5a9b6','#aa7b8a',['#80586e','#b77892','#d99aab'],'#ffe7df','#785567','#ce8b9f')},
 {id:'hematite',name:'적철석',title:'붉은 적철석층',tag:'적갈색 지면 · 회색 철광',primary:'hematite',secondary:'quartz',pattern:'iron',layout:'fork',blurb:'붉은 흙빛 층과 짙은 회색 광물을 대비하고, 붉은 가루 자국을 더합니다.',palette:palette('#cc9482','#87645f',['#574653','#8f5b61','#b77368'],'#f3cbb1','#62474a','#b67a70')},
 {id:'aquamarine',name:'아쿠아마린',title:'하늘빛 아쿠아마린굴',tag:'청록 기둥 · 길쭉한 결정',primary:'aquamarine',secondary:'quartz',pattern:'columns',layout:'braid',blurb:'옅은 청록색 면과 길쭉한 육각기둥, 가느다란 평행 무늬를 사용합니다.',palette:palette('#bfdfdf','#749ca4',['#4e7484','#78a1b2','#9fc8ca'],'#e9f6dc','#4c6c79','#96bdc3')}
];
export const getTheme=id=>THEMES.find(t=>t.id===id)??THEMES[0];
export const getMineral=id=>MINERALS[id]??null;
