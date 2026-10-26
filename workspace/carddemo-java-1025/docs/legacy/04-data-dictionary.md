# 04 数据字典（CardDemo 遗留系统）

**证据约定**：`copybook:行号` 指 `carddemo-cobol/app/cpy`（或子应用 `cpy/`）中真实行；`ddl:行号` 指 `ddl/*.ddl`；`文件:行号` 指 `app/data/ASCII/*.txt`。**未列 FILLER 填充字段**（各实体末尾 FILLER 长度见 copybook 末行），故字段偏移可逐项累加校验。
**长度校验**：Customer 9+25+25+25+50×3+2+3+10+15+15+9+20+10+10+1+3+168 = 500（`CVCUS01Y.cpy:5-23`）；Account 11+1+12+12+12+10+10+10+12+12+10+10+178 = 300（`CVACT01Y.cpy:5-17`）；Transaction 16+2+4+10+100+11+9+50+50+10+16+26+26+20 = 350（`CVTRA05Y.cpy:5-18`）；Export 1+26+4+4+5+460 = 500（`CVEXPORT.cpy:9-19`）。
## 1. 实体、主键与索引

| 实体 | 物理承载 / copybook | 主键 | 备用索引 | 记录长度 | 证据 |
|---|---|---|---|---|---|
| Customer 客户 | CUSTDATA.VSAM.KSDS / CVCUS01Y | CUST-ID | 无 | 500 | `CUSTFILE.jcl:46-52` |
| Account 账户 | ACCTDATA.VSAM.KSDS / CVACT01Y | ACCT-ID | 无 | 300 | `ACCTFILE.jcl:36-42` |
| Card 卡 | CARDDATA.VSAM.KSDS / CVACT02Y | CARD-NUM | **CARDAIX**：CARD-ACCT-ID，`KEYS(11 16)` | 150 | `CARDFILE.jcl:50-58`、`:83-88` |
| CardXref 交叉引用 | CARDXREF.VSAM.KSDS / CVACT03Y | XREF-CARD-NUM | **CXACAIX**：XREF-ACCT-ID，`KEYS(11,25)`——CCXREF 的账户号备用索引 | 50 | `XREFFILE.jcl:39-47`、`:72-77`、`CARDDEMO.CSD:63-64` |
| Transaction 交易主 | TRANSACT.VSAM.KSDS / CVTRA05Y | TRAN-ID | TRANSACT AIX：TRAN-PROC-TS，`KEYS(26 304)` | 350 | `TRANFILE.jcl:49-57`、`:82-88` |
| DailyTransaction 日交易 | DALYTRAN.PS（QSAM）/ CVTRA06Y | 无键（顺序追加） | 无 | 350 | `POSTTRAN.jcl:30-31` |
| TranCategoryBalance 类别余额 | TCATBALF.VSAM.KSDS / CVTRA01Y | ACCT-ID+TYPE-CD+CAT-CD，`KEYS(17 0)` | 无 | 50 | `TCATBALF.jcl:36-44` |
| DisclosureGroup 披露组 | DISCGRP.VSAM.KSDS / CVTRA02Y | GROUP-ID+TYPE-CD+CAT-CD，`KEYS(16 0)` | 无 | 50 | `DISCGRP.jcl:36-44` |
| TranType 交易类型 | TRANTYPE.VSAM.KSDS / CVTRA03Y | TRAN-TYPE，`KEYS(2 0)` | 无 | 60 | `TRANTYPE.jcl:36-44` |
| TranCategory 交易类别 | TRANCATG.VSAM.KSDS / CVTRA04Y | TRAN-TYPE+TRAN-CAT，`KEYS(6 0)` | 无 | 60 | `TRANCATG.jcl:36-44` |
| SecUser 用户 | USRSEC.VSAM.KSDS / CSUSR01Y | SEC-USR-ID，`KEYS(8,0)` | 无 | 80 | `DUSRSECJ.jcl:64-66` |
| AuthFraud 授权欺诈 | DB2 CARDDEMO.AUTHFRDS | (CARD_NUM, AUTH_TS) | XAUTHFRD（CARD_NUM ASC, AUTH_TS DESC，唯一） | 26 列 | `AUTHFRDS.ddl:1-28`、`XAUTHFRD.ddl:1-4` |
| TransactionType（DB2） | DB2 CARDDEMO.TRANSACTION_TYPE | TR_TYPE | XTRAN_TYPE | 2 列 | `TRNTYPE.ddl:1-4`、`XTRNTYPE.ddl:1-4` |
| TransactionTypeCategory（DB2） | DB2 CARDDEMO.TRANSACTION_TYPE_CATEGORY | (TRC_TYPE_CODE, TRC_TYPE_CATEGORY) | X_TRAN_TYPE_CATG；FK→TRANSACTION_TYPE ON DELETE RESTRICT | 3 列 | `TRNTYCAT.ddl:1-7` |
| ExportRecord 导出记录 | EXPORT.DATA.VSAM / CVEXPORT | `KEYS(4 28)`（与 SEQ 错位 1 字节，见 01 §4.1） | 无 | 500 | `CBEXPORT.jcl:32-33` |
| PendingAuthorization 挂起授权（IMS） | DBPAUTP0：PAUTSUM0 根 / PAUTDTL1 子 | ACCNTID 6 字节 / PAUT9CTS 8 字节 | 索引库 DBPAUTX0（PAUTINDX） | 100 / 200 | `DBPAUTP0.dbd:28-37`、`DBPAUTX0.dbd:27-31` |
## 2. 字段级定义
### 2.1 Customer（CUSTDAT / CVCUS01Y，500 字节，PK CUST-ID）与 Account（ACCTDAT / CVACT01Y，300 字节，PK ACCT-ID）

| 实体 | 字段名 | 中文含义 | 类型/长度 | 取值范围/枚举 | 来源 |
|---|---|---|---|---|---|
| 客户 | CUST-ID | 客户号 | 9(09) | 9 位定长前导零（`000000001`） | `CVCUS01Y.cpy:5` |
| 客户 | CUST-FIRST-NAME | 名 | X(25) | 自由文本 | `:6` |
| 客户 | CUST-MIDDLE-NAME | 中间名 | X(25) | 自由文本 | `:7` |
| 客户 | CUST-LAST-NAME | 姓 | X(25) | 自由文本 | `:8` |
| 客户 | CUST-ADDR-LINE-1 | 地址行 1 | X(50) | 街道 | `:9` |
| 客户 | CUST-ADDR-LINE-2 | 地址行 2 | X(50) | 门牌/单元 | `:10` |
| 客户 | CUST-ADDR-LINE-3 | 地址行 3 | X(50) | **实际存放城市（CITY）** | `:11`；`COACTUPC.cbl:1333`、`COACTVWC.cbl:513` |
| 客户 | CUST-ADDR-STATE-CD | 州/省代码 | X(02) | 2 字母（样本 `NC`/`IN`） | `:12`；`custdata.txt:1` |
| 客户 | CUST-ADDR-COUNTRY-CD | 国家代码 | X(03) | 3 字母（样本 `USA`） | `:13`；`custdata.txt:1` |
| 客户 | CUST-ADDR-ZIP | 邮编 | X(10) | 含尾随空格（`12546     `） | `:14` |
| 客户 | CUST-PHONE-NUM-1 | 电话 1 | X(15) | 含括号/连字符 | `:15` |
| 客户 | CUST-PHONE-NUM-2 | 电话 2 | X(15) | 同上 | `:16` |
| 客户 | CUST-SSN | 社会安全号 | 9(09) | 9 位数字，前导零 | `:17` |
| 客户 | CUST-GOVT-ISSUED-ID | 政府证件号 | X(20) | 自由文本 | `:18` |
| 客户 | CUST-DOB-YYYY-MM-DD | 出生日期 | X(10) | `YYYY-MM-DD` | `:19` |
| 客户 | CUST-EFT-ACCOUNT-ID | EFT 账户号 | X(10) | 自由文本 | `:20` |
| 客户 | CUST-PRI-CARD-HOLDER-IND | 主卡持有人标识 | X(01) | `Y` / `N` | `:21`；`COACTUPC.cbl:350` |
| 客户 | CUST-FICO-CREDIT-SCORE | FICO 信用分 | 9(03) | 000-999（样本 274/268） | `:22` |
| 账户 | ACCT-ID | 账户号 | 9(11) | 11 位，前导零 | `CVACT01Y.cpy:5` |
| 账户 | ACCT-ACTIVE-STATUS | 账户状态 | X(01) | `Y` 正常 / `N` 关闭 | `:6`；`COACTUPC.cbl:193` |
| 账户 | ACCT-CURR-BAL | **已用额度（欠款）**，非可用余额 | S9(10)V99 | 金额；可用额=额度−本字段 | `:7`；`COPAUA0C.cbl:674-675` |
| 账户 | ACCT-CREDIT-LIMIT | 信用额度 | S9(10)V99 | 金额 | `:8` |
| 账户 | ACCT-CASH-CREDIT-LIMIT | 取现额度 | S9(10)V99 | 金额 | `:9` |
| 账户 | ACCT-OPEN-DATE | 开户日期 | X(10) | `YYYY-MM-DD` | `:10` |
| 账户 | ACCT-EXPIRAION-DATE | 到期日期 | X(10) | `YYYY-MM-DD`（字段名拼写照原文） | `:11` |
| 账户 | ACCT-REISSUE-DATE | 重发卡日期 | X(10) | `YYYY-MM-DD` | `:12` |
| 账户 | ACCT-CURR-CYC-CREDIT | 本期累计**正数金额**（按代码：正数交易=消费累加在此，字段名与"贷记"字面相反） | S9(10)V99 | 金额 | `:13`；`CBTRN02C.cbl:549` |
| 账户 | ACCT-CURR-CYC-DEBIT | 本期累计**负数金额**（按代码：负数交易=退款/冲正累加在此） | S9(10)V99 | 金额 | `:14`；`CBTRN02C.cbl:551` |
| 账户 | ACCT-ADDR-ZIP | 账单邮编 | X(10) | 文本（样本 `A000000000`） | `:15`；`acctdata.txt:1` |
| 账户 | ACCT-GROUP-ID | 披露组标识 | X(10) | 组码（样本为空；DISCGRP 中为 `A`/`DEFAULT`/`ZEROAPR`） | `:16`；`discgrp.txt:1,18,35` |
### 2.2 Card（CARDDAT / CVACT02Y，150 字节，PK CARD-NUM，AIX=CARDAIX）与 CardXref（CCXREF / CVACT03Y，50 字节，PK XREF-CARD-NUM，AIX=CXACAIX）

| 实体 | 字段名 | 中文含义 | 类型/长度 | 取值范围/枚举 | 来源 |
|---|---|---|---|---|---|
| 卡 | CARD-NUM | 卡号 | X(16) | 16 位数字字符（非数值） | `CVACT02Y.cpy:5` |
| 卡 | CARD-ACCT-ID | 所属账户号 | 9(11) | 外键→ACCT-ID；CARDAIX 键（偏移 16） | `:6`；`CARDFILE.jcl:85` |
| 卡 | CARD-CVV-CD | CVV 码 | 9(03) | 000-999 | `:7` |
| 卡 | CARD-EMBOSSED-NAME | 凸印卡名 | X(50) | 自由文本 | `:8` |
| 卡 | CARD-EXPIRAION-DATE | 卡到期日 | X(10) | `YYYY-MM-DD` | `:9` |
| 卡 | CARD-ACTIVE-STATUS | 卡状态 | X(01) | `Y` 有效 / `N` 失效 | `:10`；`COCRDUPC.cbl:91` |
| 交叉引用 | XREF-CARD-NUM | 卡号（主键） | X(16) | 与 CARD-NUM 同域 | `CVACT03Y.cpy:5` |
| 交叉引用 | XREF-CUST-ID | 客户号 | 9(09) | 外键→CUST-ID | `:6` |
| 交叉引用 | XREF-ACCT-ID | 账户号 | 9(11) | 外键→ACCT-ID；CXACAIX 键（偏移 25） | `:7`；`XREFFILE.jcl:74` |
### 2.3 Transaction（TRANSACT / CVTRA05Y，350 字节，PK TRAN-ID）与 DailyTransaction（DALYTRAN / CVTRA06Y，350 字节，无键）

| 实体 | 字段名 | 中文含义 | 类型/长度 | 取值范围/枚举 | 来源 |
|---|---|---|---|---|---|
| 交易 | TRAN-ID | 交易 ID | X(16) | 最大键 +1；系统交易=`PARM 日期`+序号 | `CVTRA05Y.cpy:5`；`COTRN02C.cbl:444-451`、`CBACT04C.cbl:474-480` |
| 交易 | TRAN-TYPE-CD | 交易类型码 | X(02) | `01`-`07`（§3.3） | `:6` |
| 交易 | TRAN-CAT-CD | 交易类别码 | 9(04) | `0001`-`0005`（§3.4） | `:7` |
| 交易 | TRAN-SOURCE | 交易来源 | X(10) | `POS TERM`/`System`/`OPERATOR` | `:8`；`dailytran.txt:1-2` |
| 交易 | TRAN-DESC | 交易描述 | X(100) | 自由文本 | `:9` |
| 交易 | TRAN-AMT | 交易金额 | S9(09)V99 | 正数=消费，负数=退款/冲正 | `:10` |
| 交易 | TRAN-MERCHANT-ID | 商户号 | 9(09) | 账单支付固定 `999999999` | `:11`；`COBIL00C.cbl:226` |
| 交易 | TRAN-MERCHANT-NAME | 商户名 | X(50) | 账单支付固定 `BILL PAYMENT` | `:12`；`COBIL00C.cbl:227` |
| 交易 | TRAN-MERCHANT-CITY | 商户城市 | X(50) | 账单支付固定 `N/A` | `:13`；`COBIL00C.cbl:228` |
| 交易 | TRAN-MERCHANT-ZIP | 商户邮编 | X(10) | 文本 | `:14` |
| 交易 | TRAN-CARD-NUM | 卡号 | X(16) | 外键→CARD-NUM | `:15` |
| 交易 | TRAN-ORIG-TS | 原始时间戳 | X(26) | `YYYY-MM-DD HH:MM:SS.000000` | `:16` |
| 交易 | TRAN-PROC-TS | 处理时间戳 | X(26) | 同上；AIX 键（偏移 304） | `:17`；`TRANFILE.jcl:84` |
| 日交易 | DALYTRAN-*（13 字段） | 与上表 TRAN-* 逐字段同构（同序、同型、同长） | 合计 350 | 同上；`PROC-TS` 入账时写入当前时间戳 | `CVTRA06Y.cpy:5-17`；`CBTRN02C.cbl:436-438` |
### 2.4 TranCategoryBalance（TCATBALF / CVTRA01Y，50 字节）与 DisclosureGroup（DISCGRP / CVTRA02Y，50 字节）

| 实体 | 字段名 | 中文含义 | 类型/长度 | 取值范围/枚举 | 来源 |
|---|---|---|---|---|---|
| 类别余额 | TRANCAT-ACCT-ID | 账户号（键第 1 段） | 9(11) | 前导零 11 位 | `CVTRA01Y.cpy:6` |
| 类别余额 | TRANCAT-TYPE-CD | 类型码（键第 2 段） | X(02) | `01`-`07` | `:7` |
| 类别余额 | TRANCAT-CD | 类别码（键第 3 段） | 9(04) | `0001`-`0005` | `:8` |
| 类别余额 | TRAN-CAT-BAL | 该账户在该类型+类别下的累计发生额（计息基数） | S9(09)V99 | 金额 | `:9`；`CBACT04C.cbl:465` |
| 披露组 | DIS-ACCT-GROUP-ID | 披露组标识（键第 1 段） | X(10) | `A`/`DEFAULT`/`ZEROAPR` | `CVTRA02Y.cpy:6`；`discgrp.txt:1,18,35` |
| 披露组 | DIS-TRAN-TYPE-CD | 类型码（键第 2 段） | X(02) | `01`-`07` | `:7` |
| 披露组 | DIS-TRAN-CAT-CD | 类别码（键第 3 段） | 9(04) | `0001`-`0005` | `:8` |
| 披露组 | DIS-INT-RATE | 年利率（%） | S9(04)V99 | `00000{`=0.00、`00150{`=1.50、`00250{`=2.50 | `:9`；`discgrp.txt:1-4` |
### 2.5 TranType（TRANTYPE / CVTRA03Y，60 字节）与 TranCategory（TRANCATG / CVTRA04Y，60 字节）

| 实体 | 字段名 | 中文含义 | 类型/长度 | 取值范围/枚举 | 来源 |
|---|---|---|---|---|---|
| 类型 | TRAN-TYPE | 类型码（主键） | X(02) | `01`-`07` | `CVTRA03Y.cpy:5` |
| 类型 | TRAN-TYPE-DESC | 类型描述 | X(50) | 自由文本 | `:6` |
| 类别 | TRAN-TYPE-CD | 类型码（键第 1 段、外键） | X(02) | `01`-`07` | `CVTRA04Y.cpy:6` |
| 类别 | TRAN-CAT-CD | 类别码（键第 2 段） | 9(04) | `0001`-`0005` | `:7` |
| 类别 | TRAN-CAT-TYPE-DESC | 类别描述 | X(50) | 自由文本 | `:8` |
### 2.6 SecUser（USRSEC / CSUSR01Y，80 字节，PK SEC-USR-ID）与 AuthFraud（DB2 AUTHFRDS）

| 实体 | 字段名 | 中文含义 | 类型/长度 | 取值范围/枚举 | 来源 |
|---|---|---|---|---|---|
| 用户 | SEC-USR-ID | 登录用户 ID（主键） | X(08) | 登录时转大写 | `CSUSR01Y.cpy:18`；`COSGN00C.cbl:132` |
| 用户 | SEC-USR-FNAME | 名 | X(20) | 自由文本 | `:19` |
| 用户 | SEC-USR-LNAME | 姓 | X(20) | 自由文本 | `:20` |
| 用户 | SEC-USR-PWD | 口令（明文存储、明文比较） | X(08) | 与输入均转大写后等值比较 | `:21`；`COSGN00C.cbl:223` |
| 用户 | SEC-USR-TYPE | 用户类型 | X(01) | `A` 管理员（→COADM01C）/ `U` 普通用户（→COMEN01C） | `:22`；`COSGN00C.cbl:227-238` |
| 欺诈 | CARD_NUM | 卡号（主键 1） | CHAR(16) NOT NULL | 同 CARD-NUM | `AUTHFRDS.ddl:2` |
| 欺诈 | AUTH_TS | 授权时间戳（主键 2） | TIMESTAMP NOT NULL | 时间戳 | `:3` |
| 欺诈 | AUTH_TYPE | 授权类型 | CHAR(4) | 请求 `PA-RQ-AUTH-TYPE` 原值 | `:4` |
| 欺诈 | CARD_EXPIRY_DATE | 卡有效期 | CHAR(4) | 请求原值 | `:5` |
| 欺诈 | MESSAGE_TYPE | 报文类型 | CHAR(6) | 请求原值 | `:6` |
| 欺诈 | MESSAGE_SOURCE | 报文来源 | CHAR(6) | 请求原值 | `:7` |
| 欺诈 | AUTH_ID_CODE | 授权 ID 码 | CHAR(6) | 取授权时间 | `:8`；`COPAUA0C.cbl:665` |
| 欺诈 | AUTH_RESP_CODE | 授权响应码 | CHAR(2) | `00` 批准 / `05` 拒绝 | `:9`；`COPAUA0C.cbl:688,693` |
| 欺诈 | AUTH_RESP_REASON | 拒绝原因码 | CHAR(4) | `0000`/`3100`/`4100`/`4200`/`4300`/`5100`/`5200`/`9000` | `:10`；`COPAUA0C.cbl:698-716` |
| 欺诈 | PROCESSING_CODE | 处理码 | CHAR(6) | 请求原值 | `:11` |
| 欺诈 | TRANSACTION_AMT | 交易金额 | DECIMAL(12,2) | 金额 | `:12` |
| 欺诈 | APPROVED_AMT | 批准金额 | DECIMAL(12,2) | 批准=交易额、拒绝=0 | `:13`；`COPAUA0C.cbl:689-695` |
| 欺诈 | MERCHANT_CATAGORY_CODE | 商户类别码（MCC，列名拼写照原样） | CHAR(4) | 请求原值 | `:14` |
| 欺诈 | ACQR_COUNTRY_CODE | 收单国家码 | CHAR(3) | 请求原值 | `:15` |
| 欺诈 | POS_ENTRY_MODE | POS 输入方式 | SMALLINT | 请求原值 | `:16` |
| 欺诈 | MERCHANT_ID | 商户号 | CHAR(15) | 请求原值 | `:17` |
| 欺诈 | MERCHANT_NAME | 商户名 | VARCHAR(22) | 请求原值 | `:18` |
| 欺诈 | MERCHANT_CITY | 商户城市 | CHAR(13) | 请求原值 | `:19` |
| 欺诈 | MERCHANT_STATE | 商户州 | CHAR(02) | 请求原值 | `:20` |
| 欺诈 | MERCHANT_ZIP | 商户邮编 | CHAR(09) | 请求原值 | `:21` |
| 欺诈 | TRANSACTION_ID | 交易 ID | CHAR(15) | 请求原值 | `:22` |
| 欺诈 | MATCH_STATUS | 匹配状态 | CHAR(1) | `P` 挂起 / `D` 授权即被拒 / `E` 挂起过期 / `M` 已匹配入账 | `:23`；`CIPAUDTY.cpy:45-49` |
| 欺诈 | AUTH_FRAUD | 欺诈标记 | CHAR(1) | `F` 确认欺诈 / `R` 解除欺诈 | `:24`；`COPAUS2C.cbl:81-82,137` |
| 欺诈 | FRAUD_RPT_DATE | 欺诈报告日期 | DATE | CURRENT DATE | `:25`；`COPAUS2C.cbl:225` |
| 欺诈 | ACCT_ID | 账户号 | DECIMAL(11) | 逻辑外键→ACCT-ID | `:26` |
| 欺诈 | CUST_ID | 客户号 | DECIMAL(9) | 逻辑外键→CUST-ID | `:27` |
### 2.7 TransactionType / TransactionTypeCategory（DB2）与 ExportRecord（EXPORT.DATA / CVEXPORT，500 字节）

| 实体 | 字段名 | 中文含义 | 类型/长度 | 取值范围/枚举 | 来源 |
|---|---|---|---|---|---|
| DB2 类型 | TR_TYPE | 交易类型码（主键） | CHAR(2) | `01`-`07` | `TRNTYPE.ddl:2` |
| DB2 类型 | TR_DESCRIPTION | 类型描述 | VARCHAR(50) | 自由文本 | `:3` |
| DB2 类别 | TRC_TYPE_CODE | 类型码（主键 1、外键→TR_TYPE） | CHAR(2) | `01`-`07` | `TRNTYCAT.ddl:2` |
| DB2 类别 | TRC_TYPE_CATEGORY | 类别码（主键 2） | CHAR(4) | `0001`-`0005` | `:3` |
| DB2 类别 | TRC_CAT_DATA | 类别描述（大写存储，如 `REGULAR SALES DRAFT`） | VARCHAR(50) | 自由文本 | `:4`；`DB2LTCAT.ctl:16` |
| 导出 | EXPORT-REC-TYPE | 记录类型 | X(1) | `C` 客户 / `A` 账户 / `X` 交叉引用 / `T` 交易 / `D` 卡 | `CVEXPORT.cpy:10`；`CBEXPORT.cbl:274,343,407,462,527` |
| 导出 | EXPORT-TIMESTAMP | 导出时间戳（含 DATE/TIME 重定义） | X(26) | `YYYY-MM-DD` + 分隔符 + `HH.MM.SS…` | `:11-15` |
| 导出 | EXPORT-SEQUENCE-NUM | 记录序号（导出 KSDS 键区） | 9(9) COMP | 递增 | `:16`；`CBEXPORT.cbl:277` |
| 导出 | EXPORT-BRANCH-ID | 分行号 | X(4) | 固定 `0001` | `:17`；`CBEXPORT.cbl:278` |
| 导出 | EXPORT-REGION-CODE | 区域码 | X(5) | 固定 `NORTH` | `:18`；`CBEXPORT.cbl:279` |
| 导出 | EXPORT-RECORD-DATA | 五类记录体联合（客户/账户/交易/交叉引用/卡） | X(460)，5 个 REDEFINES | 按 REC-TYPE 解释 | `:19-100` |
## 3. 枚举与代码集

状态类枚举已在 §2 各字段行给出：账户状态 `Y`/`N`（`COACTUPC.cbl:193`）、卡状态 `Y`/`N`（`COCRDUPC.cbl:91`）、用户类型 `A`/`U`（`COCOM01Y.cpy:27-28`）、主卡标识 `Y`/`N`（`COACTUPC.cbl:350`）。
### 3.1 授权响应码与拒绝原因码（`COPAUA0C.cbl`）

| 代码 | 中文含义 | 产生条件 | 证据 |
|---|---|---|---|
| `00` | 批准 | 未触发拒绝分支；批准额=交易额 | `:692-695` |
| `05` | 拒绝 | 触发任一拒绝条件；批准额置 0 | `:685-690` |
| `0000` | 无拒绝原因（批准时） | 缺省赋值 | `:698` |
| `3100` | 卡/账户/客户不存在 | `CARD-NFOUND-XREF`、`NFOUND-ACCT-IN-MSTR`、`NFOUND-CUST-IN-MSTR` | `:700-704` |
| `4100` | 可用额度不足 | `INSUFFICIENT-FUND`（交易额 > 额度−已用额度） | `:705-706`、`:668-679` |
| `4200` | 卡未激活 | `CARD-NOT-ACTIVE`——源码中从未置真 | `:707-708` |
| `4300` | 账户已关闭 | `ACCOUNT-CLOSED`——源码中从未置真 | `:709-710` |
| `5100` | 卡欺诈 | `CARD-FRAUD`——源码中从未置真 | `:711-712` |
| `5200` | 商户欺诈 | `MERCHANT-FRAUD`——源码中从未置真 | `:713-714` |
| `9000` | 其他 | `WHEN OTHER` | `:715-716` |
### 3.2 入账校验失败码（`CBTRN02C.cbl`，写入 DALYREJS 记录的 76 字节描述段）

| 代码 | 中文含义 | 证据 |
|---|---|---|
| `100` | INVALID CARD NUMBER FOUND（卡号不在 CCXREF） | `:385-387` |
| `101` | ACCOUNT RECORD NOT FOUND（XREF 指向账户不存在） | `:397-399` |
| `102` | OVERLIMIT TRANSACTION（类别净额+本次 > 信用额度） | `:403-413` |
| `103` | TRANSACTION RECEIVED AFTER ACCT EXPIRATION（交易日 > 账户到期日） | `:414-419` |
| `109` | ACCOUNT RECORD NOT FOUND（更新账户 INVALID KEY） | `:556-558` |
### 3.3 交易类型码（`trantype.txt` 全 7 条，尾部 8 字节为 `00000000` 填充）

`01` Purchase 消费（`trantype.txt:1`）、`02` Payment 还款（`:2`）、`03` Credit 贷记（`:3`）、`04` Authorization 授权（`:4`）、`05` Refund 退款（`:5`）、`06` Reversal 冲正（`:6`）、`07` Adjustment 调整（`:7`）。
### 3.4 交易类别码（`trancatg.txt` 全 18 条，键=类型 2 + 类别 4）

| 类型 | 类别 | 中文含义 | 英文原值 | 证据 |
|---|---|---|---|---|
| 01 | 0001 | 常规消费签单 | Regular Sales Draft | `trancatg.txt:1` |
| 01 | 0002 | 常规预借现金 | Regular Cash Advance | `:2` |
| 01 | 0003 | 便利支票借记 | Convenience Check Debit | `:3` |
| 01 | 0004 | ATM 预借现金 | ATM Cash Advance | `:4` |
| 01 | 0005 | 利息（计息交易使用） | Interest Amount | `:5`；`CBACT04C.cbl:484` |
| 02 | 0001 | 现金还款 | Cash payment | `:6` |
| 02 | 0002 | 电子还款（账单支付使用） | Electronic payment | `:7`；`COBIL00C.cbl:221` |
| 02 | 0003 | 支票还款 | Check payment | `:8` |
| 03 | 0001 | 账户贷记 | Credit to Account | `:9` |
| 03 | 0002 | 消费余额贷记 | Credit to Purchase balance | `:10` |
| 03 | 0003 | 取现余额贷记 | Credit to Cash balance | `:11` |
| 04 | 0001 | 零金额授权 | Zero dollar authorization | `:12` |
| 04 | 0002 | 线上消费授权 | Online purchase authorization | `:13` |
| 04 | 0003 | 差旅预订授权 | Travel booking authorization | `:14` |
| 05 | 0001 | 退款贷记 | Refund credit | `:15` |
| 06 | 0001 | 欺诈冲正 | Fraud reversal | `:16` |
| 06 | 0002 | 非欺诈冲正 | Non-fraud reversal | `:17` |
| 07 | 0001 | 签单贷记调整 | Sales draft credit adjustment | `:18` |

**核对说明**：类别码实际最大值为 `0005`（仅类型 `01` 使用），**不存在 `0006`**；`dailytran.txt` 的 300 条记录只出现 `01-0001`（250 条）与 `03-0001`（50 条），`tcatbal.txt` 50 条全为 `01-0001`。
## 4. 标识符规则（前导零与字符类型）

| 标识符 | 定义 | 规则 | 证据 |
|---|---|---|---|
| ACCT-ID | `PIC 9(11)` | 11 位数字字符，右对齐补前导零；界面输入先 `NUMVAL` 再回填；VSAM 键 `KEYS(11 0)` | `CVACT01Y.cpy:5`；`ACCTFILE.jcl:40`；`COTRN02C.cbl:203-206` |
| CUST-ID | `PIC 9(09)` | 9 位数字字符，前导零；与登录用户 ID（X(8)）无关联 | `CVCUS01Y.cpy:5`；`CUSTFILE.jcl:50` |
| XREF-CUST-ID | `PIC 9(09)` | 同 CUST-ID 域，外键 | `CVACT03Y.cpy:6` |
| CARD-NUM | `PIC X(16)` | **字符型不是数值**；16 位数字字符串，禁止 `NUMVAL` 后丢失前导零；作 CICS 键时以 X(16) 原文传递 | `CVACT02Y.cpy:5`；`COCRDSLC.cbl:189` |
| TRAN-ID | `PIC X(16)` | 字符型 16 位；生成方式=`READPREV` 取最大键后 +1；系统交易=`PARM 日期(10)`+序号 | `CVTRA05Y.cpy:5`；`COTRN02C.cbl:444-451`、`COBIL00C.cbl:212-219` |
| TRANCAT 组合键 | 9(11)+X(2)+9(4) | 拼接键 17 字节，账户号保留前导零 | `CVTRA01Y.cpy:5-8`；`TCATBALF.jcl:40` |
| 日期字段 | `PIC X(10)` | `YYYY-MM-DD` 文本；比较依赖字典序（非日期类型） | `CVACT01Y.cpy:10-12`；`CBTRN02C.cbl:414` |
## 5. 遗留 ASCII 数值字段使用 EBCDIC 过穿孔（overpunch）

`app/data/ASCII/*.txt` 不是普通文本数值文件：带符号的数值字段（`PIC S9(n)V99`）保留 EBCDIC zoned decimal 的**过穿孔尾字节**——最后 1 个字节把符号压在数字区上：`{`=+0、`}`=-0、`A`-`I`=+1…+9、`J`-`R`=-1…-9。按 ASCII 直读会得到非法数值（`NUMVAL` 返回 0 或运行期异常），**导入新系统前必须按 copybook 逐字段解码**（去穿孔→还原符号与末位数字→再转十进制）。

真实示例（`app/data/ASCII/acctdata.txt` 第 1 行，共 300 字节）：`00000000001Y00000001940{00000020200{00000010200{2014-11-202025-05-202025-05-2000000000000{00000000000{A000000000 …`

| 偏移 | 字段 | 原始字节 | 解码结果 |
|---|---|---|---|
| 1-11 | ACCT-ID | `00000000001` | 1 |
| 12 | ACCT-ACTIVE-STATUS | `Y` | 有效 |
| 13-24 | ACCT-CURR-BAL | `00000001940{` | **1940.00**（`{`=+0 → 末位 0、正号） |
| 25-36 | ACCT-CREDIT-LIMIT | `00000020200{` | 20200.00 |
| 37-48 | ACCT-CASH-CREDIT-LIMIT | `00000010200{` | 10200.00 |
| 49-58 | ACCT-OPEN-DATE | `2014-11-20` | 2014-11-20 |

第二例（`dailytran.txt`）：第 1 行 `TRAN-AMT`（偏移 133-143）= `0000005047G` → **504.77**（`G`=+7）；第 2 行 = `0000009190}` → **-919.00**（`}`=-0，对应 "Return item" 退款）。受影响字段全集：`ACCT-CURR-BAL`、`ACCT-CREDIT-LIMIT`、`ACCT-CASH-CREDIT-LIMIT`、`ACCT-CURR-CYC-CREDIT`、`ACCT-CURR-CYC-DEBIT`、`TRAN-AMT`/`DALYTRAN-AMT`、`TRAN-CAT-BAL`、`DIS-INT-RATE`（如 `discgrp.txt` 的 `00150{`=1.50）。`ACCT-ID`、`CUST-ID`、`CARD-NUM` 等无符号字段是普通字符数字，**不存在过穿孔**。
## 6. 未解决项

| 项 | 现状 | 证据 |
|---|---|---|
| `PA-AUTH-STATUS`（IMS 根段）取值 | 字段已定义但全仓无赋值语句，语义未确认 | `CIPAUSMY.cpy:21` |
| `TRANSACTION_TYPE_CATEGORY` 读写方 | 无 COBOL SQL 引用，仅由 `DB2LTCAT.ctl` 装载、`TRANEXTR.jcl` 抽取 | `DB2LTCAT.ctl:15`、`TRANEXTR.jcl:112` |
| `ACCT-GROUP-ID` 空值与 `DEFAULT` 组的回退规则 | 样本账户 GROUP 为空，DISCGRP 使用 `A`/`DEFAULT`/`ZEROAPR`；回退逻辑仅体现在 `1200-GET-INTEREST-RATE`，无注释说明 | `CBACT04C.cbl:415-460` |
| 导出文件主键 `KEYS(4 28)` | 与 `EXPORT-SEQUENCE-NUM`（偏移 27）相差 1 字节，属遗留缺陷 | `CBEXPORT.jcl:32`、`CVEXPORT.cpy:16` |
