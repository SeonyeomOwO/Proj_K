// Local prototype entitlements. Real purchases must be verified and timed by a server.
import {SHOP} from '../data/shop.js';
import {CONFIG as C} from '../data/config.js';
export const DAY = 86400000;
const validTime = n => Number.isSafeInteger(n) && n >= 0 && n <= 8640000000000000 - 31 * DAY;
const key = n => new Date(n).toISOString().slice(0, 10);
export const newPassState = now => ({clock: now, owned: {}});
export const passProduct = id => SHOP.passes.find(p => p.id === id);
const time = (s, now) => Math.max(validTime(now) ? now : Date.now(), s.passes?.clock || 0);

export function passStatus(s, id, now = Date.now()) {
  const record = s.passes?.owned?.[id], t = time(s, now);
  const active = !!record && record.startedAt <= t && t < record.expiresAt;
  return {active, record, remainingDays: active ? Math.ceil((record.expiresAt - t) / DAY) : 0,
    todayClaimed: !!record && record.lastClaimDay === key(t)};
}
export const hasAdFree = (s, now = Date.now()) => passStatus(s, 'monthly_adfree', now).active;
export const hasAutoUpgrade = hasAdFree;

// Reject only corrupt entitlement records, preserving the rest of a valid game save.
export function restorePasses(s, now = Date.now()) {
  const raw = s.passes, owned = {};
  for (const p of SHOP.passes) {
    const r = raw?.owned?.[p.id];
    if (!r || !validTime(r.startedAt) || !validTime(r.expiresAt) || r.expiresAt - r.startedAt !== p.days * DAY) continue;
    if (!Number.isInteger(r.claims) || r.claims < 0 || r.claims > (p.dailyClaims || 0)) continue;
    if (r.claims === 0 ? r.lastClaimDay !== null : typeof r.lastClaimDay !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.lastClaimDay) || r.lastClaimDay < key(r.startedAt) || r.lastClaimDay > key(r.expiresAt)) continue;
    owned[p.id] = {startedAt:r.startedAt, expiresAt:r.expiresAt, claims:r.claims, lastClaimDay:r.lastClaimDay};
  }
  s.passes = {clock: Math.max(validTime(now) ? now : Date.now(), validTime(raw?.clock) ? raw.clock : 0), owned};
  enforcePasses(s, now);
}

// Remember the latest observed time: moving the clock backwards cannot revive a pass.
export function enforcePasses(s, now = Date.now()) {
  s.passes ||= newPassState(now);
  s.passes.clock = time(s, now);
  if (!hasAutoUpgrade(s, now)) s.autoUpgrade = false;
}

export function toggleAutoUpgrade(s, now = Date.now()) {
  enforcePasses(s, now);
  if (!hasAutoUpgrade(s, now)) return false;
  s.autoUpgrade = !s.autoUpgrade;
  return true;
}

// Runs at login/foreground and while online. UTC midnight matches the game's daily reset.
// No backfill for absent days. Max 30 daily grants, including the purchase day.
export function syncPasses(s, now = Date.now()) {
  enforcePasses(s, now);
  const p = passProduct('monthly_diamonds'), status = passStatus(s, p.id, now), r = status.record;
  if (!status.active || r.claims >= p.dailyClaims || (r.lastClaimDay && r.lastClaimDay >= key(time(s, now)))) return 0;
  // Keep the full claim available if the wallet cannot hold all 20 diamonds.
  if (s.wallet.diamond + p.dailyDiamonds > C.walletCap) return 0;
  s.wallet.diamond += p.dailyDiamonds;
  r.claims++;
  r.lastClaimDay = key(time(s, now));
  return p.dailyDiamonds;
}

export function buyPass(s, id, now = Date.now()) {
  const p = passProduct(id);
  if (!p) return null;
  enforcePasses(s, now);
  if (passStatus(s, id, now).active || s.wallet.diamond + p.diamonds + (p.dailyDiamonds || 0) > C.walletCap) return null;
  const t = time(s, now);
  s.passes.owned[id] = {startedAt:t, expiresAt:t + p.days * DAY, claims:0, lastClaimDay:null};
  s.wallet.diamond += p.diamonds;
  const dailyDiamonds = p.dailyDiamonds ? syncPasses(s, t) : 0;
  return {product:p, diamonds:p.diamonds + dailyDiamonds, dailyDiamonds, items:[], expiresAt:s.passes.owned[id].expiresAt};
}
