# Docker 运行与调试手册

## 1. 前置条件

| 组件 | 版本 | 检查 |
|---|---|---|
| JDK | 21 | `java -version` |
| Maven | 3.9+ | `mvn -v` |
| Docker | 24+（BuildKit） | `docker version` |
| Docker Compose | v2 | `docker compose version` |

镜像说明：当前环境的 Docker Hub 不可访问，`Dockerfile` 使用本机已有镜像
`eclipse-temurin:21.0.8_9-jdk` 作为运行时，并要求宿主机先 `mvn package` 产出 jar。
若网络可访问 Docker Hub，可改用多阶段构建（`maven:3.9-eclipse-temurin-21` +
`eclipse-temurin:21-jre`）。

## 2. 启动 / 停止 / 重置

```bash
# 一键：打包 + 构建镜像 + 启动
./scripts/build-and-up.sh

# 分步
mvn -q -DskipTests package
docker compose build
docker compose up -d
docker compose ps

# 查看启动日志（首次启动约 15–25 秒）
docker compose logs -f transaction-service

# 停止（保留数据）
docker compose down

# 停止并清空数据库（Flyway 重新执行种子）
docker compose down -v
```

启动顺序：`postgres`（`pg_isready` 健康检查）→ 无依赖服务 → `transaction` / `authorization` → `marketing` / `web-ui`。
下游客户端是懒加载的，服务启动不依赖下游可用；调用失败时返回 503。

打开 **http://localhost:8090/** 即为业务界面（登录账号已预填）。

## 3. 端到端冒烟测试

```bash
./scripts/smoke-test.sh
```

覆盖：6 个健康探针、登录、账户/客户/卡查询、日终入账、授权决策、交易报表。

手工验证命令见 `README.md` §4。

## 4. 调试手段

### 4.1 日志

```bash
docker compose logs -f account-service
docker compose logs --tail=200 transaction-service | grep -i error
```

### 4.2 进入容器 / 查看进程与端口

```bash
docker compose exec account-service sh
docker compose exec account-service ps -ef | grep java
docker compose exec account-service wget -qO- localhost:8084/actuator/health
```

> 运行时镜像为 JDK（未裁剪），`wget`/`curl` 不可用时用 `sh` + `/dev/tcp` 或直接在宿主机 curl 映射端口。

### 4.3 直接查数据库

```bash
docker compose exec postgres psql -U carddemo -d carddemo_account \
  -c "select account_id, current_balance, version from account order by 1;"

docker compose exec postgres psql -U carddemo -d carddemo_authorization \
  -c "select account_id, approved_count, approved_amount, credit_balance from auth_summary;"

docker compose exec postgres psql -U carddemo -d carddemo_transaction \
  -c "select transaction_id, account_id, type_code, amount, processed_timestamp from transaction order by 1 desc limit 10;"
```

### 4.4 只重启单个服务（代码改动后）

```bash
mvn -q -DskipTests -pl services/account-service -am package
docker compose up -d --build account-service
```

### 4.5 本地 IDE 调试（不打包）

```bash
docker compose up -d postgres
DB_HOST=localhost DB_NAME=carddemo_account mvn -f services/account-service/pom.xml spring-boot:run
# 其余服务同理，改 DB_NAME / SERVER_PORT
```

跨服务调用时设置 `CARD_SERVICE_URL=http://localhost:8083`、
`ACCOUNT_SERVICE_URL=http://localhost:8084`、`CUSTOMER_SERVICE_URL=http://localhost:8082`。

### 4.6 Web 界面与 API 控制台

**业务界面（推荐）**：http://localhost:8090/
- 登录账号已预填：`ADMIN001 / admin123`（管理员）、`USER0001 / user1234`（普通用户）。
- 功能：账户视图、信用卡查询/维护、交易查询/录入、账单支付、交易报表、授权管理、
  活动中心/我的奖励、活动管理（管理员）、用户管理（管理员）。
- 所有 `/api/**` 由 web-ui 同源代理到对应微服务（浏览器无 CORS）。

**API 控制台（Swagger UI）**：每个微服务的根路径重定向到自己的 Swagger UI。

| 服务 | Swagger UI | OpenAPI JSON |
|---|---|---|
| iam | http://localhost:8081/ | http://localhost:8081/v3/api-docs |
| customer | http://localhost:8082/ | http://localhost:8082/v3/api-docs |
| card | http://localhost:8083/ | http://localhost:8083/v3/api-docs |
| account | http://localhost:8084/ | http://localhost:8084/v3/api-docs |
| transaction | http://localhost:8085/ | http://localhost:8085/v3/api-docs |
| authorization | http://localhost:8086/ | http://localhost:8086/v3/api-docs |
| marketing | http://localhost:8087/ | http://localhost:8087/v3/api-docs |

登录：`POST /api/v1/auth/login` → `Try it out`（body 已预填 `ADMIN001/admin123`）→ `Execute`。
若想用普通用户：改为 `USER0001/user1234`。

新增接口后无需改前端：注解（`@Operation`、`@Schema`、`@ExampleObject`）会自动反映到页面。
若页面显示旧内容，强制刷新浏览器（Ctrl/Cmd+Shift+R）或在服务重建后重试。

### 4.7 断点与远程调试（可选）

在各服务 `ENTRYPOINT` 增加
`-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005`，
Compose 增加 `ports: ["5005:5005"]`，IDE 以 Remote JVM Debug 连接。

## 5. 常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| `docker compose build` 报拉取 `eclipse-temurin` 超时 | Docker Hub 不可达 | 使用本机已有镜像（当前 Dockerfile 已如此）；或配置镜像加速器 |
| 服务启动即退出，日志 `Connection refused` | PostgreSQL 未就绪 | 确认 `postgres` 容器 healthy；`docker compose down -v` 后重试 |
| `FlywayValidateException: checksum mismatch` | 修改了已执行的迁移脚本 | 演示环境 `docker compose down -v` 重新初始化；生产环境新增迁移版本，禁止改历史脚本 |
| 端口被占用 | 本机已有服务 | 修改 `docker-compose.yml` 端口映射，或释放端口（5432/8081–8087/8090） |
| 打开 8080 不是本界面 | 宿主机 8080 已被其他程序占用，本工程映射到 **8090** | 使用 http://localhost:8090/；如需 8080，先释放占用再改 compose 映射 |
| 活动中心为空 | 活动不是 ACTIVE，或已过活动期 | 用管理员在 `#/campaigns` 发布活动；检查起止时间 |
| 消费后没有返现 | 未报名、类别/金额不满足、次数或预算用尽 | 在 `#/offers` 查看资格原因；在活动详情看预算使用率 |
| 奖励显示「待入账」 | account-service 当时不可用 | 在 `#/rewards` 点「重试入账」，接口按 rewardId 幂等 |
| 账单支付返回 409 `NOTHING_TO_PAY` | 账户余额 ≤ 0 | 换有欠款的账户（种子：1/2/3/4/6/7/8） |
| 入账返回 `103` 拒付 | 账户到期日早于交易原始日期 | 种子账户 1–5、7 的到期日已过，用账户 6（2027-03-09）或 8（2028-09-30）演示 |
| 授权返回 `4100` | 可用额度 = 额度 − 当前欠款 − 待授权占用 | 属预期；账户 1 可用额度为 80.00 |
| 交易号重复 | 入账 `transactionId` 已存在 | 入账按幂等处理（计入 posted + duplicates），换一个新交易号可验证新记账 |
| 容器内存不足 | 6 个 JVM + PG | Docker Desktop 分配 ≥ 6GB；或减少并行构建 `COMPOSE_PARALLEL_LIMIT=2` |

## 6. 数据重置与重建

```bash
docker compose down -v                 # 删除卷（全部业务数据与 Flyway 历史）
mvn -q -DskipTests package
docker compose up -d --build
```

## 7. 已知安全缺口（必须知晓）

1. **资源服务未强制校验 token**（ADR-007）：8081–8086 端口等同内网可信调用。
   仅限本机/隔离网络演示，禁止暴露公网或生产使用。
2. 生产化前必须：接入 API 网关统一鉴权（OAuth2/OIDC）、服务间 mTLS、密钥托管
   （`IAM_TOKEN_SECRET` 不得使用默认值）、审计日志与限流。
3. 种子密码仅用于演示（`ADMIN001/admin123`、`USER0001/user1234`），上线前必须重置。
4. 授权接口按 legacy 语义仅做"额度/状态"判断，未接反欺诈名单与商户风控（U4）。

## 8. 验证记录（本次交付）

| 项 | 结果 |
|---|---|
| `mvn test`（6 模块） | 160 用例全绿 |
| `docker compose up -d --build` | 7 个容器启动，6 个服务 health=UP |
| 冒烟：登录/账户/客户/卡 | 通过 |
| 冒烟：入账（正常 + 超限 102） | 通过 |
| 冒烟：授权（批准 50 / 超额 4100 / 汇总占用） | 通过 |
| 冒烟：账单支付（1940 → 余额 0） | 通过 |
| 冒烟：报表（6 笔，合计 2613.12） | 通过 |
| Swagger UI（6 个服务根路径 302 → `/swagger-ui/index.html`，HTTP 200） | 通过 |
| Web 界面（8090 首页 200、静态资源 MIME 正确、同源代理登录/查询/404） | 通过 |
| 前端脚本语法（`node --check app.js`） | 通过 |
| UI 只读端到端（jsdom 驱动真实界面：登录、菜单、账户/卡片/交易/报表/授权/用户、角色权限） | 18/18 通过 |
| UI 写操作端到端（交易录入、账单支付、卡片维护、用户增删、欺诈标记） | 7/7 通过 |
| 营销端到端（入账触发返现、报名后二次返现、幂等评估、活动创建/发布） | 通过 |
| 营销 UI 端到端（活动中心报名、奖励记录、活动新建与发布） | 9/9 通过 |
| 登录请求体预填（`ADMIN001` / `admin123`） | 通过（`/v3/api-docs` 已生成示例） |
