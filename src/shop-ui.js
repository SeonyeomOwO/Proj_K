import {CONFIG as C, TIERS} from '../data/config.js';
import {SHOP} from '../data/shop.js';
import {passStatus} from './pass-state.js';

const art = (id, cls = '') => `<span class="shop-art ${cls}" data-icon="${id}" data-width="520" data-height="400"></span>`;
const icon = id => `<span class="icon" data-icon="${id}"></span>`;
const button = (act, label, cls = 'shop-button', extra = '') => `<button type="button" class="${cls}" data-act="${act}" ${extra}>${label}</button>`;
const section = title => `<h3 class="shop-section">${title}</h3>`;
const num = n => n.toLocaleString('en-US');
// 버튼 글자는 두 줄: 큰 제목 + 작은 줄(비용·남은 횟수)
const two = (title, sub) => '<span class="bl">' + title + '</span><span class="bs">' + sub + '</span>';
// 상품 카드와 구매 팝업에서 같은 전용 아이콘을 사용한다.
const packArt = p => art(p.art);

// 보이는 버튼은 전부 눌러지는 상태로 둔다. 조건이 안 맞으면(재화 부족·이미 구매 등) 눌렀을 때 이유를 알려 준다(app.js의 핸들러).
// 매일 무료 선물 줄은 없앴다(매일 다이아는 30일 이용권이 준다). 엔진의 claimShopGift는 남아 있지만 화면에서 부르지 않는다.
function bundle(s) {
  const p = SHOP.bundle, bought = !!s.purchases?.[p.id];
  return `<section class="shop-bundle"><h3 class="shop-title">${p.name}</h3>${bought ? '' : '<span class="shop-ribbon">첫 구매</span>'}
    ${art(p.art, 'bundle-art')}<div class="shop-rewards">
      <div class="shop-reward">${art('shop_gems')}<b>${p.diamonds}</b></div>
      <div class="shop-reward">${icon('pickaxe_a')}<b>${p.pickaxes}</b></div>
    </div>${button('shop-product', bought ? '구매 완료' : p.price, 'shop-button bundle-price', `data-id="${p.id}" aria-label="${p.name} ${bought ? '구매 완료' : p.price + ' 구매하기'}"`)}
  </section>`;
}

// 곡괭이 1뽑 버튼은 순서대로 바뀐다: 오늘 무료 1회 → 광고 시청(하루 2번) → 다이아 1회. 10뽑은 따로 다이아로만.
export function pickaxeStep(s) {
  if (s.daily.free < C.dailyFreeDraws) return {id: 'free', label: two('무료 뽑기', '오늘 1회'), cls: 'shop-button'};
  const ads = C.dailyAdDraws - s.daily.ads;
  if (ads > 0) return {id: 'ad', label: two('광고 뽑기', '<img class="ad-play" src="assets/shop/parts/icon-ad-play.svg" alt="" aria-hidden="true" width="100" height="80">' + ads + '/' + C.dailyAdDraws + ' 남음'), cls: 'shop-button ad-draw'};
  return {id: 'diamond', label: two('1회 뽑기', icon('diamond') + num(C.drawCost)), cls: 'shop-button blue'};
}

// 상품 카드는 [제목] [그림 + 확률 보기] [아래 버튼 한 줄] 세 칸을 위에서 아래로 쌓는다. 칸마다 자기 자리가 있어 서로 겹치지 않는다.
function pickaxes(s) {
  const step = pickaxeStep(s), many = C.drawCost * C.multiDraw;
  return `<section class="shop-supply pickaxe-supply"><h3 class="shop-title">곡괭이 상자</h3>
    <div class="shop-stage">${art('shop_pickaxe_box')}${button('rates', 'ⓘ 확률 보기', 'shop-rate', 'aria-label="곡괭이 뽑기 확률 보기"')}</div>
    <div class="shop-bottom"><div class="shop-actions">${button('draw', step.label, step.cls, `data-id="${step.id}"`)}
    ${button('draw', two(C.multiDraw + '회 뽑기', icon('diamond') + num(many)), 'shop-button blue', `data-id="diamond10" aria-label="다이아 ${num(many)}로 곡괭이 ${C.multiDraw}회 뽑기"`)}</div></div>
  </section>`;
}

function hamsters() {
  const many = C.hamsterDrawCost * C.multiDraw;
  return `<section class="shop-supply hamster-supply"><h3 class="shop-title">햄찌단 모집</h3>
    <div class="shop-stage">${art('shop_hamster_box')}${button('hamster-rates', 'ⓘ 확률 보기', 'shop-rate', 'aria-label="햄찌 뽑기 확률 보기"')}</div>
    <div class="shop-bottom"><div class="shop-actions">${button('hamster-draw', two('1회 모집', icon('diamond') + num(C.hamsterDrawCost)), 'shop-button blue', `data-id="1" aria-label="다이아 ${C.hamsterDrawCost}로 햄찌 1회 모집"`)}
    ${button('hamster-draw', two(C.multiDraw + '회 모집', icon('diamond') + num(many)), 'shop-button blue', `data-id="${C.multiDraw}" aria-label="다이아 ${num(many)}로 햄찌 ${C.multiDraw}회 모집"`)}</div></div>
  </section>`;
}

// 카드 하나 = [이름] + [금테 두른 그림 칸] + [다이아 수량] + [가격 버튼] (레퍼런스의 상품 카드 구성)
function diamonds() {
  return `<div class="shop-packs">${SHOP.packs.map(p => button('shop-product', '<span class="pack-name">' + p.name + '</span><span class="pack-frame">' + packArt(p) + '</span><b>' + icon('diamond') + num(p.diamonds) + '</b><span class="shop-pack-price">' + p.price + '</span>', 'shop-pack', `data-id="${p.id}" aria-label="${p.name} ${p.diamonds}개 ${p.price} 구매하기"`)).join('')}</div>`;
}
export function shopBody(s) {
  return `<div class="shop-content">${bundle(s)}${SHOP.passes.map(p => passCard(p, s)).join('')}${section('광산 보급소')}
    <div class="shop-supply-grid">${pickaxes(s)}${hamsters()}</div>
    ${section('다이아 충전')}${diamonds()}
    <p class="shop-note">현금 상품은 테스트 구매예요 · 실제 결제는 되지 않아요</p></div>`;
}
const contents = p => `다이아 ${num(p.diamonds)}개${p.pickaxes ? ' · ' + TIERS[p.pickaxeTier ?? 0] + '등급 곡괭이 ' + p.pickaxes + '개' : ''}`;

// 테스트 구매 팝업: 먼저 "구매하시겠습니까?"를 묻고, 구매하면 받은 것을 보여 준다.
export function productBody(p, s, result = null) {
  if (!p) return '';
  if (p.kind === 'pass') return passDetail(p, s, result);
  if (result)
    return `<div class="shop-product-detail">${packArt(p)}<h3>구매 완료!</h3><p>${contents(p)}을(를) 받았어요.</p><small>테스트 구매라 실제 결제는 이루어지지 않았어요.</small></div>${button('close', '확인', 'cta')}`;
  const bought = p.once && s.purchases?.[p.id];
  return `<div class="shop-product-detail">${packArt(p)}<h3>${p.name}</h3><p>${contents(p)}</p><b>${p.price}</b>
    ${bought ? '<p>이미 구매한 상품이에요.</p>' : '<p>테스트 상품을 구매하시겠습니까?</p><small>실제 결제는 이루어지지 않아요.</small>'}</div>
    ${bought ? button('close', '확인', 'cta') : button('shop-buy', '구매하기', 'cta', `data-id="${p.id}"`) + button('close', '취소', 'cta secondary')}`;
}

function passCard(p, s) {
  const st = passStatus(s, p.id), gem = !!p.dailyDiamonds;
  const note = gem ? (st.active ? st.todayClaimed ? '오늘 다이아 20개 지급 완료' : st.record.claims >= p.dailyClaims ? '일일 보상 30회 지급 완료' : '접속 보상 지급 대기' : '구매 당일 포함 · 30일간 최대 800개') : '보상 광고도 시청 없이 바로 받기';
  return `<section class="shop-bundle shop-pass ${gem ? 'diamond-pass' : 'comfort-pass'}" aria-label="${p.name}">
    <span class="pass-badge">30일 이용권</span><h3 class="shop-title">${p.name}</h3>
    ${art(p.art, 'pass-art')}<div class="pass-benefits">${gem ?
      `<div class="pass-benefit"><small>구매 즉시</small>${art('pass_instant_gems', 'benefit-art')}<strong>200</strong></div><div class="pass-benefit"><small>매일 접속</small>${art('pass_daily_gems', 'benefit-art')}<strong>20</strong></div>` :
      `<div class="pass-benefit">${art('pass_no_ads', 'benefit-art')}<strong>광고 완전 제거</strong></div><div class="pass-benefit">${art('pass_auto_upgrade', 'benefit-art')}<strong>자동 강화 해제</strong></div>`}</div>
    <p class="pass-note">${note}</p>
    ${button('shop-product', st.active ? `이용 중 · ${st.remainingDays}일 남음` : `${p.price}<small> / 30일</small>`, 'shop-button bundle-price', `data-id="${p.id}" aria-label="${p.name} ${st.active ? '이용 내역 보기' : p.price + ' 구매하기'}"`)}
  </section>`;
}

function passDetail(p, s, result) {
  const st = passStatus(s, p.id), gem = !!p.dailyDiamonds;
  const expiry = st.active ? new Date(st.record.expiresAt).toLocaleString('ko-KR', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}) : '';
  const benefits = gem ? '<b>즉시 200 + 매일 20 다이아</b><p>구매 당일에도 20개를 받아요.<br>접속한 날 자동 지급 · 일일 보상 최대 30회</p><small>미접속일 보상은 지급되지 않아요.<br>일일 보상은 한국 시간 오전 9시에 갱신돼요.</small>' : '<b>광고 완전 제거 + 자동 강화</b><p>광고 보상은 시청 없이 바로 받아요.<br>메인 화면에서 자동 강화를 켤 수 있어요.</p><small>광고 보상의 하루 횟수는 그대로예요.<br>이용 기간이 끝나면 자동 강화가 잠겨요.</small>';
  return `<div class="shop-product-detail pass-detail">${packArt(p)}<h3>${result ? '구매 완료!' : p.name}</h3>${benefits}
    ${result && gem ? '<p class="pass-receipt">구매 보상 200 + 오늘 보상 20 = <strong>220개 지급!</strong></p>' : ''}
    ${st.active ? `<p class="pass-valid">이용 중 · ${st.remainingDays}일 남음<br><small>${expiry} (한국 시간)까지</small></p>` : `<b>${p.price} / 30일</b>`}
    <small>구매일부터 30일 · 자동 결제 없음<br>테스트 구매이며 실제 결제는 이루어지지 않아요.</small></div>
    ${st.active ? button('close', '확인', 'cta') : button('shop-buy', '30일 이용권 구매하기', 'cta', `data-id="${p.id}"`) + button('close', '취소', 'cta secondary')}`;
}
