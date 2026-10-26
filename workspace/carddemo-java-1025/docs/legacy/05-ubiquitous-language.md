# 05 统一语言词汇表（CardDemo 遗留系统 → 新系统）

**证据约定**：第 4 列 `文件:行号` 为 `carddemo-cobol` 源码真实行；第 5 列是**新系统设计建议**（非遗留事实，无源码证据），仅用于把遗留语义对齐到领域概念。凡遗留系统中确实不存在的概念，第 4 列写"遗留无对应（见 §3）"。

## 1. 核心术语表

| 英文术语 | 中文 | 定义 | 遗留实现证据 | 新系统对应概念/服务（建议） |
|---|---|---|---|---|
| Customer | 客户 | 持有信用卡账户的自然人主体，以 9 位 CUST-ID 标识，资料含姓名、3 行地址、SSN、FICO 分 | `CVCUS01Y.cpy:4-22`、`CUSTFILE.jcl:46-52`、`COACTUPC.cbl:3871` | Customer 聚合根 / customer-service |
| Account | 账户 | 信用卡账户，11 位 ACCT-ID；承载信用额度、已用额度、本周期累计、披露组 | `CVACT01Y.cpy:4-16`、`ACCTFILE.jcl:36-42` | CreditAccount 聚合根 / account-service |
| Card | 卡 | 卡号 16 位、CVV、凸印名、到期日、状态；一张卡必属一个账户 | `CVACT02Y.cpy:4-10`、`COCRDLIC.cbl:213-217` | Card 实体 / card-service |
| Card Xref | 卡账户交叉引用 | 卡号→(客户 ID, 账户 ID) 的唯一映射；主键卡号，另有按账户号的备用索引 | `CVACT03Y.cpy:4-7`、`XREFFILE.jcl:72-77`、`CARDDEMO.CSD:63-64` | CardAccountLink（双唯一索引：card_no / acct_id） |
| Transaction | 交易 | **已入账**的账务明细，16 位 TRAN-ID 主键，350 字节，含商户与两个时间戳 | `CVTRA05Y.cpy:4-17`、`CBTRN02C.cbl:424-442` | LedgerEntry / ledger-service |
| Daily Transaction | 日交易 | **待入账**的外部流水（QSAM 顺序文件，无键、可重放），逐笔校验后转成 Transaction 或进拒绝文件 | `CVTRA06Y.cpy:4-17`、`POSTTRAN.jcl:23-38` | TransactionInflow（ingestion 暂存表）/ ingestion-service |
| Transaction Category Balance | 交易类别余额 | 账户 × 交易类型 × 交易类别的**累计发生额**，用于计息基数；与账户余额无关 | `CVTRA01Y.cpy:4-9`、`CBACT04C.cbl:462-466` | CategoryAccumulator（维度聚合）/ ledger-service |
| Disclosure Group | 披露组 | 按 (组标识, 类型, 类别) 决定年利率的定价表；三组取值 `A`、`DEFAULT`、`ZEROAPR` | `CVTRA02Y.cpy:4-9`、`discgrp.txt:1-51`、`CBACT04C.cbl:415-460` | InterestRatePlan / pricing-service |
| Transaction Type | 交易类型 | 两位业务动作分类 `01`-`07`（Purchase…Adjustment） | `CVTRA03Y.cpy:5-6`、`trantype.txt:1-7`、`TRNTYPE.ddl:1-4` | 枚举 TransactionType |
| Transaction Category | 交易类别 | 类型下的 4 位细分类别 `0001`-`0005`，决定计息与账务口径 | `CVTRA04Y.cpy:6-8`、`trancatg.txt:1-18`、`TRNTYCAT.ddl:1-7` | 枚举 TransactionCategory |
| Authorization | 授权 | 对一笔卡交易做实时额度判定并返回响应码/原因码；结果写入 IMS 挂起授权（DB2 仅在人工标记欺诈时写入） | `COPAUA0C.cbl:440-470`、`:660-716` | AuthorizationDecision / authorization-service |
| Pending Authorization | 挂起授权（预授权） | 已批准但尚未匹配入账的授权，占用可用额度；汇总段+明细段两层结构；过期由批量删除 | `CIPAUSMY.cpy:19-31`、`CIPAUDTY.cpy:19-54`、`DBPAUTP0.dbd:28-37`、`CBPAUP0C.cbl:284-296` | PendingAuth 聚合 + 额度预占（Authorization Hold） |
| Authorization Response Code | 授权响应码 | `00`=批准、`05`=拒绝；同时决定批准金额取值 | `COPAUA0C.cbl:685-695`、`AUTHFRDS.ddl:9` | 枚举 AuthDecision（APPROVED/DECLINED） |
| Decline Reason | 拒绝原因码 | 4 位：`0000` 无、`3100` 主体不存在、`4100` 额度不足、`4200` 卡未激活、`4300` 账户关闭、`5100` 卡欺诈、`5200` 商户欺诈、`9000` 其他 | `COPAUA0C.cbl:698-716`、`AUTHFRDS.ddl:10` | 枚举 DeclineReason（与响应码分离） |
| Fraud Flag | 欺诈标记 | 授权明细上的 `F`=确认欺诈、`R`=解除欺诈；确认时落 DB2 并记报告日期 | `CIPAUDTY.cpy:50-53`、`COPAUS2C.cbl:81-82,137`、`AUTHFRDS.ddl:24-25` | FraudCase / fraud-service |
| Credit Limit | 信用额度 | 账户级总授信；可用额=额度−已用额度（运行时计算，不落库） | `CVACT01Y.cpy:8`、`COPAUA0C.cbl:666-676` | CreditAccount.creditLimit + 计算属性 availableCredit |
| Cash Credit Limit | 取现额度 | 现金预借的独立上限；遗留仅存储与展示，**无任何校验逻辑** | `CVACT01Y.cpy:9`、`CIPAUSMY.cpy:24`、`COPAUA0C.cbl:810` | CashAdvanceLimit 值对象（需补校验规则） |
| Current Cycle Credit/Debit | 本周期贷记/借记累计 | 两个 12 字节金额字段；按代码：**正数交易累加进 CREDIT、负数交易累加进 DEBIT**（命名与字面方向相反） | `CVACT01Y.cpy:13-14`、`CBTRN02C.cbl:548-551` | BillingCycleAccumulator（含正负方向语义） |
| Bill Payment | 账单支付 | 在线全额还款：金额=当前欠款、写 `02`/`0002` 交易、把欠款减至 0；欠款 ≤0 时拒绝 | `COBIL00C.cbl:198-202`、`:212-236`、`trancatg.txt:7` | BillPayment / payment-service |
| Interest Accrual | 计息 | 月息 = 类别余额 × 披露组年利率 ÷ 1200；生成 `01`/`0005` "System" 交易；手续费段为空实现 | `CBACT04C.cbl:464-465`、`:474-495`、`:518-520` | InterestAccrual / interest-service |
| Posting | 入账 | 把日交易校验通过后落为 Transaction，并更新类别余额与账户余额（正负方向一致累加） | `CBTRN02C.cbl:424-445`、`:467-556`、`POSTTRAN.jcl:23` | PostingService（批量 + 实时同构） |
| Reject | 入账拒绝 | 校验失败时把整条 350 字节日交易 + 80 字节校验尾部写入 DALYREJS | `CBTRN02C.cbl:446-461`、`POSTTRAN.jcl:34-38` | PostingException 队列 + 失败码枚举 |
| Statement / Report | 对账单 / 报表 | 两类输出：①账户对账单（纯文本 + HTML，经 CALL 子程序取数）；②交易明细报表（133 列，账户小计/页合计/总计） | `CBSTM03A.CBL:9-10`、`:351`、`CBTRN03C.cbl:5`、`CVTRA07Y.cpy:4-66` | StatementService / reporting-service |
| User Type | 用户类型 | `A`=管理员（进 CA00 管理菜单）、`U`=普通用户（进 CM00 主菜单） | `CSUSR01Y.cpy:22`、`COCOM01Y.cpy:27-28`、`COSGN00C.cbl:230-238` | IAM 角色 ADMIN / USER |
| Sign-on | 登录 | 输入 8 位用户 ID 与口令，与 USRSEC 明文比对，成功后按用户类型 XCTL 到对应菜单 | `COSGN00C.cbl:132-137`、`:209-239` | Identity Provider / SSO 会话 |
| Branch Migration | 分行迁移 | 把 5 类主文件导出为 500 字节多记录文件（C/A/X/T/D 五种记录型），再在目标侧拆解、校验、重建规范化文件 | `CBEXPORT.cbl:5-8`、`CBIMPORT.cbl:5-10`、`CVEXPORT.cpy:3-19` | MigrationService（导出/导入 + 校验报告） |
| Anti-Corruption Layer | 防腐层 | 新系统与遗留语义之间的翻译层：定长 copybook 解析、EBCDIC 过穿孔解码、码值枚举映射、金额/标识符规整 | 遗留无此概念；同类职责由 `CBIMPORT`（拆解+校验）与 `CBEXPORT`（组装）承担：`CBIMPORT.cbl:272-330` | acl-adapter 模块（独立、可测试） |
| Merchant | 商户 | 交易对手方：商户号、名称、城市、邮编、MCC | `CVTRA05Y.cpy:11-14`、`AUTHFRDS.ddl:14-21` | Merchant 值对象 |
| Available Credit | 可用额度 | 额度−已用额度；存在挂起授权时改用 IMS 汇总段的额度−授权余额 | `COPAUA0C.cbl:666-676` | 计算属性 AvailableCredit（聚合内保序） |
| Match Status | 匹配状态 | 挂起授权与入账流水的匹配状态：`P` 挂起、`D` 授权即被拒、`E` 挂起过期、`M` 已匹配入账 | `CIPAUDTY.cpy:45-49`、`AUTHFRDS.ddl:23` | 枚举 PendingAuthStatus |
| Cycle / Billing Cycle | 账单周期 | 由账户到期日与本期累计字段隐含表达，遗留无独立周期实体 | `CVACT01Y.cpy:11-14` | BillingCycle 值对象（建议显式建模） |

## 2. 术语冲突与消歧

| 术语 / 字段 | 常见误读 | 遗留系统中的真实语义 | 证据 |
|---|---|---|---|
| `ACCT-CURR-BAL` | "当前可用余额" | 是**已用额度（欠款）**：授权时 `可用额 = ACCT-CREDIT-LIMIT − ACCT-CURR-BAL`；还款时 `ACCT-CURR-BAL = ACCT-CURR-BAL − TRAN-AMT` | `COPAUA0C.cbl:674-675`、`COBIL00C.cbl:234` |
| `TRAN-CAT-BAL`（TranCatBal） | "账户余额" | 是**按 账户+类型+类别 的累计发生额**，只作为计息基数；与账户欠款/额度无关 | `CVTRA01Y.cpy:9`、`CBACT04C.cbl:464-465` |
| BILL PAYMENT 的金额符号 | "还款金额应为负数" | 交易金额是**正数**（=还款前欠款额），却由在线程序直接做减法；若同一笔流经批量入账（`ADD DALYTRAN-AMT TO ACCT-CURR-BAL`）会反向增加欠款 | `COBIL00C.cbl:224`、`:234`、`CBTRN02C.cbl:547` |
| `CUST-ADDR-LINE-3` | "客户没有城市字段，城市缺失" | 城市**存放在第 3 行地址**里，界面上以 `ACSCITY` 字段呈现与回写 | `COACTUPC.cbl:1333`、`:2935`、`COACTVWC.cbl:513` |
| `ACCT-CURR-CYC-CREDIT` / `-DEBIT` | "CREDIT=还款、DEBIT=消费" | 代码按金额正负分流：**正数（消费）进 CREDIT，负数（退款/冲正）进 DEBIT**，与"贷记/借记"字面相反；且超限校验用 `CREDIT − DEBIT + 本次金额`，存在退款时会把退款方向重复计入 | `CBTRN02C.cbl:548-551`、`:403-413` |
| Authorization vs Transaction 的 `04-xxxx` 类别 | "授权也是一笔交易/账务分录" | 授权只写 IMS 挂起授权，**不产生 TRANSACT 记录**（COPAUA0C 无 TRANSACT 文件访问，数据集仅 ACCTDAT/CUSTDAT/CCXREF） | `COPAUA0C.cbl:35-39`、`:472-479` |
| Daily Transaction vs Transaction | 两者混用为"交易" | 前者是待入账流水（无键、可重复投递），后者是已入账明细（唯一键、幂等性无保护） | `CVTRA06Y.cpy:4`、`CVTRA05Y.cpy:4`、`CBTRN02C.cbl:547-553` |
| Fraud Flag 的 `R` | "R = Reject（拒绝）" | `R` = **Fraud Removed（解除欺诈）**；与授权拒绝码 `05`、入账拒绝码 100/101/102/103/109 完全无关 | `CIPAUDTY.cpy:51-52`、`COPAUS2C.cbl:81-82` |
| Decline（授权拒绝）vs Reject（入账拒绝） | 统一叫"拒绝" | Decline 发生在授权：响应码 `05` + 4 位原因码；Reject 发生在入账：4 位校验码写 DALYREJS。两者的码表不可互换 | `COPAUA0C.cbl:688`、`CBTRN02C.cbl:385-419` |
| "过期授权释放额度" | 认为删除过期授权会自动回补可用额度 | `CBPAUP0C` 删除汇总/明细时只冲减 `PA-APPROVED-AUTH-CNT/AMT`、`PA-DECLINED-AUTH-CNT/AMT`，**从不冲减 `PA-CREDIT-BALANCE`**，而可用额正是用 `额度−PA-CREDIT-BALANCE` 计算 → 过期授权会永久占用额度（与扩展 README 的描述不一致） | `CBPAUP0C.cbl:284-296`、`COPAUA0C.cbl:666-667`、`:817` |
| `0000` 拒绝原因 | 认为它代表"拒绝" | `0000` 是**无拒绝原因**（即批准场景的缺省值），拒绝时必有 4 位非零码 | `COPAUA0C.cbl:698-716` |
| 交易类别 `0002` 的三重身份 | 认为类别码全局唯一 | 同一 `0002` 在类型 `01` 是"常规预借现金"、在 `02` 是"电子还款"、在 `04` 是"线上消费授权"——**必须与类型码联合解读** | `trancatg.txt:2,7,13` |

## 3. 遗留无对应概念的说明

| 概念 | 说明 | 证据 |
|---|---|---|
| Anti-Corruption Layer（防腐层） | 遗留系统中不存在显式的翻译层，语义转换散落在 `CBIMPORT`（读 500 字节导出记录 → 逐字段 MOVE 到目标 copybook）与在线程序（`NUMVAL`/`UPPER-CASE` 就地转换）中 | `CBIMPORT.cbl:288-300`、`COTRN02C.cbl:204`、`COSGN00C.cbl:132` |
| 幂等键 / 事件 ID | 日交易无业务唯一号，入账靠文件顺序；重复投递会重复计账 | `CBTRN02C.cbl:547-553` |
| 账单周期实体 | 无周期主数据，周期语义由 `ACCT-CURR-CYC-*` 与到期日隐含 | `CVACT01Y.cpy:11-14` |
| 审计日志 | 无独立审计表/文件；仅授权扩展定义了错误日志记录格式 `CCPAUERY`（由 COPAUA0C 在 `COPY` 后用于 CICS/IMS/MQ 错误记录） | `CCPAUERY.cpy:19-30`、`COPAUA0C.cbl:185` |

## 4. 命名与前缀速查

| 前缀 / 后缀 | 含义 | 证据 |
|---|---|---|
| `CB*` 程序 | 批处理（Batch），如 CBTRN02C、CBACT04C、CBEXPORT | `CBTRN02C.cbl:4`、`CBACT04C.cbl:4` |
| `CO*` 程序 | 在线（CICS），如 COSGN00C、COTRN02C、COPAUA0C | `COSGN00C.cbl:4`、`COTRN02C.cbl:4` |
| 程序名尾字母 `C` | 44 个程序中 33 个以 `C` 结尾（COBOL 成员惯例）；不以 C 结尾的 11 个：COBTUPDT、COACCT01、CODATE01、COBSWAIT、CBEXPORT、CBIMPORT、CBSTM03A、CBSTM03B、PAUDBLOD、PAUDBUNL、DBUNLDGS | 44 个程序文件名 |
| `CV*` copybook | 遗留 VSAM 记录布局（CVACT/CVCUS/CVTRA/CVEXPORT） | `CVACT01Y.cpy:4`、`CVTRA01Y.cpy:4` |
| `CS*` copybook | 公共/系统服务（COMMAREA、日期、消息、用户、DB2 公共段） | `COCOM01Y.cpy:19`、`CSDAT01Y.cpy:2`、`CSUSR01Y.cpy:17` |
| `CI*` copybook | IMS 段布局（CIPAUSMY/CIPAUDTY） | `CIPAUSMY.cpy:19`、`CIPAUDTY.cpy:19` |
| `CC*` copybook | 授权消息与工作区（CCPAURQY/CCPAURLY/CCPAUERY、CVCRD01Y 的 CC-WORK-AREAS） | `CCPAURQY.cpy:19`、`CVCRD01Y.cpy:1` |
| CICS 事务码族 | `CA` 账户、`CC` 卡/登录、`CT` 交易、`CU` 用户、`CM` 主菜单、`CR` 报表、`CB` 账单支付、`CP` 授权、`CD*` MQ 查询（CDRA/CDRD）、`CDV` 开发用 | `CARDDEMO.CSD:306-488`、`CRDDEMO2.csd:39-69`、`CRDDEMOM.csd:17-28` |
| `-TXN`/`-TRN` 缩写 | 遗留代码中 `TRAN` 与 `TRN` 并存（如 TRNNAMEO、TRAN-ID），指同一"交易"概念 | `COBIL00C.cbl:325`、`CVTRA05Y.cpy:5` |

## 5. 未解决项

| 项 | 现状 | 证据 |
|---|---|---|
| 挂起授权过期后额度回补规则 | 代码未实现 `PA-CREDIT-BALANCE` 回退，业务预期（见扩展 README）与实现不一致，待业务确认 | `CBPAUP0C.cbl:284-296` |
| `PA-AUTH-STATUS` 语义 | 字段定义存在但无赋值，无法确认其与 `PA-MATCH-STATUS` 的区别 | `CIPAUSMY.cpy:21` |
| "计息"与"手续费"边界 | `1400-COMPUTE-FEES` 为空段，费用规则未确认 | `CBACT04C.cbl:518-520` |
