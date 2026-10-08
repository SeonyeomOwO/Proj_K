// 현금 상품은 테스트 구매만 된다: 눌러서 확인 팝업 → 구매하면 돈은 오가지 않고 내용만 지급한다.
// 실제 결제는 검증된 결제 서비스를 연결한 뒤 따로 만든다.
// once: 한 번만 구매 가능. pickaxeTier: 들어 있는 곡괭이 등급(0=D, 1=C …).
// packs: 다이아 충전 상품(한 줄에 3개, 늘리면 상점이 아래로 길어져 스크롤된다). art: 상품별 전용 그림 id.
// 가격은 자리표시용 초안이다(큰 상품일수록 다이아당 값이 조금 싸다).
export const SHOP = {
  dailyDiamonds: 30,
  bundle: {id: 'starter', name: '초보 광부 꾸러미', art: 'shop_bundle', diamonds: 300, pickaxes: 3, pickaxeTier: 1, once: true, price: '₩2,900'},
  passes: [
    {id: 'monthly_diamonds', kind: 'pass', name: '매일 다이아 꾸러미', art: 'shop_monthly_diamonds', price: '₩3,900', days: 30, diamonds: 200, dailyDiamonds: 20, dailyClaims: 30},
    {id: 'monthly_adfree', kind: 'pass', name: '편안한 광부 패스', art: 'shop_monthly_adfree', price: '₩9,900', days: 30, diamonds: 0, removeAds: true, autoUpgrade: true}
  ],
  packs: [
    {id: 'gems100', name: '다이아 한 줌', art: 'shop_gems', diamonds: 100, price: '₩1,100'},
    {id: 'gems500', name: '다이아 주머니', art: 'shop_gem_bag', diamonds: 500, price: '₩5,500'},
    {id: 'gems1200', name: '다이아 보물함', art: 'shop_gem_chest', diamonds: 1200, price: '₩11,000'},
    {id: 'gems2500', name: '다이아 큰 주머니', art: 'shop_gem_bag_large', diamonds: 2500, price: '₩22,000'},
    {id: 'gems6500', name: '다이아 큰 보물함', art: 'shop_gem_chest_large', diamonds: 6500, price: '₩55,000'},
    {id: 'gems14000', name: '다이아 보물 창고', art: 'shop_gem_warehouse', diamonds: 14000, price: '₩110,000'}
  ]
};
