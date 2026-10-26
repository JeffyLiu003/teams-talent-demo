# CardDemo 存量系统五层业务模型（As-Is）

> 方法：自底向上（L5→L1）构建，每条事实标注证据（程序 / 段落 / 行号）。
> 证据基线：`carddemo-cobol` 工作副本（44 个 COBOL 程序、62 个 copybook、12 个 VSAM 文件、
> 3 张 DB2 表、2 个 IMS 段、40 个 JCL）。无法从代码确认的事项列入 §6「未解决项」，不做推断。
> 档位：L3 实施级（依据：涉及客户资金、授权与账务、存量代码迁移、业务连续性）。

---

## 1. L1 业务模型

### 1.1 系统定位

CardDemo 是演示型**信用卡发卡行后台核心系统**，覆盖从客户/账户/卡片建档，到交易受理、授权审批、
日终入账、循环利息、账单支付、报表与用户权限管理的完整闭环。
证据：`app/cbl` 在线程序族、`app/jcl` 批作业、`app/app-authorization-ims-db2-mq` 授权子应用。

### 1.2 业务能力清单

| 编号 | 业务能力 | 承载实现 | 证据 |
|---|---|---|---|
| C1 | 身份鉴别与菜单授权 | COSGN00C、COADM01C、COMEN01C | `COSGN00C.cbl:209-257`；`COADM02Y.cpy:19-59`；`COMEN02Y.cpy:19-98` |
| C2 | 用户安全管理（增删改查） | COUSR00C/01C/02C/03C | `COUSR00C.cbl:586-629`；`COUSR01C.cbl:238-266`；`COUSR02C.cbl:111-126`；`COUSR03C.cbl:174-192` |
| C3 | 客户信息管理 | CUSTDAT、CBCUS01C、COACTUPC | `CVCUS01Y.cpy:4-23`；`CBCUS01C.cbl`（读打印）；`COACTUPC.cbl:1560-1662` |
| C4 | 信用卡账户管理（额度/余额/日期/分组） | ACCTDAT、COACTVWC、COACTUPC、CBACT01C/03C | `CVACT01Y.cpy:4-17`；`COACTVWC.cbl:471-525`；`COACTUPC.cbl:9699-WRITE-PROCESSING 3888-4104` |
| C5 | 卡片管理（卡号-账户-客户映射、卡状态、有效期） | CARDDAT、CCXREF、COCRDLIC/SLC/UPC、CBACT02C | `CVACT02Y.cpy:4-12`；`CVACT03Y.cpy:4-9`；`COCRDLIC.cbl:1123-1261`；`COCRDUPC.cbl:1420-1495` |
| C6 | 交易受理与维护（录入/列表/详情） | TRANSACT、COTRN00C/01C/02C | `CVTRA05Y.cpy:4-17`；`COTRN02C.cbl:442-466`；`COTRN00C.cbl:591-654`；`COTRN01C.cbl:267-295` |
| C7 | 信用卡授权决策 | COPAUA0C、IMS PAUTSUM0/PAUTDTL1、DB2 AUTHFRDS | `COPAUA0C.cbl:438-466,660-731`；`AUTHFRDS.ddl:1-28`；`DBPAUTP0.dbd` |
| C8 | 日终交易入账（校验/记账/拒付） | CBTRN02C、DALYTRAN、TCATBALF、DALYREJS | `CBTRN02C.cbl:202-234,370-559` |
| C9 | 循环利息计算 | CBACT04C、DISCGRP | `CBACT04C.cbl:180-232,462-500` |
| C10 | 账单支付 | COBIL00C | `COBIL00C.cbl:197-244` |
| C11 | 交易报表（在线提交 + 批打印） | CORPT00C、CBTRN03C、TDQ JOBS | `CORPT00C.cbl:212-256,498-535`；`CBTRN03C.cbl:173-203` |
| C12 | 分行迁移数据导出/导入 | CBEXPORT、CBIMPORT、CVEXPORT | `CBEXPORT.cbl:151-157`；`CBIMPORT.cbl:272-285` |
| C13 | 过期授权清理 | CBPAUP0C（BMP） | `CBPAUP0C.cbl:156,280-346` |
| C14 | 系统集成（MQ 查询接口） | COACCT01、CODATE01 | `COACCT01.cbl:191-198,393-426`；`CODATE01.cbl:339-361` |
| C15 | 交易类型/类别维护（DB2） | COTRTLIC、COTRTUPC、COBTUPDT | `COTRTLIC.cbl:000200-000700`；`TRNTYPE.ddl` |

### 1.3 宏观业务流程

1. **客户与账户生命周期**：客户建档 → 账户开立（额度、开户/到期/重发日、披露组）→ 发卡（卡号↔账户↔客户）
   → 账户/卡片状态维护（`Y/N`）→ 销户/换卡。
2. **消费交易生命周期**：授权请求（实时，占用额度）→ 清算/日终入账（批量，落 TRANSACT、更新余额与
   交易类别累计）→ 循环利息计提 → 出账 → 账单支付（全额还款）→ 逾期/超限拒付。
3. **日终批处理**：日交易文件 → 校验 → 入账/拒付 → 利息计提 → 交易报表 → 备份/导出。
4. **管理维护**：用户与权限、交易类型/类别、账户/卡片资料、过期授权清理。

### 1.4 系统边界

- **属于本系统**：客户/账户/卡/交易/授权主数据与账务处理、额度控制、循环利息、账单支付、
  用户权限、报表数据口径、分行迁移导入导出。
- **不属于本系统**（代码中无实现，不得在目标系统中臆造）：卡组织清算网络接入、商户收单、
  总账（GL）记账与会计分录、授信审批与评分模型、催收、反洗钱名单匹配、争议/chargeback 流程。
- 依据：全部 44 个程序的 SQL/CICS 语句与 JCL 中无上述外部实体；`AUTHFRDS` 仅有欺诈标记字段，
  无名单匹配逻辑（`AUTHFRDS.ddl:24`；`COPAUS2C.cbl` 功能注释为 Mark Authorization Message Fraud）。

---

## 2. L2 领域模型

### 2.1 聚合与实体

| 实体 | 主键 | 关键属性 | 关系 | 证据 |
|---|---|---|---|---|
| Customer | CUST-ID 9(9) | 姓名、地址、SSN、DOB、FICO、EFT、主卡标志 | 1:N Card（经 Xref） | `CVCUS01Y.cpy:4-23` |
| Account | ACCT-ID 9(11) | 状态、当前余额、信用额度、现金额度、开户/到期/重发日、本期贷/借、ZIP、组 ID | 1:N Card（经 Xref）、1:N Transaction（经卡号） | `CVACT01Y.cpy:4-17` |
| Card | CARD-NUM X(16) | 卡账户、CVV、凸印名、有效期、状态 | N:1 Account | `CVACT02Y.cpy:4-12` |
| CardXref | CARD-NUM X(16) | 客户 ID、账户 ID | 连接 Card↔Customer↔Account | `CVACT03Y.cpy:4-9` |
| Transaction | TRAN-ID X(16) | 类型、类别、来源、金额、商户五元组、卡号、原始/处理时间戳 | N:1 Account（经卡号） | `CVTRA05Y.cpy:4-17` |
| DailyTransaction | DALYTRAN-ID X(16) | 同 Transaction | 入账前暂存 | `CVTRA06Y.cpy:4-16` |
| TranCategoryBalance | (ACCT-ID, TYPE-CD, CAT-CD) | 累计发生额 | N:1 Account | `CVTRA01Y.cpy:4-10` |
| DisclosureGroup | (GROUP-ID, TYPE-CD, CAT-CD) | 年利率 | 决定利息 | `CVTRA02Y.cpy:4-10` |
| TranType / TranCategory | TYPE-CD / (TYPE-CD,CAT-CD) | 描述 | 参照数据 | `CVTRA03Y.cpy`；`CVTRA04Y.cpy` |
| SecUser | SEC-USR-ID X(8) | 姓、名、密码、类型 | — | `CSUSR01Y.cpy:17-23` |
| PendingAuthSummary | PA-ACCT-ID | 信用额度、现金额度、信用余额、批准/拒绝笔数与金额 | 1:N PendingAuthDetail | `CIPAUSMY`（IMS 段）；`COPAUA0C.cbl:798-830` |
| PendingAuthDetail | (PA-ACCT-ID, PA-AUTH-DATE-9C, ...) | 授权明细、响应码/原因、欺诈标记 | N:1 Summary | `CIPAUDTY`；`COPAUA0C.cbl:874` |
| AuthFraud | (CARD_NUM, AUTH_TS) | 授权请求/响应全字段、欺诈标记 | 独立审计表 | `AUTHFRDS.ddl:1-28` |

### 2.2 状态与代码枚举（统一语言的一部分）

| 枚举 | 取值 | 语义 | 证据 |
|---|---|---|---|
| ACCT-ACTIVE-STATUS | `Y` / `N` | 账户可用/停用 | `COACTUPC.cbl:1856-1893` |
| CARD-ACTIVE-STATUS | `Y` / `N` | 卡片可用/停用 | `COCRDUPC.cbl:845-873` |
| SEC-USR-TYPE | `A` / `U` | 管理员/普通用户（仅 `A` 进管理员菜单） | `COSGN00C.cbl:230-240` |
| 授权响应码 | `00` 批准 / `05` 拒绝 | 同时写 `AUTH_RESP_REASON` | `COPAUA0C.cbl:685-698` |
| 授权拒绝原因 | `3100` 卡/账户/客户不存在、`4100` 额度不足、`4200` 卡未激活、`4300` 账户关闭、`5100` 卡欺诈、`5200` 商户欺诈、`9000` 其他 | 目标系统实现；遗留代码仅 3100/4100 被实际触发 | `COPAUA0C.cbl:699-718`（4200/4300/5100/5200 的 88 条件从未 SET） |
| 入账校验失败码 | `100` 卡号无效、`101` 账户不存在、`102` 超限、`103` 账户已过期、`109` 账户更新失败 | 写 DALYREJS | `CBTRN02C.cbl:385-420,556-558` |
| 交易类型 | `01` 消费、`02` 支付、`03` 贷记、`04` 授权、`05` 退款、`06` 冲正、`07` 调整 | 参照数据 | `app/data/ASCII/trantype.txt` |
| 交易类别 | `010001` 常规销售、`010002` 现金预支、`010003` 便利支票、`010004` ATM 预支、`010005` 利息 | 参照数据 | `app/data/ASCII/trancatg.txt` |
| 用户类型标记 | `U`（菜单项）/ `A`（管理员专用） | 菜单可见性 | `COMEN02Y.cpy:21-90` |

### 2.3 关键语义（易误解，必须在目标系统保持一致）

1. `ACCT-CURR-BAL` 是**欠款余额**（消费增加、还款减少），不是可用余额（`CBTRN02C.cbl:547-552`）。
2. 可用额度 = `ACCT-CREDIT-LIMIT − ACCT-CURR-BAL`（无待授权汇总时）
   或 `PA-CREDIT-LIMIT − PA-CREDIT-BALANCE`（有待授权汇总时）（`COPAUA0C.cbl:665-683`）。
3. `TRAN-CAT-BAL` 是**按类型+类别累计发生额**，不是账户余额（`CVTRA01Y.cpy:4-10`）。
4. 账单支付的交易金额为正数，但**扣减**余额（`COBIL00C.cbl:224,234`）。
5. 客户的 `CITY` 实际存放在 `CUST-ADDR-LINE-3`（`COACTVWC.cbl:471-525`；`COACTUPC.cbl:1322-1355`）。
6. 利息 = `TRAN-CAT-BAL × 年利率 ÷ 1200`，按账户汇总后**一次性**加到余额，并清零本期贷/借累计
   （`CBACT04C.cbl:462-468,350-354`）。

---

## 3. L3 流程模型

### P1 登录与分流（COSGN00C）

| 步骤 | 动作 | 规则 | 证据 |
|---|---|---|---|
| 1 | 校验用户号/密码非空 | BR-SGN-01 | `COSGN00C.cbl:118-127` |
| 2 | 输入转大写后读 USRSEC | BR-SGN-02 | `:132-136,211-219` |
| 3 | 密码明文等值比较 | BR-SGN-03（缺陷：新增用户不转大写） | `:223`；`COUSR01C.cbl:157` |
| 4 | `SEC-USR-TYPE='A'` → 管理员菜单，否则普通菜单 | BR-SGN-04 | `:230-240` |

异常分支：用户不存在 / 密码错误 / 文件错误三类消息（`:241-256`）。

### P2 账户视图与维护（COACTVWC / COACTUPC）

流程：输入账户号 → CXACAIX（账户→客户）→ ACCTDAT → CUSTDAT → 展示/编辑 → 校验 → `READ UPDATE`
双方记录 → 并发比对 → `REWRITE` 账户 → `REWRITE` 客户（客户失败 `SYNCPOINT ROLLBACK`）。
证据：`COACTUPC.cbl:2568-2580,9600-WRITE-PROCESSING 3888-4104,9700-CHECK-CHANGE-IN-REC 4109-4191`。
决策点：状态 Y/N、5 个金额、3 组日期、DOB/SSN/FICO/姓名/地址/电话/EFT/主卡标志（BR-ACTUP-*）。
**关键结论**：这是一个跨越 Account 与 Customer 两个聚合的"事务脚本"，在 DDD 拆分中必须拆成
两个上下文的两条用例，不能保留为单一聚合事务。

### P3 卡片列表/详情/维护（COCRDLIC / COCRDSLC / COCRDUPC）

- 列表：CARDDAT 全文件键序扫描，每页 7 行，`PF7/PF8` 前后翻页，行动作 `S`(查看)/`U`(修改)，
  单选约束（`COCRDLIC.cbl:1123-1261,1264-1380,1073-1121`）。
- 详情：仅按卡号主键读取，不校验卡与账户归属（`COCRDSLC.cbl:726-773`）。
- 维护：卡名（字母+空格）、状态 Y/N、到期月 1-12、到期年 1950-2099；PF5 保存前做并发比对
  （`COCRDUPC.cbl:806-944,1420-1495`）。缺陷：重写时把 CVV 覆盖为空（`:1464-1465`）。

### P4 交易录入（COTRN02C）

账户号或卡号二选一 → 交叉校验 XREF → 必填校验（类型/类别/来源/描述/金额/原始日期/处理日期/
商户 ID/名称/城市/邮编）→ 金额与日期格式校验 → 交易号取"当前最大 +1" → 写 TRANSACT。
证据：`COTRN02C.cbl:193-230,235-437,442-466`。异常：卡/账户不存在、重复交易号、写失败。

### P5 日终入账（CBTRN02C）

逐笔：读 DALYTRAN → 校验卡号（100）→ 账户存在（101）→ 超限（102，`信用额度 ≥ 本期贷−借+本笔`）
→ 账户到期日 ≥ 交易原始日期（103）→ 通过则：更新 TCATBAL（无记录则创建）、更新 ACCOUNT
（余额、本期贷/借）、写 TRANSACT；失败写 DALYREJS 并计数；有拒付则返回码 4。
证据：`CBTRN02C.cbl:202-232,370-422,424-444,467-559`。

### P6 利息计提（CBACT04C）

按 TCATBAL 键序（账户+类型+类别）遍历 → 账户切换时结算上一账户 → 查披露组利率（缺失时用
`DEFAULT` 组）→ 利率非 0 时计息并写交易（类型 01/类别 0005，来源 System）→ 账户结算：
余额 += 累计利息、清零本期贷/借。证据：`CBACT04C.cbl:188-222,415-460,462-500,350-354`。
说明：`1400-COMPUTE-FEES` 为空实现（`:518-520`），费用计算未实现。

### P7 账单支付（COBIL00C）

账户号 → 读账户 → 余额 ≤ 0 拒绝（"You have nothing to pay"）→ 用户确认 → 取账户对应卡号 →
新增交易（类型 02/类别 0002/来源 POS TERM/描述 BILL PAYMENT - ONLINE/金额=余额/商户
999999999/BILL PAYMENT/N/A/N/A）→ 写 TRANSACT → 余额 -= 金额 → 更新 ACCOUNT。
证据：`COBIL00C.cbl:169-244`。**该流程跨"交易"与"账户"两个聚合**，目标系统需要用例编排。

### P8 授权决策（COPAUA0C）

从 MQ 取请求（逗号分隔：授权日期/时间/卡号/授权类型/卡有效期/消息类型/来源/…）→ 读 XREF(3100)
→ 读 ACCOUNT/ CUSTOMER(3100) → 读待授权汇总 → 有汇总用 `额度−信用余额`，否则用
`额度−当前余额`；金额 > 可用额度 → 拒绝 4100 → 回写响应（`00` 批准/`05` 拒绝 + 原因码）→
MQ 应答 → 更新汇总（批准：笔数+金额+信用余额；拒绝：笔数+金额）→ 插入授权明细。
证据：`COPAUA0C.cbl:328-332,438-466,660-731,738-780,798-830`。
目标系统需补齐遗留死代码对应的业务意图（4200/4300/5100/5200）。

### P9 授权查询与欺诈标记（COPAUS0C / COPAUS1C / COPAUS2C）

按账户查看待授权汇总与明细；对单笔授权标记欺诈。证据：三程序功能注释（`* Function` 行）。

### P10 报表（CORPT00C → CBTRN03C）

在线选择报表类型（月度/年度/自定义日期）→ 校验日期 → 确认 → 生成 JCL 写入 TDQ JOBS 提交批作业。
批作业按卡号排序、按处理日期闭区间过滤、每 20 行分页、三级合计（页/账户/总计）。
证据：`CORPT00C.cbl:212-256,388-426,498-535`；`CBTRN03C.cbl:173-203,282-322`；
`proc/TRANREPT.prc:35-49`。缺陷：EOF 分支重复计入最后一笔（`:197-203`）。

### P11 用户维护（COUSR00C-03C）

列表每页 10 行（PF7/PF8）、行动作 U/D → 修改/删除程序；新增仅非空校验；修改 PF3 同时保存；
删除无"不能删除自己/最后一个管理员"保护。证据见 §1.2 C2 及 `COUSR00C.cbl:187-215`、
`COUSR02C.cbl:111-126`、`COUSR03C.cbl:174-192`。

### P12 过期授权清理（CBPAUP0C）

参数（过期天数, 检查点频率, 显示频率, 调试标志）→ 遍历 PAUTSUM0/PAUTDTL1 → 授权日龄 ≥ 过期天数
→ 删除明细并回退汇总计数 → 汇总笔数为 0 时删除汇总。证据：`CBPAUP0C.cbl:156,196-209,280-346`。
缺陷：样例参数 `00` 会清理当天授权；删除汇总条件重复判断批准笔数；删除明细不回退信用余额。

### P13 分行迁移导出/导入（CBEXPORT / CBIMPORT）

导出：按 C→A→X→T→D 顺序写 500 字节多记录类型文件（含固定分行 `0001`/区域 `NORTH`）。
导入：按记录类型分派到 5 个输出文件，未知类型写错误文件；无校验和/重复键校验。
证据：`CBEXPORT.cbl:151-157,269-551`；`CBIMPORT.cbl:272-285,449-478`。

### P14 系统集成（COACCT01 / CODATE01）

MQ 触发（CKTI）→ 循环 GET（等待 5 秒，每消息 SYNCPOINT）→ `INQA` + 11 位账户号 → 读 ACCTDAT
→ 返回带标签文本；请求 `MSGID/CORRELID` 原样回填。证据：`COACCT01.cbl:191-198,325-350,393-426`。

---

## 4. L4 系统模型

### 4.1 程序与职责（分组）

| 分组 | 程序 | 职责 |
|---|---|---|
| 在线-公共 | COSGN00C、COMEN01C、COADM01C、COBSWAIT、CSUTLDTC | 登录、菜单、等待、日期校验子程序 |
| 在线-账户 | COACTVWC、COACTUPC | 账户视图、账户+客户维护 |
| 在线-卡片 | COCRDLIC、COCRDSLC、COCRDUPC | 列表分页、详情、维护 |
| 在线-交易 | COTRN00C、COTRN01C、COTRN02C、COBIL00C | 列表、详情、录入、账单支付 |
| 在线-用户 | COUSR00C/01C/02C/03C | 用户增删改查 |
| 在线-报表 | CORPT00C | 报表参数与 JCL 提交 |
| 批处理-账户 | CBACT01C、CBACT02C、CBACT03C、CBACT04C、CBCUS01C | 账户/卡/交叉引用打印、利息 |
| 批处理-交易 | CBTRN01C、CBTRN02C、CBTRN03C | 日交易校验、入账、报表 |
| 批处理-迁移 | CBEXPORT、CBIMPORT | 分行迁移导出/导入 |
| 授权子应用 | COPAUA0C、COPAUS0C、COPAUS1C、COPAUS2C、CBPAUP0C | 授权决策、查询、欺诈标记、清理 |
| 交易类型子应用 | COTRTLIC、COTRTUPC、COBTUPDT | DB2 交易类型/类别维护 |
| MQ 子应用 | COACCT01、CODATE01 | MQ 账户查询、日期查询 |

### 4.2 调用关系

- 在线程序之间**全部为 `XCTL`**（无 `LINK`），通过 2000 字节 COMMAREA 传递上下文
  （`COCOM01Y.cpy` 前 160 字节 + 各程序私有区）。
- 唯一子程序调用：`CALL 'CSUTLDTC'`（日期校验，`COTRN02C.cbl:393-415`；`COACTUPC.cbl` 日期段）。
- 异常终止：`CALL 'CEE3ABD'`（批处理 I/O 失败）。
- 外部调用：MQ (`MQOPEN/MQGET/MQPUT1/MQCLOSE`)、IMS (`EXEC DLI`)、DB2 (`EXEC SQL`)。

### 4.3 数据存储

- **VSAM KSDS**：ACCTDAT、CARDDAT、CCXREF(+CXACAIX 备用索引)、CUSTDAT、TRANSACT、USRSEC、
  TCATBALF、DISCGRP、TRANTYPE、TRANCATG；顺序文件 DALYTRAN、DALYREJS。
- **DB2**：`CARDDEMO.TRANSACTION_TYPE`、`CARDDEMO.TRANSACTION_TYPE_CATEGORY`、
  `CARDDEMO.AUTHFRDS`。
- **IMS**：`PAUTSUM0`（根段，按账户）→ `PAUTDTL1`（子段，按 `99999−YYDDD` 逆序）。
- **TDQ**：`JOBS`（EXTRA/INREADER，80 字节固定）。

### 4.4 接口

| 接口 | 形式 | 契约要点 | 证据 |
|---|---|---|---|
| 终端-在线 | BMS 屏幕 + AID 键 | 21 个 mapset；PF3/PF4/PF5/PF7/PF8/PF12 | `app/bms/*.bms`；`app/cpy-bms/*.CPY` |
| 程序-程序 | COMMAREA 2000 字节 | CDEMO 状态机 `PGM-ENTER/REENTER` | `COCOM01Y.cpy` |
| 报表提交 | TDQ JOBS（80 字节 × 20 行 JCL） | 含 SYMNAMES 日期参数 | `CORPT00C.cbl:81-127,498-535` |
| 授权请求/应答 | IBM MQ 字符串 | 逗号分隔 13+ 字段；应答 6 字段 | `COPAUA0C.cbl:354-370,722-731` |
| 账户/日期查询 | IBM MQ 字符串 | `INQA` + 11 位账户号；5 秒等待 | `COACCT01.cbl:105-112,393-426` |
| 文件级 | JCL DD / VSAM | 记录长度 50/60/150/300/350/500 | 各 copybook 头注释 |

---

## 5. L5 实施模型

### 5.1 运行时拓扑

- z/OS + CICS 区域（CARDDEMO group）+ IMS DB/DC（DBPAUTP0、PSBPAUTB）+ DB2 + IBM MQ + JES。
- 在线事务码：CC00（登录）、CM00（主菜单）、CA00（管理员菜单）、CAVW（账户视图）、CAUP（账户更新）、
  CCLI/CCDL/CCUP（卡片列表/详情/更新）、CT00/CT01/CT02（交易列表/详情/录入）、CB00（账单支付）、
  CU00-CU03（用户）、CR00（报表）、COTR/COTU（交易类型）、CDRA/CDRD（MQ）、CP00（授权）。
- 证据：`app/csd/CARDDEMO.CSD`、`app/app-authorization-ims-db2-mq/csd/CRDDEMO2.csd`、
  `app/app-transaction-type-db2/csd/*.csd`、`app/app-vsam-mq/csd/CRDDEMOM.csd`。

### 5.2 批作业编排

| 作业 | 主程序 | 输入→输出 | 调度语义 |
|---|---|---|---|
| POSTTRAN | CBTRN02C | DALYTRAN→TRANSACT/TCATBALF/ACCTDAT/DALYREJS | 日终入账 |
| INTCALC | CBACT04C（PARM=YYYYMMDDHH） | TCATBALF/DISCGRP/ACCTDAT→SYSTRAN | 日终/月结计息 |
| TRANREPT | REPROC → SORT → CBTRN03C | TRANSACT→TRANREPT(133) | 按需/日终报表 |
| CBEXPORT / CBIMPORT | 同名程序 | 5 个 VSAM ↔ EXPFILE(500) | 分行迁移 |
| CBPAUP0J | CBPAUP0C（BMP） | IMS PAUTSUM0/PAUTDTL1 | 日终清理 |
| ACCTFILE/CARDFILE/CUSTFILE/XREFFILE/TRANFILE/TCATBALF/TRANTYPE | CBACT01C/02C/03C/CBCUS01C | VSAM→打印 | 运维打印 |
| DALYREJS | IDCAMS PRINT | DALYREJS→打印 | 拒付报表 |
| PRTCATBL | IDCAMS | TCATBALF→打印 | 对账辅助 |

### 5.3 运行约束（迁移必须保留或显式替换）

1. 键序扫描与分页（卡片每页 7、交易/用户每页 10）。
2. `READ UPDATE` 加锁 + 快照比对实现乐观并发（`COACTUPC.cbl:4109-4191`）。
3. 状态机 COMMAREA（首次进入/重入），在 Web 会话中被无状态 HTTP 语义替代。
4. 批作业失败即 ABEND（返回码 16/999），迁移后需改为批量结果 + 拒付明细。
5. MQ 触发任务按 5 秒窗口批量消费。

---

## 6. 未解决项跟踪（L3 要求）

| 编号 | 未解决项 | 影响 | 责任人 | 预计解决 | 临时处置 |
|---|---|---|---|---|---|
| U1 | 生产交易量/峰值 TPS 未知（仅演示数据） | 影响容量与分区设计 | 存量系统负责人 | 目标系统压测前 | 按单实例 100 TPS 设计，压测后调整 |
| U2 | `AUTHFRDS` 与 IMS 待授权数据在生产的历史规模未知 | 影响授权服务数据迁移与清理策略 | DBA | 迁移方案评审前 | 只迁移近 5 天未过期授权 |
| U3 | 卡组织授权报文规范（ISO8583 域映射）未在代码中体现 | 授权服务对外契约需重新确认 | 支付架构师 | 接口设计阶段 | 先按 legacy 逗号分隔契约实现，抽象为 DTO |
| U4 | 商户欺诈（5200）判定数据源不存在 | 该拒绝码无法在生产触发 | 风控 | 需求澄清 | 保留原因码，暂以"卡级欺诈标记"实现 5100 |
| U5 | 报表格式验收标准（133 字节排版） | 影响监管/运营验收 | 运营 | UAT 前 | 新系统输出 JSON + CSV，排版由报表平台负责 |
| U6 | 密码策略与加密要求（遗留为明文 8 位） | 安全合规 | 安全 | 上线前 | PBKDF2 存储 + 最小长度校验，见 ADR-0008 |

## 7. 存量风险量化（L3）

| 指标 | 数量 | 证据 |
|---|---|---|
| COBOL 程序 | 44 | `glob **/*.cbl` |
| Copybook | 62（41 .cpy + 21 .CPY，其中 17 个 BMS map） | `app/cpy`、`app/cpy-bms` |
| DB2 表 | 3 | `ddl/*.ddl` |
| VSAM 文件 | 12（含 1 个备用索引 CXACAIX） | `app/csd/CARDDEMO.CSD` DEFINE FILE |
| IMS 段 | 2（PAUTSUM0、PAUTDTL1） | `ims/DBPAUTP0.dbd`、`PSBPAUTB.psb` |
| 对外接口 | 6 类（BMS 终端、COMMAREA、TDQ、MQ 授权、MQ 查询、文件/JCL） | §4.4 |
| CICS 事务 | 约 20 | 各 CSD |
| 批作业（JCL） | 40 个文件 | `app/jcl` |

高风险程序：`COPAUA0C`（授权决策，直接拒绝/批准交易）、`CBTRN02C`（入账与额度校验）、
`CBACT04C`（利息与余额）、`COBIL00C`（资金扣减）、`COACTUPC`（账户/客户资料与额度）。

## 8. 迁移影响评估（L3）

| 项 | 结论 |
|---|---|
| 需修改的存量程序 | 0（绿地新建，存量系统保持只读并行运行） |
| 需重写的程序 | 38（在线 25 + 批处理/工具 13，清单见 `01-codebase-inventory.md` §8） |
| 可废弃程序 | 6（COBSWAIT、CSUTLDTC、CBACT01C/02C/03C、CBCUS01C） |
| 数据迁移对象 | 9 个 ASCII 数据文件共 626 条记录（客户/账户/卡/交叉引用/日交易/交易类型/类别/披露组/类别余额），导入前须解码 EBCDIC 过穿孔数值 |
| 迁移窗口 | 存量与新系统双跑 ≥ 2 个账务周期；只读查询切流先行，写操作最后切换 |

## 9. 业务连续性（L3）

| 项 | 方案 |
|---|---|
| 停机时长 | 目标 0 停机：双跑 + 只读切流；写切换窗口 ≤ 30 分钟（日终后） |
| 回退方案 | 保留 COBOL 系统与 VSAM 数据只读快照；切换失败时回退 CICS 事务路由，新系统数据按日终对账冲销 |
| 应急流程 | 授权不可用 → 降级为 COBOL 授权子应用；入账失败 → 保留 DALYTRAN 原文件在 COBOL 侧重跑 |
| 核心程序 BCP | `COPAUA0C`（授权）、`CBTRN02C`（入账）必须有独立 BCP 与演练记录 |
