/** Local workflow contract. Dates and rounding are fixture assumptions, not approved production policy. */
export const campaign = Object.freeze({
  id: 'platinum-extra-cashback-v1',
  start: '2026-11-01T00:00:00+08:00',
  endExclusive: '2027-02-01T00:00:00+08:00',
  purchaseAt: '2026-11-15T12:00:00+08:00',
  extraBasisPoints: 50,
  origin: 'fixture' as const,
});
export interface PurchaseInput { amountCents: number; cardTier: 'platinum' | 'standard'; purchasedAt: string }
export interface CashbackResult { eligible: boolean; rewardCents: number; reason: 'ELIGIBLE' | 'CARD_TIER' | 'OUTSIDE_WINDOW' }
export function calculateCashback(input: PurchaseInput): CashbackResult {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw new RangeError('消费金额必须为正整数分');
  if (!['platinum', 'standard'].includes(input.cardTier)) throw new RangeError('卡片等级无效');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(input.purchasedAt)) throw new RangeError('消费时间必须包含时区');
  const date = input.purchasedAt.slice(0, 10);
  const calendarDay = Date.parse(date + 'T00:00:00Z');
  if (!Number.isFinite(calendarDay) || new Date(calendarDay).toISOString().slice(0, 10) !== date) throw new RangeError('消费日期无效');
  const instant = Date.parse(input.purchasedAt);
  if (!Number.isFinite(instant)) throw new RangeError('消费时间无效');
  if (input.cardTier !== 'platinum') return { eligible: false, rewardCents: 0, reason: 'CARD_TIER' };
  if (instant < Date.parse(campaign.start) || instant >= Date.parse(campaign.endExclusive)) return { eligible: false, rewardCents: 0, reason: 'OUTSIDE_WINDOW' };
  // 0.5% = 1/200. Integer half-up rounding avoids floating-point amount drift.
  const rewardCents = Number((BigInt(input.amountCents) + 100n) / 200n);
  return { eligible: true, rewardCents, reason: 'ELIGIBLE' };
}

export interface CashbackCheck { id: string; label: string; expected: string; actual: string; passed: boolean }
export function runCashbackChecks(): CashbackCheck[] {
  const valid = { amountCents: 12000, cardTier: 'platinum' as const, purchasedAt: campaign.purchaseAt };
  const examples: Array<{ id: string; label: string; input: PurchaseInput; expected: number }> = [
    { id: 'CB-01', label: '白金卡消费 120 元', input: valid, expected: 60 },
    { id: 'CB-02', label: '普通卡不参与', input: { ...valid, cardTier: 'standard' }, expected: 0 },
    { id: 'CB-03', label: '活动开始时刻包含在内', input: { ...valid, purchasedAt: campaign.start }, expected: 60 },
    { id: 'CB-04', label: '结束前一毫秒有效', input: { ...valid, purchasedAt: new Date(Date.parse(campaign.endExclusive) - 1).toISOString() }, expected: 60 },
    { id: 'CB-05', label: '活动结束时刻不参与', input: { ...valid, purchasedAt: campaign.endExclusive }, expected: 0 },
    { id: 'CB-06', label: '半分按分四舍五入', input: { ...valid, amountCents: 100 }, expected: 1 },
  ];
  const results = examples.map(item => { const result = calculateCashback(item.input); return { id: item.id, label: item.label, expected: `${item.expected} 分`, actual: `${result.rewardCents} 分`, passed: result.rewardCents === item.expected }; });
  let rejected = false;
  try { calculateCashback({ ...valid, amountCents: 0 }); } catch (error) { rejected = error instanceof RangeError; }
  return [...results, { id: 'CB-07', label: '零金额拒绝计算', expected: '拒绝', actual: rejected ? '拒绝' : '未拒绝', passed: rejected }];
}
