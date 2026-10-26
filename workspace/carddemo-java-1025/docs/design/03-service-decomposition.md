# 微服务拆分与部署设计

## 1. 服务清单

| 服务 | 端口 | 数据库 | 核心用例 | 关键依赖 |
|---|---|---|---|---|
| web-ui | 8090 → 容器 8080 | —（静态 SPA + 同源代理） | 登录、账户视图、卡片、交易、账单支付、报表、授权、用户管理 | 全部微服务 |
| iam-service | 8081 | `carddemo_iam` | 登录、token 签发、用户 CRUD | 无 |
| customer-service | 8082 | `carddemo_customer` | 客户查询/新增/修改 | 无 |
| card-service | 8083 | `carddemo_card` | 卡列表/详情/维护、按账户查卡 | 无 |
| account-service | 8084 | `carddemo_account` | 账户查询/维护、记账、还款、利息入账 | 无 |
| transaction-service | 8085 | `carddemo_transaction` | 交易录入/查询、入账、利息、账单支付、报表、交易类型 | card、account |
| authorization-service | 8086 | `carddemo_authorization` | 授权决策、待授权汇总、欺诈标记、过期清理 | card、account、customer |
| marketing-service | 8087 | `carddemo_marketing` | 活动/报名/奖励评估/效果统计 | account |

## 2. 数据所有权

| 表 | 属主 | 说明 |
|---|---|---|
| `sec_user` | iam | 用户安全主数据 |
| `customer` | customer | 客户主数据（SSN 掩码输出） |
| `card`、`card_xref`、`card_fraud_flag`（授权侧独立表） | card / authorization | 卡主数据归 card；欺诈标记归 authorization |
| `account` | account | 余额与额度唯一权威 |
| `transaction`、`daily_transaction`、`tran_category_balance`、`tran_type`、`tran_category`、`disclosure_group` | transaction | 交易账本与参照数据 |
| `auth_summary`、`auth_detail` | authorization | 待授权汇总与明细 |
| `campaign`、`enrollment`、`reward_grant` | marketing | 活动、报名与奖励（奖励评估与幂等） |
| `reward_credit` | account | 返现入账幂等记录（rewardId 唯一） |

## 3. 服务间调用矩阵

| 调用方 → 被调方 | Card | Account | Customer | Transaction | Marketing |
|---|---|---|---|---|---|
| transaction-service | GET 卡快照 | GET 快照 / POST 记账 / POST 还款 / POST 利息 | — | — | POST 奖励评估 |
| authorization-service | GET 卡快照 | GET 快照 | GET 客户存在性 | — | — |
| marketing-service | — | GET 快照 / POST 返现入账 | — | — | — |
| account-service | — | — | — | — | — |
| card-service | — | — | — | — | — |
| customer-service | — | — | — | — | — |
| iam-service | — | — | — | — | — |

调用次数（单次业务操作）：

| 业务操作 | 调用链 | 最坏增时（本地 Compose） |
|---|---|---|
| 交易录入 | transaction → card(1) | +10ms |
| 日终入账（单笔） | transaction → card(1) + account GET(1) + account POST(1) | +30ms |
| 账单支付 | transaction → account GET(1) + account POST(1) + card(1) | +30ms |
| 利息运行 | transaction → account POST(每账户 1 次) | 账户数 × 10ms |
| 授权决策 | authorization → card(1) + account(1) + customer(1) | +30ms |
| 消费入账后奖励评估 | transaction → marketing(1)；marketing → account GET(1) + cashback POST(1) | +40ms（失败仅告警） |
| 活动中心 | marketing → account GET(1) | +10ms |

## 4. 调用与失败语义

| 下游结果 | 上游处理 |
|---|---|
| `200` | 正常继续 |
| `404` | 视为"实体不存在"：入账 → 拒付 101；授权 → 拒绝 3100；交易录入 → 400 |
| `409`（业务规则） | 透传为上游 409，携带下游 `code` 与 `message` |
| `5xx` / 超时（3s） | 抛 `RemoteServiceException` → HTTP 503 `DEPENDENCY_UNAVAILABLE`，不落账、不拒绝（授权返回 503 由调用方重试） |

**失败关闭原则**：授权场景下"无法判断额度"绝不能默认批准。

## 5. 一致性与幂等

- 账单支付：`transaction` 先落库（PENDING）→ 调 `account /payments` → 置 POSTED；失败回滚本地事务（ADR-005）。
- 入账：单笔失败记 `REJECTED` + 原因码，整批继续；返回 `COMPLETED_WITH_REJECTS`。
- 幂等键：`transactionId`（入账/录入）；`cardNumber + authTimestamp` 对应 `authorizationId`（授权）。
- 对账：日终以 `transaction` 为权威，`account.current_balance` 与"初始余额 + Σ入账 − Σ还款 + Σ利息"比对。

## 6. 部署单元

```
docker compose
├── postgres (16)                # 单实例，6 个 database（init 脚本创建）
├── iam-service        :8081
├── customer-service   :8082
├── card-service       :8083
├── account-service    :8084
├── transaction-service:8085  → 依赖 card/account healthy
├── authorization-service:8086 → 依赖 card/account/customer healthy
├── marketing-service  :8087 → 依赖 postgres healthy、account started
└── web-ui             :8090 → 宿主机 8090 映射容器 8080（宿主 8080 被占用）
```

> `web-ui` 是**表现层**，不是限界上下文：它只托管静态 SPA，并把 `/api/**` 按路径前缀同源代理到
> 6 个微服务，不拥有任何业务数据、不实现业务规则。浏览器因此只需访问一个源，无需 CORS。

启动顺序：`postgres`（healthcheck: `pg_isready`）→ 无依赖服务 → `transaction` / `authorization`。
每个服务暴露 Spring Boot Actuator `/actuator/health` 用于探活；下游客户端为懒加载，
服务启动不依赖下游可用，调用失败时返回 `503`。`docker-compose.yml` 中
`transaction`/`authorization` 对下游使用 `condition: service_started`（只保证容器已启动，
避免启动顺序导致的死锁）。

## 7. 容量与伸缩

| 服务 | 伸缩特征 | 备注 |
|---|---|---|
| authorization | 无状态、读多写少，可水平扩容；汇总行按账户存在热点 | 同一账户并发授权需串行（乐观锁重试） |
| transaction | 写多、批处理需单实例运行（避免重复入账） | 入账接口按 `transactionId` 幂等，可多实例 |
| account | 按账户热点；行级更新 | 单账户 QPS 受行锁/版本冲突限制 |
| card / customer | 读多写少 | 可加缓存（本期未做） |
| iam | 低流量 | — |

## 8. 配置项

| 变量 | 服务 | 默认 |
|---|---|---|
| `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` | 全部 | `localhost`/`5432`/`carddemo_*`/`carddemo`/`carddemo` |
| `CARD_SERVICE_URL` | transaction、authorization | `http://localhost:8083`（Compose 内 `http://card-service:8083`） |
| `ACCOUNT_SERVICE_URL` | transaction、authorization | `http://localhost:8084` |
| `CUSTOMER_SERVICE_URL` | authorization | `http://localhost:8082` |
| `MARKETING_SERVICE_URL` | transaction、web-ui | `http://localhost:8087` |
| `MARKETING_ENABLED` | transaction | `true`（关闭后不再触发奖励评估） |
| `IAM_TOKEN_SECRET` | iam | 演示密钥（生产必须从密钥管理注入） |
| `IAM_TOKEN_TTL_SECONDS` | iam | `3600` |
