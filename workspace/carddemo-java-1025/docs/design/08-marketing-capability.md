# 新增能力设计：信用卡营销（Marketing）

> 定位：存量 CardDemo 没有任何营销能力，这是**新增支撑域**，不是遗留迁移项。
> 目标：让发卡行可以配置营销活动、让持卡人报名参与、消费后自动返现/积分，并可查看活动效果。
> 关联：ADR-009（奖励评估与入账集成方式）、`05-api-catalog.md` §8、`02-bounded-contexts.md` §2.7。

## 1. 业务场景

| 场景 | 活动类型 | 规则 | 奖励 | 是否需要报名 |
|---|---|---|---|---|
| S1 开卡首刷礼 | `FIRST_PURCHASE_CASHBACK` | 活动期内首笔消费 ≥ 100 | 固定返现 20 | 否（自动） |
| S2 餐饮消费返现 | `CATEGORY_CASHBACK` | 餐饮类（类别 0001）单笔 ≥ 50，返 5%，单笔上限 30，每卡最多 5 次 | 比例返现 | 是 |
| S3 现金预支双倍积分 | `POINTS_MULTIPLIER` | 现金预支（类别 0002）积分 2 倍，每卡最多 10 次 | 积分 | 否 |
| S4 双十一餐饮加码 | `CATEGORY_CASHBACK` | 11/01–11/15 餐饮返 10%，单笔上限 50 | 比例返现 | 是（草稿，演示发布流程） |

**为什么是这四个**：覆盖"固定金额 / 比例封顶 / 积分倍数"三种计价方式，以及"报名制 / 自动参与"
两种参与方式；S4 用来演示 `DRAFT → ACTIVE → PAUSED → ENDED` 生命周期。

**明确不做**（写入 §8 延后项）：分期手续费优惠（需要分期能力）、优惠券核销、积分兑换商城、
人群画像/个性化推荐、跨活动互斥编排、预算实时熔断以外的风控。

## 2. 领域模型

### 2.1 聚合与不变量

| 聚合根 | 关键字段 | 不变量 |
|---|---|---|
| `Campaign` | 名称、类型、状态、起止时间、目标账户组、类别码、最低金额、返现率/固定额/积分倍数、单笔上限、每卡次数、预算、已消耗、是否需报名 | 名称必填 ≤80；`startAt < endAt`；类型与计价字段匹配；状态迁移合法；`consumedAmount ≤ budget`；预算耗尽不再发奖 |
| `Enrollment` | 活动、卡号、账户、客户、报名时间 | 同一活动同一卡号唯一 |
| `RewardGrant` | 活动、交易号、卡号、账户、客户、奖励类型/金额/积分、状态、失败原因 | 同一活动同一交易号唯一（幂等）；现金返现必须最终 `GRANTED` 或可重试 `PENDING` |

状态机（`CampaignStatus`）：

```
DRAFT --activate--> ACTIVE --pause--> PAUSED --activate--> ACTIVE
ACTIVE/PAUSED --end--> ENDED
（ENDED 为终态；只有 DRAFT 可编辑规则）
```

### 2.2 计价规则

```
CASHBACK:
  fixedRewardAmount > 0 时：reward = fixedRewardAmount
  否则：reward = round(transactionAmount × rewardRate, 2)
  若 maxRewardPerTransaction 非空：reward = min(reward, maxRewardPerTransaction)
POINTS:
  points = floor(transactionAmount × pointsMultiplier)
奖励必须 > 0，否则不发放。
```

### 2.3 资格判定顺序（MK-ELI）

1. 活动状态为 `ACTIVE` 且当前时间在 `[startAt, endAt)`（MK-ELI-01）
2. 账户状态为 `Y`（MK-ELI-02）
3. 目标账户组为空或等于账户 `groupId`（MK-ELI-03）
4. 类别码为空或等于交易类别（MK-ELI-04）
5. 交易金额 ≥ `minTransactionAmount`（MK-ELI-05）
6. 需报名时存在该卡报名记录（MK-ELI-06）
7. 该卡在本活动的已发奖励次数 < `maxRewardsPerCard`（MK-ELI-07）
8. `FIRST_PURCHASE_CASHBACK` 要求该卡在本活动无历史奖励（MK-ELI-08）
9. 现金返现预算剩余 ≥ 本次奖励（MK-ELI-09）

命中第一个不满足的条件即返回原因码；活动中心页对用户展示原因文案。

## 3. 限界上下文与集成

- 新上下文 **Marketing**（支撑域），服务 `marketing-service` :8087，数据库 `carddemo_marketing`。
- 上游依赖：Account（账户组、账户状态、返现入账）。
- 下游调用方：Transaction（消费入账后触发奖励评估）、Web UI（活动/奖励/活动管理）。
- 不在 Marketing 保存账户余额或交易账本：奖励金额由 Marketing 计算，**入账由 Account 执行**。

### 3.1 集成时序（消费入账 → 返现）

```
Transaction.posting
  └─ 本地事务提交（交易 + 类别累计 + 账户余额）
       └─ 同步调用 POST /api/v1/reward-evaluations（2s 超时，失败仅告警）
            └─ Marketing 计算奖励 → 保存 RewardGrant(PENDING)
                 └─ 调 Account POST /accounts/{id}/cashback-credits（幂等键 rewardId）
                      └─ 成功：RewardGrant=GRANTED；失败：保持 PENDING，可人工重试
```

- 奖励评估失败**不回滚入账**：消费是事实，营销是附加权益（ADR-009）。
- 幂等：`(campaign_id, transaction_id)` 唯一；Account 侧 `reward_credit.reward_id` 唯一。
- 人工重试：`POST /api/v1/rewards/{rewardId}/fulfill`。

## 4. API（详见 05-api-catalog §8）

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/v1/campaigns?status=&page=&size=` | 活动列表 |
| GET | `/api/v1/campaigns/{id}` | 活动详情 |
| POST | `/api/v1/campaigns` | 新建（DRAFT） |
| PUT | `/api/v1/campaigns/{id}` | 编辑（仅 DRAFT） |
| POST | `/api/v1/campaigns/{id}/activate` / `pause` / `end` | 状态迁移 |
| GET | `/api/v1/campaigns/{id}/performance` | 活动效果（报名数/发奖数/返现额/预算使用率） |
| POST | `/api/v1/campaigns/{id}/enrollments` | 报名（幂等） |
| GET | `/api/v1/campaigns/{id}/enrollments` | 报名列表 |
| GET | `/api/v1/eligibilities?cardNumber=&accountId=&customerId=` | 活动中心：可参与活动与原因 |
| POST | `/api/v1/reward-evaluations` | 奖励评估（交易入账后调用，幂等） |
| GET | `/api/v1/rewards?accountId=&cardNumber=&page=&size=` | 奖励记录 |
| POST | `/api/v1/rewards/{id}/fulfill` | 重试返现入账 |
| GET | `/api/v1/marketing/summary` | 首页看板汇总 |

## 5. 数据模型

```sql
campaign(campaign_id PK, name, description, campaign_type, status, start_at, end_at,
         target_group_id, category_code, min_transaction_amount, reward_rate,
         fixed_reward_amount, max_reward_per_transaction, max_rewards_per_card,
         budget, consumed_amount, points_multiplier, enrollment_required,
         created_at, updated_at, version)
enrollment(enrollment_id PK, campaign_id, card_number, account_id, customer_id,
           enrolled_at, version, UNIQUE(campaign_id, card_number))
reward_grant(reward_id PK, campaign_id, transaction_id, card_number, account_id, customer_id,
             reward_type, reward_amount, reward_points, status, failure_reason,
             created_at, granted_at, version, UNIQUE(campaign_id, transaction_id))
```

Account 侧新增（保证返现幂等）：

```sql
reward_credit(reward_id PK, account_id, campaign_id, amount, created_at)
```

## 6. 前后台改造清单

### 6.1 后台（服务）

| 模块 | 改动 |
|---|---|
| 新增 marketing-service | 活动、报名、奖励、效果查询；AccountClient |
| account-service | 新增 `POST /api/v1/accounts/{id}/cashback-credits`（幂等返现入账）+ `reward_credit` 表 |
| transaction-service | `PostingService` 入账成功后调用营销评估（2s 超时，失败告警不回滚）+ `MarketingClient` |
| web-ui | 代理营销路径；新增「活动中心」「我的奖励」「活动管理」页面 |
| docker-compose | 新增 marketing-service（8087）、初始化 `carddemo_marketing` 库、注入服务地址 |

### 6.2 前台（Web 界面）

| 页面 | 角色 | 功能 |
|---|---|---|
| 活动中心 `#/offers` | 全部 | 按账户/卡查看可参与活动、资格原因、报名按钮、已报名状态 |
| 我的奖励 `#/rewards` | 全部 | 奖励记录（返现/积分）、状态、失败重试 |
| 活动管理 `#/campaigns` | 管理员 | 列表、新建、编辑草稿、发布/暂停/结束、效果指标 |
| 首页 | 全部 | 新增营销入口卡片 |

## 7. 指标与验收

| 指标 | 口径 | 验收 |
|---|---|---|
| 报名转化率 | 报名数 / 曝光活动数 | 活动详情可见 |
| 奖励成本 | Σ 已发放返现 | 预算使用率 ≤ 100% |
| 发放成功率 | GRANTED / (GRANTED+PENDING+FAILED) | ≥ 99%（演示环境 100%） |
| 幂等性 | 同一交易重复评估 | 只产生 1 条奖励、只入账 1 次 |
| 隔离性 | 营销不可用 | 入账成功、奖励可重试 |

## 8. 延后项与风险

| 项 | 说明 |
|---|---|
| 分期手续费优惠 | 需要先有分期能力 |
| 积分兑换/商城 | 需要积分账户与核销 |
| 人群分层/个性化 | 需要客户标签平台 |
| 活动互斥与叠加策略 | 当前允许叠加（S1+S2 可同时触发），生产需按业务确认 |
| 预算并发 | `@Version` + 条件更新，极端并发下可能超发 1 笔，需对账 |
| 事件化 | 当前同步调用；后续改为 Outbox → MQ，见 ADR-009 |
