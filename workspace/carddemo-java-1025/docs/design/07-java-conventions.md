# Java 编码与分层规范（新工程统一基线）

本规范是 `carddemo-java-1025` 全部微服务的实现基线。每个服务的代码必须可独立构建、独立镜像、独立数据库。

## 1. 技术基线

| 项 | 取值 |
|---|---|
| JDK | 21 |
| 框架 | Spring Boot 3.3.6（Web / Data JPA / Validation / Actuator） |
| 构建 | Maven 多模块，父 POM `com.carddemo:carddemo-java:1.0.0-SNAPSHOT` |
| 数据库 | PostgreSQL 16（Docker）/ H2（单元测试、`local` profile），每个服务一个 database（含 `carddemo_marketing`） |
| 迁移 | Flyway，脚本位于 `src/main/resources/db/migration` |
| 测试 | JUnit 5 + AssertJ + MockMvc + H2 |
| 端口 | iam 8081 / customer 8082 / card 8083 / account 8084 / transaction 8085 / authorization 8086 / marketing 8087 / web-ui 8090 |

## 2. 包结构与分层

```
com.carddemo.<context>
├── <Context>Application.java        # 启动类
├── interfaces/rest                  # 入站适配器：Controller、请求/响应 DTO
├── application                      # 应用服务：用例编排、事务边界
├── domain
│   ├── model                        # 聚合根、实体、值对象、领域行为
│   ├── repository                   # 仓储端口（纯接口，不依赖框架）
│   └── exception                    # 领域异常（BusinessRuleException / NotFoundException）
└── infrastructure
    ├── persistence                  # Spring Data 仓储适配器
    ├── client                       # 出站适配器：调用其他微服务
    └── config                       # 配置类
```

依赖方向：`interfaces → application → domain ← infrastructure`。domain 不依赖 Spring Web、
不依赖其他服务；infrastructure 实现 domain 定义的端口。

## 3. 命名与建模约定

- 聚合根用领域语言命名：`Account`、`Card`、`Customer`、`TransactionRecord`、`AuthorizationCase`。
- 领域行为写在实体上（充血模型）：`account.applyPosting(amount)`，不在 Service 里堆 setter。
- 领域异常只表达业务断言的失败：`throw new BusinessRuleException("CODE", "message")`。
- 服务间调用失败抛 `RemoteServiceException`（`503`），不得吞异常。
- **遗留系统标识一律使用零填充字符串**：`accountId` 11 位、`cardNumber` 16 位、
  `customerId` 9 位、`transactionId` 16 位。绝不使用 `long`，否则丢失前导零。
- 金额统一 `BigDecimal`，数据库 `numeric(12,2)`，禁止 `double`。
- 日期 `LocalDate`（`YYYY-MM-DD`），时间戳 `LocalDateTime`。
- 状态码保持遗留取值：`Y/N`（账户/卡状态）、`A/U`（用户类型）、`00/05`（授权响应码）。

## 4. REST 约定

- 基础路径 `/api/v1/<资源复数>`；内部服务间调用同一套 API，不加 `/internal` 前缀。
- 请求/响应 DTO 使用 Java `record`，请求 DTO 上加 Jakarta Validation 注解。
- 列表接口统一返回 `{"items": [...]}`（分页接口额外返回 `page`、`size`、`total`）。
- 时间字段 ISO-8601 字符串；金额字段数值型（`1940.00`），不使用字符串。
- 错误响应统一：

```json
{
  "code": "ACCOUNT_NOT_FOUND",
  "message": "Account 00000000001 not found",
  "details": ["activeStatus: Account Status must be Y or N."]
}
```

- HTTP 语义：`404` 未找到、`409` 业务规则冲突、`400` 参数校验失败、`503` 下游不可用。

## 5. 配置约定

所有服务使用同一套环境变量，便于 Compose 编排：

| 变量 | 说明 |
|---|---|
| `SERVER_PORT` | HTTP 端口，默认见上表 |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | PostgreSQL 连接 |
| `<TARGET>_SERVICE_URL` | 下游服务基址，如 `ACCOUNT_SERVICE_URL` |
| `SPRING_PROFILES_ACTIVE` | `docker` / `local` / 测试用 `test` |

`application.yml` 只写默认值 + 环境变量占位；不得写死容器外的主机名。

## 6. 数据库约定

- 每个服务一个独立数据库（`carddemo_iam`、`carddemo_customer`、`carddemo_card`、
  `carddemo_account`、`carddemo_transaction`、`carddemo_authorization`），禁止跨库 JOIN。
- 表名小写下划线，字段名与遗留 copybook 字段一一对应（见 `docs/legacy/04-data-dictionary.md`）。
- 每个聚合表带 `version bigint not null default 0`（`@Version` 乐观锁），替代遗留
  `READ UPDATE` + 人工并发比对。
- Flyway `V1__<context>_schema.sql` 建表，`V2__<context>_seed.sql` 种子数据；
  种子数据必须是幂等的普通 `INSERT`（便于 H2 与 PostgreSQL 双跑）。

## 7. 测试约定

- 每个服务至少包含：领域行为单测（纯 JUnit，无 Spring）+ 一个 `@SpringBootTest` +
  `MockMvc` 的端到端用例（H2 + Flyway 迁移 + 种子数据）。
- 断言重点在业务规则与错误码，不要断言日志或实现细节。
- `mvn -q test` 必须全绿；测试不得依赖外部网络或运行中的其他服务。

## 8. 可观测性与运维

- 所有服务暴露 `/actuator/health`（含 DB 探针），Docker healthcheck 使用它。
- 日志使用 Spring Boot 默认格式（时间/级别/线程/logger/消息），不打印卡号、SSN、密码等敏感字段。
- 分布式链路追踪（OpenTelemetry + B3/W3C 透传）列为后续迭代项。
- 每个服务提供 `Dockerfile`（多阶段构建）与 Compose 健康检查。

## 9. 明确不在本期范围

- 鉴权强制校验（token 签发在 `iam-service`，资源服务侧校验留待网关接入，见 ADR-0007）。
- 分布式事务：跨服务写操作采用"本地事务 + 失败回滚 + 幂等键"，Saga/Outbox 见 ADR-0005。
- 报表排版（原 COBOL 打印格式）只迁移数据口径与筛选逻辑，输出 JSON。
