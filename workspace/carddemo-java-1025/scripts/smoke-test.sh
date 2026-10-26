#!/usr/bin/env bash
# 端到端冒烟测试：健康探针 → 登录 → 查询 → 入账 → 授权 → 报表 → 营销
set -euo pipefail

IAM=${IAM:-http://localhost:8081}
CUSTOMER=${CUSTOMER:-http://localhost:8082}
CARD=${CARD:-http://localhost:8083}
ACCOUNT=${ACCOUNT:-http://localhost:8084}
TRANSACTION=${TRANSACTION:-http://localhost:8085}
AUTHORIZATION=${AUTHORIZATION:-http://localhost:8086}
MARKETING=${MARKETING:-http://localhost:8087}

say() { printf '\n== %s\n' "$*"; }
json() { python3 -c "import json,sys; d=json.load(sys.stdin); print(json.dumps(d, ensure_ascii=False)[:400])"; }

say "1/8 健康探针"
for svc in "$IAM" "$CUSTOMER" "$CARD" "$ACCOUNT" "$TRANSACTION" "$AUTHORIZATION" "$MARKETING"; do
  status=$(curl -sf -m 5 "$svc/actuator/health" | python3 -c "import json,sys; print(json.load(sys.stdin)['status'])")
  echo "  $svc -> $status"
done

say "2/8 登录（ADMIN001）"
curl -sf -m 5 -X POST "$IAM/api/v1/auth/login" -H 'Content-Type: application/json' \
  -d '{"userId":"admin001","password":"admin123"}' | json

say "3/8 账户 / 客户 / 卡片"
curl -sf -m 5 "$ACCOUNT/api/v1/accounts/00000000001" | json
curl -sf -m 5 "$CUSTOMER/api/v1/customers/000000001" | json
curl -sf -m 5 "$CARD/api/v1/cards/by-account/00000000001" | json

say "4/8 日终入账（金额 1.00，交易号按时间生成，可重复执行）"
TXN_ID=$(printf "%016d" "$(date +%s)")
curl -sf -m 10 -X POST "$TRANSACTION/api/v1/postings" -H 'Content-Type: application/json' -d "{
  \"transactions\":[{
    \"transactionId\":\"$TXN_ID\",
    \"cardNumber\":\"3344556677889900\",
    \"typeCode\":\"01\",\"categoryCode\":\"0001\",\"source\":\"POS TERM\",
    \"description\":\"Smoke test purchase\",\"amount\":1.00,
    \"originalTimestamp\":\"2026-10-25T10:15:00\",
    \"merchantId\":\"800000001\",\"merchantName\":\"Smoke Test\",
    \"merchantCity\":\"Springfield\",\"merchantZip\":\"10001\"}]}" | json

say "5/8 授权决策（账户 1，可用额度 80.00）"
curl -sf -m 10 -X POST "$AUTHORIZATION/api/v1/authorizations" -H 'Content-Type: application/json' -d '{
  "cardNumber":"0500024453765740","transactionAmount":10.00,
  "transactionId":"SMOKE0000000001","merchantName":"Corner Grocery"}' | json
curl -sf -m 5 "$AUTHORIZATION/api/v1/pending-authorizations/00000000001" | json

say "6/8 交易列表（前 2 条）"
curl -sf -m 5 "$TRANSACTION/api/v1/transactions?page=0&size=2" | json

say "7/8 交易报表（2026-09 闭区间）"
curl -sf -m 10 "$TRANSACTION/api/v1/reports/transactions?startDate=2026-09-01&endDate=2026-09-30" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print({k: d[k] for k in ('total','pageTotal','grandTotal')})"

say "8/8 营销：活动、活动中心、奖励与看板"
curl -sf -m 5 "$MARKETING/api/v1/campaigns" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('campaigns:', [(i['name'], i['status']) for i in d['items']])"
curl -sf -m 5 "$MARKETING/api/v1/eligibilities?accountId=00000000001&cardNumber=0500024453765740&customerId=000000001" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('offers:', [(i['name'], i['enrolled'], i['eligible']) for i in d['items']])"
curl -sf -m 5 "$MARKETING/api/v1/rewards?accountId=00000000001" | json
curl -sf -m 5 "$MARKETING/api/v1/marketing/summary" | json

printf '\n冒烟测试完成。\n'
