import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campaign, calculateCashback, runCashbackChecks } from '../src/cashback.js';
const input = { amountCents: 12000, cardTier: 'platinum' as const, purchasedAt: campaign.purchaseAt };
test('all seven executable cashback acceptance checks pass', () => {
  const results = runCashbackChecks(); assert.equal(results.length, 7); assert.ok(results.every(item => item.passed));
});
test('0.5 percent is additional cashback and integer rounding is stable over 100001 amounts', () => {
  assert.equal(calculateCashback(input).rewardCents, 60);
  for (let amountCents = 1; amountCents <= 100001; amountCents++) assert.equal(calculateCashback({ ...input, amountCents }).rewardCents, Math.floor(amountCents / 200 + 0.5));
  const maximum = Number.MAX_SAFE_INTEGER;
  assert.equal(calculateCashback({ ...input, amountCents: maximum }).rewardCents, Number((BigInt(maximum) + 100n) / 200n));
});
test('card and time boundaries enforce eligibility including UTC equivalents', () => {
  assert.equal(calculateCashback({ ...input, cardTier: 'standard' }).eligible, false);
  assert.equal(calculateCashback({ ...input, purchasedAt: '2026-10-31T15:59:59.999Z' }).eligible, false);
  assert.equal(calculateCashback({ ...input, purchasedAt: '2026-10-31T16:00:00Z' }).eligible, true);
  assert.equal(calculateCashback({ ...input, purchasedAt: '2027-01-31T15:59:59.999Z' }).eligible, true);
  assert.equal(calculateCashback({ ...input, purchasedAt: '2027-01-31T16:00:00Z' }).eligible, false);
});
test('invalid inputs are rejected rather than coerced', () => {
  for (const amountCents of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => calculateCashback({ ...input, amountCents }), RangeError);
  for (const purchasedAt of ['invalid', '2026-11-15', '2026-11-15T12:00:00', '2026-99-15T12:00:00Z', '2026-11-31T12:00:00Z']) assert.throws(() => calculateCashback({ ...input, purchasedAt }), RangeError);
  assert.throws(() => calculateCashback({ ...input, cardTier: 'gold' as any }), RangeError);
});
