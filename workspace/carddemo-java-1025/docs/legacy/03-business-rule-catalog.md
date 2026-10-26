# CardDemo 业务规则目录（含目标系统落点）

> 每条规则标注：遗留证据（程序 / 段落 / 行号）→ 目标微服务落点 → 实现状态。
> 状态：`已实现` = 新代码中可运行且有测试；`部分` = 语义保留但简化；`不实现` = 明确延后并说明原因；
> `新增` = 遗留系统没有、目标系统补齐的防护规则。

## 1. 登录与用户安全（iam-service）

| 规则 | 规则描述 | 遗留证据 | 目标落点 | 状态 |
|---|---|---|---|---|
| BR-SGN-01 | 用户号、密码均必填，缺失即拒绝且不查询 | `COSGN00C.cbl:118-140` | `POST /api/v1/auth/login` 参数校验 | 已实现 |
| BR-SGN-02 | 用户号与密码在比较前统一 `UPPER-CASE` | `COSGN00C.cbl:132-136` | `LoginService` 大写归一化 | 已实现 |
| BR-SGN-03 | 密码等值比较（遗留为明文）；用户不存在与密码错误可区分 | `COSGN00C.cbl:221-256` | PBKDF2 校验；错误统一为 `INVALID_CREDENTIALS` | 部分（安全改进，见 ADR-0008） |
| BR-SGN-04 | `SEC-USR-TYPE = 'A'` → 管理员菜单（COADM01C），否则普通菜单（COMEN01C） | `COSGN00C.cbl:230-240` | 登录响应 `landingMenu = ADMIN / USER` | 已实现 |
| BR-SGN-05 | 仅 `A` 为用户管理员入口，其他任何值按普通用户处理 | `COSGN00C.cbl:230-240` | 同上 | 已实现 |
| BR-USER-01 | 用户新增：姓名、用户号、密码、类型五项必填 | `COUSR01C.cbl:118-147` | `POST /api/v1/users` `@NotBlank` | 已实现 |
| BR-USER-02 | 用户号 8 位；重复用户号拒绝 | `CSUSR01Y.cpy:18`；`COUSR01C.cbl:260-266` | 主键冲突 → 409 `USER_ALREADY_EXISTS` | 已实现 |
| BR-USER-03 | 密码 8 位，遗留无强度校验 | `CSUSR01Y.cpy:21`；`COUSR01C.cbl:136-141` | 8-64 位、非空白；PBKDF2 存储 | 部分（强度规则新增） |
| BR-USER-04 | 用户类型取值 `A/U`（遗留仅非空校验，属缺陷） | `COUSR01C.cbl:142-147`；`COSGN00C.cbl:230` | 枚举校验 `A/U` | 已实现（修正缺陷） |
| BR-USER-05 | 用户列表按用户号升序、每页 10 行、PF7/PF8 翻页 | `COUSR00C.cbl:293-323,586-629` | `GET /api/v1/users?page&size=10` | 已实现 |
| BR-USER-06 | 修改用户：五项必填，逐字段比较，有变化才写库 | `COUSR02C.cbl:180-245` | `PUT /api/v1/users/{id}` 字段校验 | 已实现（同值 PUT 幂等，不再报错） |
| BR-USER-07 | 删除用户按用户号定位，不存在返回提示 | `COUSR03C.cbl:144-192` | `DELETE /api/v1/users/{id}` → 404 | 已实现 |
| NR-USER-01 | 禁止删除或降级最后一个管理员（遗留无此保护，可导致系统失去管理员） | 缺陷说明见 `05-ubiquitous-language.md` §风险；`COUSR03C.cbl` 全文无管理员计数 | `UserDirectoryService.delete/update` → 409 `LAST_ADMIN` | 新增 |
| NR-USER-02 | 禁止删除调用者自身（可选请求头 `X-User-Id` 判定） | 遗留无 | 同上 → 409 `CANNOT_DELETE_SELF` | 新增 |

## 2. 客户（customer-service）

| 规则 | 规则描述 | 遗留证据 | 目标落点 | 状态 |
|---|---|---|---|---|
| BR-CUST-01 | 客户号 9 位、前导零保留 | `CVCUS01Y.cpy:5` | `customerId` 字符串 9 位 | 已实现 |
| BR-CUST-02 | 名、姓必填，仅允许字母与空格，各 25 位；中间名可选 | `COACTUPC.cbl:1560-1582,1898-1950,2012-2056` | `PUT /api/v1/customers/{id}` | 已实现 |
| BR-CUST-03 | 地址行 1 必填（字母数字，50）；城市必填（城市存于 `CUST-ADDR-LINE-3`，纯字母） | `COACTUPC.cbl:1584-1630` | 字段 `addressLine3`（city）+ 校验 | 已实现 |
| BR-CUST-04 | 州 2 位合法州代码；邮编 5 位数字且非零 | `COACTUPC.cbl:2493-2510,2109-2175` | 州代码表 + 数字校验 | 已实现 |
| BR-CUST-05 | 州 + 邮编前 2 位交叉校验（USPS 派生表） | `COACTUPC.cbl:2536-2556`；`CSLKPCDY.cpy:1012-1073` | — | 不实现（需维护 USPS 全量表，延后） |
| BR-CUST-06 | 电话 1/2 可选；填写则 3-3-4 段均非零数字、区号在 NANPA 清单内；入库格式 `(999)999-9999` | `COACTUPC.cbl:2225-2426` | 10 位数字校验 + 格式化 | 部分（不校验 NANPA 全量区号） |
| BR-CUST-07 | SSN 3-2-4 段均必填非零；首段不得为 000/666/900-999 | `COACTUPC.cbl:2431-2488` | 校验 + 响应中只返回掩码 | 已实现 |
| BR-CUST-08 | FICO 3 位数字、非零、300–850 | `COACTUPC.cbl:2514-2530` | `ficoScore` 范围校验 | 已实现 |
| BR-CUST-09 | 出生日期合法且不得晚于当天 | `COACTUPC.cbl:1533-1543` | `dateOfBirth <= today` | 已实现 |
| BR-CUST-10 | EFT 账号 10 位数字、非零 | `COACTUPC.cbl:1648-1655` | 校验 | 已实现 |
| BR-CUST-11 | 主卡持有人标志仅 `Y/N` | `COACTUPC.cbl:1657-1662` | 枚举校验 | 已实现 |
| BR-CUST-12 | 政府证件号 20 位、可空 | `CVCUS01Y.cpy:18` | 长度校验 | 已实现 |
| NR-CUST-01 | 新增客户 API（遗留仅通过分行迁移导入创建） | `CBIMPORT.cbl:2300-客户` | `POST /api/v1/customers` | 新增 |

## 3. 卡片（card-service）

| 规则 | 规则描述 | 遗留证据 | 目标落点 | 状态 |
|---|---|---|---|---|
| BR-CARD-01 | 卡号 16 位数字，主键；卡号→账户/客户映射由 XREF 维护 | `CVACT02Y.cpy:4-6`；`CVACT03Y.cpy:4-9` | `card` + `card_xref` 表 | 已实现 |
| BR-CARD-02 | 卡片列表按卡号升序分页（遗留每页 7 行） | `COCRDLIC.cbl:177-178,1123-1261` | `GET /api/v1/cards?page&size=7` | 已实现（改 offset 分页） |
| BR-CARD-03 | 列表过滤：账户号 11 位数字、卡号 16 位数字；两条件 AND | `COCRDLIC.cbl:1003-1067,1382-1405` | 查询参数校验 | 已实现 |
| BR-CARD-04 | 行动作码只允许 `S`/`U`，同一屏只能选一行 | `COCRDLIC.cbl:1073-1121` | 列表行 `action` 字段校验（保留给前端） | 部分（后端返回可选动作） |
| BR-CARD-05 | 卡详情按卡号主键读取（不校验卡与账户归属，属遗留缺陷） | `COCRDSLC.cbl:726-773` | `GET /api/v1/cards/{cardNumber}` | 已实现（新增归属校验能力） |
| BR-CARD-06 | 查询时账户号、卡号必填且格式合法 | `COCRDSLC.cbl:647-715` | 参数校验 | 已实现 |
| BR-CARD-07 | 卡面姓名必填，仅字母与空格，50 位 | `COCRDUPC.cbl:806-840` | `PUT /api/v1/cards/{cardNumber}` | 已实现 |
| BR-CARD-08 | 卡状态仅 `Y/N` | `COCRDUPC.cbl:845-873` | 枚举校验 | 已实现 |
| BR-CARD-09 | 到期月 1–12，到期年 1950–2099；日不可编辑 | `COCRDUPC.cbl:877-944` | 月/年校验，日取原值 | 已实现 |
| BR-CARD-10 | 保存前并发比对（CVV/卡名/年/月/日/状态），不一致则回滚 | `COCRDUPC.cbl:1498-1520` | `@Version` 乐观锁 → 409 `CONCURRENT_UPDATE` | 已实现（机制替换） |
| BR-CARD-11 | 无变更时提示并不写库 | `COCRDUPC.cbl:680-693` | PUT 幂等，不报错 | 部分（REST 语义改进） |
| NR-CARD-01 | 重写卡片时不得覆盖 CVV（遗留会把 CVV 写成空/零，属缺陷） | `COCRDUPC.cbl:1464-1465` | 领域方法只改允许字段 | 新增（缺陷修复） |
| NR-CARD-02 | 卡片响应不得返回 CVV | 遗留屏幕无 CVV；DB2/VSAM 有 | 响应 DTO 不含 `cvv` | 新增（数据最小化） |

## 4. 账户（account-service）

| 规则 | 规则描述 | 遗留证据 | 目标落点 | 状态 |
|---|---|---|---|---|
| BR-ACCT-01 | 账户号 11 位、非零、前导零保留 | `COACTUPC.cbl:1787-1813`；`CVACT01Y.cpy:5` | 路径变量 11 位校验 | 已实现 |
| BR-ACCT-02 | 账户状态仅 `Y/N` | `COACTUPC.cbl:1856-1893` | `Account.applyDetails` | 已实现 |
| BR-ACCT-03 | 当前余额、信用额度、现金额度、本期贷/借五项必填（`S9(10)V99`） | `COACTUPC.cbl:2180-2219` | `@NotNull` + 领域校验 | 已实现 |
| BR-ACCT-04 | 开户日/到期日/重发日必填，格式 `YYYY-MM-DD`，世纪 19/20，真实历法日期 | `COACTUPC.cbl:1478-1507`；`CSUTLDPY.cpy:18-330` | `LocalDate` + 年份 1900–2099 | 已实现（历法由 `java.time` 保证） |
| BR-ACCT-05 | 账户维护无变更时提示并不写库 | `COACTUPC.cbl:1205-COMPARE-OLD-NEW` | PUT 幂等 | 部分（REST 语义改进） |
| BR-ACCT-06 | 并发更新：刷新时快照与库中不一致则回滚 | `COACTUPC.cbl:4109-4191` | `@Version` 乐观锁 | 已实现（机制替换） |
| BR-ACCT-07 | 账户号 → 客户号/卡号映射经 CXACAIX（CCXREF 账户备用索引） | `COACTVWC.cbl:723-770` | 由 card-service 提供 `by-account` 查询 | 已实现（职责迁移） |
| BR-ACCT-08 | 账户视图展示账户 + 客户 + 卡号（跨两个聚合） | `COACTVWC.cbl:471-525` | 前端/BFF 组合 `account + customer + card` 三次调用 | 部分（改为组合查询，见 ADR-0004） |
| BR-ACCT-09 | 记账：余额 += 金额；金额 ≥ 0 计入本期贷方，否则计入本期借方 | `CBTRN02C.cbl:547-552` | `POST /api/v1/accounts/{id}/postings` | 已实现 |
| BR-ACCT-10 | 账单支付：仅减少余额，不改本期贷/借 | `COBIL00C.cbl:234`；`UPDATE-ACCTDAT-FILE` | `POST /api/v1/accounts/{id}/payments` | 已实现 |
| BR-ACCT-11 | 利息结算：余额 += 累计利息，清零本期贷/借 | `CBACT04C.cbl:350-354` | `POST /api/v1/accounts/{id}/interest-accruals` | 已实现 |
| NR-ACCT-01 | 还款金额必须 > 0 且不超过当前余额（遗留金额恒等于余额，不会触发） | `COBIL00C.cbl:224,234` | `Account.applyBillPayment` | 新增（防护） |

## 5. 交易录入与查询（transaction-service）

| 规则 | 规则描述 | 遗留证据 | 目标落点 | 状态 |
|---|---|---|---|---|
| BR-TRN-01 | 账户号或卡号至少输入一个；两者都给时以卡号解析账户并校验一致 | `COTRN02C.cbl:193-230` | `POST /api/v1/transactions` | 已实现 |
| BR-TRN-02 | 账户/卡号必须在 XREF 中存在 | `COTRN02C.cbl:576-637` | 调 card-service，404 → 400 | 已实现 |
| BR-TRN-03 | 类型、类别、来源、描述、金额、原始日期、处理日期、商户 ID/名称/城市/邮编必填 | `COTRN02C.cbl:251-317` | `@NotBlank`/`@NotNull` | 已实现 |
| BR-TRN-04 | 类型、类别、商户 ID 必须是数字 | `COTRN02C.cbl:322-337,430-436` | 正则/数值校验 | 已实现 |
| BR-TRN-05 | 金额格式 `-99999999.99`（符号位 + 8 位整数 + 2 位小数） | `COTRN02C.cbl:339-351` | `BigDecimal`，服务端校验范围与小数位 | 已实现（改为数值协议） |
| BR-TRN-06 | 原始/处理日期格式 `YYYY-MM-DD` 且为合法日期 | `COTRN02C.cbl:353-427` | `LocalDate` + 格式 | 已实现（历法由 `java.time` 保证） |
| BR-TRN-07 | 新增交易号 = 当前最大交易号 + 1（16 位） | `COTRN02C.cbl:442-451` | `TransactionIdGenerator`（数据库 max+1） | 已实现 |
| BR-TRN-08 | 交易号重复拒绝 | `COTRN02C.cbl:735-741` | 主键冲突 → 409 `DUPLICATE_TRANSACTION_ID` | 已实现 |
| BR-TRN-09 | 交易列表按交易号升序、每页 10 行；可按交易号前缀过滤 | `COTRN00C.cbl:591-654,206-218` | `GET /api/v1/transactions?page&size&idPrefix` | 已实现 |
| BR-TRN-10 | 交易详情展示全部字段（描述截断 60、商户名 30、城市 25 为屏幕限制） | `COTRN01C.cbl:178-190` | `GET /api/v1/transactions/{id}` 返回全字段 | 已实现 |

## 6. 日终入账（transaction-service + account-service）

| 规则 | 规则描述 | 遗留证据 | 目标落点 | 状态 |
|---|---|---|---|---|
| BR-POST-01 | 卡号不存在 → 拒付码 100 `INVALID CARD NUMBER FOUND` | `CBTRN02C.cbl:380-392` | `PostingService` | 已实现 |
| BR-POST-02 | 账户不存在 → 拒付码 101 `ACCOUNT RECORD NOT FOUND` | `CBTRN02C.cbl:393-399` | 同上 | 已实现 |
| BR-POST-03 | `可用额度 < 本期贷 − 本期借 + 本笔` → 拒付码 102 `OVERLIMIT TRANSACTION` | `CBTRN02C.cbl:403-413` | 同上（调 account-service 快照） | 已实现 |
| BR-POST-04 | 账户到期日 < 交易原始日期 → 拒付码 103 `TRANSACTION RECEIVED AFTER ACCT EXPIRATION` | `CBTRN02C.cbl:414-420` | 同上 | 已实现 |
| BR-POST-05 | 拒付写入拒付明细（原 DALYREJS），记录失败原因码与描述 | `CBTRN02C.cbl:446-465` | `daily_transaction.reject_reason` + 运行结果 | 已实现（存储介质替换） |
| BR-POST-06 | 通过校验：更新交易类别累计（无记录则新建）、更新账户余额与本期贷/借、写交易主档 | `CBTRN02C.cbl:424-444,467-559` | `PostingService` + `POST /accounts/{id}/postings` | 已实现 |
| BR-POST-07 | 处理时间戳在入账时生成，原始时间戳保留请求值 | `CBTRN02C.cbl:436-438` | `processedAt = now()` | 已实现 |
| BR-POST-08 | 有拒付时批处理返回码 4（部分成功语义） | `CBTRN02C.cbl:229-231` | 运行结果 `status = COMPLETED_WITH_REJECTS` | 已实现 |
| NR-POST-01 | 单笔入账幂等：同一 `transactionId` 重复提交返回既有结果 | 遗留无（VSAM 主键天然拒绝） | 唯一约束 + 幂等返回 | 新增 |

## 7. 利息（transaction-service）

| 规则 | 规则描述 | 遗留证据 | 目标落点 | 状态 |
|---|---|---|---|---|
| BR-INT-01 | 月利息 = `交易类别累计额 × 年利率 ÷ 1200` | `CBACT04C.cbl:462-467` | `InterestService` | 已实现 |
| BR-INT-02 | 利率来自披露组（账户组 + 类型 + 类别）；缺失时取 `DEFAULT` 组 | `CBACT04C.cbl:415-460` | `DisclosureGroupRepository` 回退 `DEFAULT` | 已实现 |
| BR-INT-03 | 利率为 0 时不产生利息交易 | `CBACT04C.cbl:214-217` | 同上 | 已实现 |
| BR-INT-04 | 每个账户按类别计息后汇总为一笔利息交易（类型 01/类别 0005，来源 System，描述 `Int. for a/c <acct>`），并清零本期贷/借 | `CBACT04C.cbl:462-500,350-354` | `InterestService` + `interest-accruals` | 已实现 |
| BR-INT-05 | 费用计算（`1400-COMPUTE-FEES`） | `CBACT04C.cbl:518-520`（空实现） | — | 不实现（遗留未实现，需求待澄清） |

## 8. 账单支付（transaction-service 编排 + account-service）

| 规则 | 规则描述 | 遗留证据 | 目标落点 | 状态 |
|---|---|---|---|---|
| BR-BILL-01 | 余额 ≤ 0 拒绝：`You have nothing to pay...` | `COBIL00C.cbl:197-206` | `BillPaymentService` → 409 `NOTHING_TO_PAY` | 已实现 |
| BR-BILL-02 | 必须显式确认（`Y`）；`N` 清屏退出；其他值报错 | `COBIL00C.cbl:173-191` | 请求体 `confirm` 布尔值 | 已实现（协议适配） |
| BR-BILL-03 | 支付金额 = 当前余额（全额还款） | `COBIL00C.cbl:224` | `BillPaymentService` 读取账户余额 | 已实现 |
| BR-BILL-04 | 生成交易：类型 02、类别 0002、来源 `POS TERM`、描述 `BILL PAYMENT - ONLINE`、商户 `999999999/BILL PAYMENT/N/A/N/A`、时间戳为当前时间 | `COBIL00C.cbl:218-233` | 同上 | 已实现 |
| BR-BILL-05 | 余额扣减与交易落库必须一致（遗留在同一 CICS 事务内） | `COBIL00C.cbl:233-235` | 本地事务 + 远程调用，失败回滚（见 ADR-0005） | 已实现 |

## 9. 授权（authorization-service）

| 规则 | 规则描述 | 遗留证据 | 目标落点 | 状态 |
|---|---|---|---|---|
| BR-AUTH-01 | 卡号必须存在于 XREF，否则拒绝 3100 | `COPAUA0C.cbl:472-513,699-704` | `AuthorizationService` | 已实现 |
| BR-AUTH-02 | 账户/客户必须存在，否则拒绝 3100 | `COPAUA0C.cbl:520-560,560-610` | 同上 | 已实现 |
| BR-AUTH-03 | 可用额度：遗留为 `信用额度 − 信用余额`（有汇总）/ `信用额度 − 当前余额`（无汇总）；本笔 > 可用额度 → 拒绝 4100。遗留在创建汇总后不再扣减账户欠款，属额度放大缺陷（NR-AUTH-03） | `COPAUA0C.cbl:660-683,705-706` | `AuthorizationPolicy.availableCredit`（修正为同时扣减） | 部分（缺陷修复） |
| BR-AUTH-04 | 卡未激活 → 拒绝 4200（遗留分支为死代码） | `COPAUA0C.cbl:707-708`；88 条件从未 SET | 同上（card.activeStatus） | 已实现（补齐意图） |
| BR-AUTH-05 | 账户关闭（状态 ≠ Y）→ 拒绝 4300（遗留死代码） | `COPAUA0C.cbl:709-710` | 同上 | 已实现（补齐意图） |
| BR-AUTH-06 | 卡级欺诈标记 → 拒绝 5100（遗留死代码） | `COPAUA0C.cbl:711-712` | `card_fraud_flag` | 已实现（补齐意图） |
| BR-AUTH-07 | 商户欺诈 → 拒绝 5200；遗留无判定数据源 | `COPAUA0C.cbl:713-714` | — | 不实现（U4，无数据源） |
| BR-AUTH-08 | 批准：响应码 `00`、批准金额 = 交易金额、原因 `0000`；拒绝：响应码 `05`、批准金额 0 | `COPAUA0C.cbl:685-698` | 决策响应 | 已实现 |
| BR-AUTH-09 | 原因码优先级：不存在(3100) > 额度(4100) > 卡未激活(4200) > 账户关闭(4300) > 卡欺诈(5100) > 其他(9000) | `COPAUA0C.cbl:699-718` | 决策顺序 | 已实现 |
| BR-AUTH-10 | 汇总更新：批准 → 笔数+1、金额+、信用余额+；拒绝 → 笔数+1、金额+ | `COPAUA0C.cbl:813-822` | `AuthSummary` | 已实现 |
| BR-AUTH-11 | 每笔授权写授权明细（请求全字段 + 响应 + 欺诈标记） | `COPAUA0C.cbl:786-850`；`AUTHFRDS.ddl` | `auth_detail` 表 | 已实现 |
| BR-AUTH-12 | 授权查询：按账户查看汇总与明细；可对单笔标记欺诈 | `COPAUS0C/1C/2C` 功能注释；`AUTHFRDS.AUTH_FRAUD` | `GET /authorizations`、`POST /{card}/{ts}/fraud` | 已实现 |
| BR-AUTH-13 | 过期授权清理：日龄 ≥ 过期天数（默认 5）删除明细；汇总无明细时删除 | `CBPAUP0C.cbl:156,196-209,280-346` | `POST /api/v1/authorization-purges` | 已实现 |
| NR-AUTH-01 | 清理过期授权时必须回退信用余额（遗留未回退导致额度泄漏） | `CBPAUP0C.cbl:284-296` | 清理时 `credit_balance -= approved_amount` 并重算汇总 | 新增（缺陷修复） |
| NR-AUTH-02 | 清理汇总条件改为"批准笔数与拒绝笔数同时为 0"（遗留重复判断批准笔数） | `CBPAUP0C.cbl:156` | 同上 | 新增（缺陷修复） |
| NR-AUTH-03 | 可用额度必须同时扣减账户当前欠款与未过期批准占用（遗留建汇总后忽略账户欠款，首笔授权即可放大额度） | `COPAUA0C.cbl:665-683,813-817` | `AuthorizationPolicy.availableCredit` | 新增（缺陷修复） |

## 10. 报表（transaction-service）

| 规则 | 规则描述 | 遗留证据 | 目标落点 | 状态 |
|---|---|---|---|---|
| BR-RPT-01 | 报表类型：月度（当月首末日）/年度（1-1 至 12-31）/自定义 | `CORPT00C.cbl:212-256` | `GET /reports/transactions?startDate&endDate` | 已实现（日期范围直接传入） |
| BR-RPT-02 | 按处理日期闭区间过滤 | `CBTRN03C.cbl:173-178` | 查询条件 | 已实现 |
| BR-RPT-03 | 按卡号分组、每 20 行分页、三级合计（页/账户/总计） | `CBTRN03C.cbl:181-203,282-322` | 结果含 `pageTotal/accountTotal/grandTotal` | 部分（不实现纸质分页，保留合计口径） |
| BR-RPT-04 | 引用完整性：卡号/类型/类别不存在时报表失败 | `CBTRN03C.cbl:484-512` | 返回 409 `REPORT_REFERENCE_ERROR` | 已实现 |
| BR-RPT-05 | 金额格式 `-ZZZ,ZZZ,ZZZ.ZZ` | `CVTRA07Y.cpy:15-31` | JSON 数值 + CSV 导出由前端格式化 | 不实现（排版） |

## 11. 迁移与集成（延后项）

| 规则 | 规则描述 | 遗留证据 | 目标落点 | 状态 |
|---|---|---|---|---|
| BR-MIG-01 | 导出顺序 C→A→X→T→D，记录 500 字节，序号递增 | `CBEXPORT.cbl:151-157` | 迁移工具（独立作业） | 不实现（本期，另立迁移项目） |
| BR-MIG-02 | 导入按记录类型分派，未知类型写错误文件 | `CBIMPORT.cbl:272-285` | 同上 | 不实现（本期） |
| BR-MQ-01 | MQ `INQA` + 11 位账户号查询账户明细，原样回填 MSGID/CORRELID | `COACCT01.cbl:105-112,393-426` | 可映射为 `GET /api/v1/accounts/{id}`；MQ 适配器另行开发 | 部分（HTTP 已具备，MQ 适配延后） |
| BR-MQ-02 | MQ 日期查询返回系统日期时间 | `CODATE01.cbl:339-361` | `GET /actuator/info`/新增工具接口 | 不实现（非核心） |
| BR-TT-01 | 交易类型/类别维护（列表/新增/修改/删除，DB2 游标分页） | `COTRTLIC.cbl`、`COTRTUPC.cbl`、`COBTUPDT.cbl` | `GET /api/v1/transaction-types`、`/transaction-categories`、`PUT /transaction-types/{code}` | 部分（仅查询与描述维护，类别增删延后） |
