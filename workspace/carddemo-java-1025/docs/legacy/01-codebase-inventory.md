# 01 存量代码技术清单（CardDemo COBOL）

**证据约定**：`文件:行号` 指 `/Users/louis/work-space/Code-projects/iCode/carddemo-cobol/` 下的真实源码行；表中的"行数"均为 `wc -l` 结果。扫描基线 `/tmp/carddemo_scan.json`（scan_as400_codebase.py v1.1.0）给出 44 程序 / 62 copybook / 2 DB2 表 / 62 调用边；本文对 44 个程序逐一核对，实际分布为 `app/cbl` 31、`app/app-authorization-ims-db2-mq/cbl` 8、`app/app-transaction-type-db2/cbl` 3、`app/app-vsam-mq/cbl` 2（与扫描基线一致）。基线中"2 张 DB2 表"只统计了 SQL 直接引用的表，DDL 实有 3 张（见 §4.2）。

## 1. 代码库定位

| 目录 | 内容 | 证据 |
|---|---|---|
| app/cbl | 31 个核心 COBOL（在线 CICS 17 + 批处理 12 + 子程序/工具 2；含 2 个 `.CBL` 大写扩展名） | `app/cbl` 目录清单 |
| app/app-authorization-ims-db2-mq | 授权扩展：cbl 8、cpy 9、cpy-bms 2、bms 2、csd 1、dcl 1、ddl 2、ims 6、jcl 5、data/EBCDIC 1 | `.../README.md`；`app/**` 清单 |
| app/app-transaction-type-db2 | 交易类型 DB2 扩展：cbl 3、cpy 2、cpy-bms 2、bms 2、csd 1、ctl 8、dcl 2、ddl 4、jcl 3 | `.../README.md` |
| app/app-vsam-mq | MQ 查询扩展：cbl 2、csd 1 | `app/app-vsam-mq/README.md` |
| app/cpy | 30 个业务/工具 copybook（`*.cpy` + `COSTM01.CPY`） | 目录清单 |
| app/cpy-bms | 17 个 BMS 屏幕 map copybook（`*.CPY`，由 `app/bms` 生成） | 目录清单 |
| app/bms | 17 个在线屏幕 BMS 源定义 | `app/bms/*.bms` |
| app/csd | `CARDDEMO.CSD`：8 个 FILE、17 个 MAPSET、18 个 PROGRAM、18 个 TRANSACTION、1 个 TDQ | `CARDDEMO.CSD:1-505` |
| app/ctl | `REPROCT.ctl`（IDCAMS REPRO 控制卡） | 目录清单 |
| app/data | `ASCII/` 9 个文本数据集、`EBCDIC/` 13 个 `.PS` 数据集 | `wc -l app/data/ASCII/*.txt` |
| app/jcl | 38 个批处理作业 | `ls app/jcl` |
| app/proc | `REPROC.prc`（内含 PROC REPROC）、`TRANREPT.prc`（文件内同样定义 `REPROC PROC`） | `app/proc/TRANREPT.prc:1` |
| app/asm、app/maclib | 汇编子程序 `COBDATFT`/`MVSWAIT` 及宏 | `app/asm/COBDATFT.asm`、`app/maclib/ASMWAIT.mac` |
| app/catlg、app/scheduler | 目录清单快照、CA7/Control-M 调度定义 | `app/catlg/LISTCAT.txt`、`app/scheduler/*` |
| （app/ddl 不存在） | DDL 分散在 `app-transaction-type-db2/ddl`（4）与 `app-authorization-ims-db2-mq/ddl`（2） | `app/**/*.ddl` 共 6 个 |

## 2. 程序清单（44 个）

| 程序 | 类型 | 事务码 | 主要数据文件/表 | 功能（一句话） | 行数 |
|---|---|---|---|---|---|
| CBACT01C | 批处理 | — | ACCTDATA → OUTFILE/ARRYFILE/VBRCFILE | 读账户主文件，重排为定长/数组/变长 3 种输出 | 430 |
| CBACT02C | 批处理 | — | CARDDATA | 读并打印卡文件 | 178 |
| CBACT03C | 批处理 | — | CARDXREF | 读并打印卡-账户交叉引用文件 | 178 |
| CBACT04C | 批处理 | — | TCATBALF、CARDXREF(+AIX)、ACCTDATA、DISCGRP、TRANSACT | 按月计息并写出 01-0005 交易 | 652 |
| CBCUS01C | 批处理 | — | CUSTDATA | 读并打印客户文件 | 178 |
| CBEXPORT | 批处理（迁移） | — | 5 个主文件 → EXPORT.DATA | 分行迁移导出 500 字节多记录文件 | 582 |
| CBIMPORT | 批处理（迁移） | — | EXPORT.DATA → 5 目标文件 + 错误文件 | 拆解导出文件并逐字段校验 | 487 |
| CBSTM03A | 批处理 | — | TRNXFL、CARDXREF、CUSTDATA、ACCTDATA → STMTFILE/HTMLFILE | 生成对账单（文本 + HTML） | 924 |
| CBSTM03B | 批处理子程序 | — | TRNXFILE、XREFFILE、CUSTFILE、ACCTFILE | 对账单取数与行排版（被 CBSTM03A CALL 14 处） | 230 |
| CBTRN01C | 批处理（只读核查） | — | DALYTRAN、CUST/XREF/CARD/ACCT/TRANSACT | 逐笔核对日交易关联数据，全程 OPEN INPUT | 494 |
| CBTRN02C | 批处理 | — | DALYTRAN、TRANSACT、CARDXREF、DALYREJS、ACCTDATA、TCATBALF | 日交易入账：校验→写拒绝→更新余额 | 731 |
| CBTRN03C | 批处理 | — | TRANSACT、CARDXREF、TRANTYPE、TRANCATG、DATEPARM → TRANREPT | 交易明细报表（133 列，含账户小计/页合计） | 649 |
| COACTUPC | CICS 在线 | CAUP | ACCTDAT、CUSTDAT、CXACAIX | 账户维护（客户资料、额度、周期累计） | 4236 |
| COACTVWC | CICS 在线 | CAVW | ACCTDAT、CUSTDAT、CXACAIX | 账户视图 | 941 |
| COADM01C | CICS 在线 | CA00 | — | 管理员菜单（DB2 扩展后为 6 项） | 288 |
| COBIL00C | CICS 在线 | CB00 | ACCTDAT、CXACAIX、TRANSACT | 账单支付：全额还款并写 02-0002 交易 | 572 |
| COBSWAIT | 工具（批处理） | — | — | 按 PARM 厘秒等待（CALL MVSWAIT） | 41 |
| COCRDLIC | CICS 在线 | CCLI | CARDDAT、CARDAIX | 卡片列表（账户/卡号双入口、分页） | 1459 |
| COCRDSLC | CICS 在线 | CCDL | CARDDAT、CARDAIX | 卡片明细查看 | 887 |
| COCRDUPC | CICS 在线 | CCUP | CARDDAT、CARDAIX | 卡片维护（名称/到期日/状态） | 1560 |
| COMEN01C | CICS 在线 | CM00 | — | 普通用户主菜单（11 项） | 308 |
| CORPT00C | CICS 在线 | CR00 | TRANSACT、TDQ JOBS、CALL CSUTLDTC | 报表请求：校验日期后经 TDQ 提交批作业 | 649 |
| COSGN00C | CICS 在线 | CC00 | USRSEC | 登录：校验密码后按 A/U 分流菜单 | 260 |
| COTRN00C | CICS 在线 | CT00 | TRANSACT | 交易列表分页浏览 | 699 |
| COTRN01C | CICS 在线 | CT01 | TRANSACT | 单笔交易明细 | 330 |
| COTRN02C | CICS 在线 | CT02 | TRANSACT、CCXREF、CXACAIX | 新增交易（取现有最大 ID + 1） | 783 |
| COUSR00C | CICS 在线 | CU00 | USRSEC | 用户列表 | 695 |
| COUSR01C | CICS 在线 | CU01 | USRSEC | 新增用户 | 299 |
| COUSR02C | CICS 在线 | CU02 | USRSEC | 修改用户 | 414 |
| COUSR03C | CICS 在线 | CU03 | USRSEC | 删除用户 | 359 |
| CSUTLDTC | 工具（子程序） | — | — | 日期校验（CALL CEEDAYS），被 CORPT00C/COTRN02C CALL | 157 |
| COPAUA0C | CICS 在线（MQ 触发） | CP00 | MQ PAUTH.REQUEST/REPLY、CCXREF、ACCTDAT、CUSTDAT、IMS | 授权请求：读 MQ→校验→决策→回 MQ→写 IMS | 1026 |
| COPAUS0C | CICS 在线（BMS+IMS） | CPVS | CARDDAT、CARDAIX、ACCTDAT、CUSTDAT、IMS | 挂起授权汇总浏览 | 1032 |
| COPAUS1C | CICS 在线（BMS+IMS） | CPVD | IMS PAUTSUM0/PAUTDTL1 | 授权明细查看 + 欺诈标记（LINK COPAUS2C 落 DB2 后回写 IMS） | 604 |
| COPAUS2C | CICS 在线（IMS+DB2） | 被 CPVD 调用 | IMS、DB2 AUTHFRDS | 标记/取消欺诈并落 DB2 | 244 |
| CBPAUP0C | BMP（批处理 IMS） | — | IMS PAUTSUM0/PAUTDTL1 | 删除过期挂起授权并回退累计 | 386 |
| DBUNLDGS | 批处理（IMS 卸载） | — | IMS DBPAUTP0 → GSAM PASFLDBD/PADFLDBD | 把授权汇总/明细从 IMS 卸载到 2 个 GSAM 文件 | 366 |
| PAUDBUNL | 批处理（IMS 卸载） | — | IMS PAUTB → OUTFIL1/OUTFIL2 | 按段导出汇总/明细到 2 个顺序文件 | 317 |
| PAUDBLOD | 批处理（IMS 装载） | — | INFILE1/INFILE2 → IMS PAUTB | 从 2 个顺序文件装载授权段 | 369 |
| COTRTLIC | CICS 在线（DB2） | CTLI | DB2 TRANSACTION_TYPE | 交易类型列表（前/后向游标）、改、删 | 2098 |
| COTRTUPC | CICS 在线（DB2） | CTTU | DB2 TRANSACTION_TYPE | 交易类型新增/修改 | 1702 |
| COBTUPDT | 批处理（DB2） | — | DB2 TRANSACTION_TYPE | 按输入文件增/改/删交易类型 | 237 |
| COACCT01 | CICS 在线（MQ） | CDRA | MQ、ACCTDAT | 消费 MQ 请求，回送账户详情（INQA） | 620 |
| CODATE01 | CICS 在线（MQ） | CDRD | MQ | 消费 MQ 请求，回送系统日期时间 | 524 |

**核对结论**：`CARDDEMO.CSD` 另有 `DEFINE PROGRAM(COCRDSEC)` 与 `DEFINE TRANSACTION(CDV1)`（`CARDDEMO.CSD:211-218`、`:388-398`），仓库内**无 COCRDSEC 源码**（`glob app/**/COCRDSEC*` 无结果）；CSD 共定义 26 个 PROGRAM、25 个 TRANSACTION。

## 3. Copybook 清单（62 个 = 41 `.cpy` + 21 `.CPY`）

引用数由 `COPY <name>` 在 44 个程序中 grep 统计（同一程序多次 COPY 计 1）。

| 文件名 | 用途/记录长度 | 主要字段组 | 引用程序数（程序） |
|---|---|---|---|
| COCOM01Y.cpy | CICS COMMAREA，160 字节 | CDEMO-GENERAL/CUSTOMER/ACCOUNT/CARD/MORE-INFO | 21 |
| COTTL01Y.cpy | 屏幕标题 | CCDA-TITLE01/02、CCDA-THANK-YOU（各 40） | 21 |
| CSDAT01Y.cpy | 日期时间工作区 | WS-CURDATE-DATA、WS-CURTIME | 21 |
| CSMSG01Y.cpy | 公共提示语（2×50） | CCDA-MSG-THANK-YOU、CCDA-MSG-INVALID-KEY | 21 |
| CSUSR01Y.cpy | 用户安全记录，80 字节（VSAM `RECORDSIZE(80,80)`） | SEC-USR-ID/FNAME/LNAME/PWD/TYPE/FILLER | 14 |
| CVTRA05Y.cpy | 交易主记录，RECLN 350 | 13 个业务字段（ID/类型/类别/来源/描述/金额/商户 4 项/卡号/2 个时间戳） | 11 |
| CVACT01Y.cpy | 账户记录，RECLN 300 | ACCT-ID、状态、余额、双额度、3 个日期、周期累计、ZIP、GROUP | 16 |
| CVACT03Y.cpy | 卡-账户交叉引用，RECLN 50 | XREF-CARD-NUM/CUST-ID/ACCT-ID + 14 FILLER | 16 |
| CVACT02Y.cpy | 卡记录，RECLN 150 | CARD-NUM/ACCT-ID/CVV/凸印名/到期/状态 | 10 |
| CVCUS01Y.cpy | 客户记录，RECLN 500 | 姓名 3 段、地址 3 行、州国邮编、2 电话、SSN、证件、生日、EFT、主卡标识、FICO | 10 |
| CVCRD01Y.cpy | 卡屏工作区 + AID 常量 | CC-WORK-AREAS、CCARD-AID、CCARD-NEXT-PROG | 7 |
| CSMSG02Y.cpy | 异常处理工作区（原 CABENDD.CPY） | ABEND-CODE、ABEND-CULPRIT、ABEND-DATA | 8 |
| CVTRA01Y.cpy | 交易类别余额，RECLN 50 | 键（账户 11 + 类型 2 + 类别 4）、TRAN-CAT-BAL | 2 |
| CVTRA02Y.cpy | 披露组，RECLN 50 | 键（组 10 + 类型 2 + 类别 4）、DIS-INT-RATE | 1 |
| CVTRA03Y.cpy | 交易类型，RECLN 60 | TRAN-TYPE、TRAN-TYPE-DESC | 1 |
| CVTRA04Y.cpy | 交易类别，RECLN 60 | 键（类型 2 + 类别 4）、TRAN-CAT-TYPE-DESC | 1 |
| CVTRA06Y.cpy | 日交易记录，RECLN 350 | DALYTRAN-* 13 字段（同 CVTRA05Y） | 2 |
| CVTRA07Y.cpy | 交易报表排版 | 页头、明细行、页/账户/总计行（133 列） | 1 |
| CVEXPORT.cpy | 迁移导出记录，500 字节 | REC-TYPE、TIMESTAMP、SEQ、BRANCH、REGION、460 字节 5 种 REDEFINES | 2 |
| CUSTREC.cpy | 客户记录 500 字节变体 | 同 CVCUS01Y，惟生日字段名为 CUST-DOB-YYYYMMDD | 1 |
| COSTM01.CPY | 对账单用交易排版布局 | 报表行字段 | 1 |
| COADM02Y.cpy | 管理员菜单项（COUNT=6） | CDEMO-ADMIN-OPT-* | 1 |
| COMEN02Y.cpy | 主菜单项（COUNT=11） | CDEMO-MENU-OPT-* | 1 |
| CODATECN.cpy | 日期格式转换入/出记录 | CODATECN-TYPE/INP-DATE/OUT-DATE | 1 |
| CSLKPCDY.cpy | 编码表（电话区号、州、州+邮编） | WS-US-PHONE-AREA-CODE-TO-EDIT 等表 | 1 |
| CSSETATY.cpy | 出错字段高亮的过程段 | FLG-(TESTVAR1)-NOT-OK / (SCRNVAR2) | 2 |
| CSUTLDPY.cpy | 日期校验过程段 | EDIT-DATE-CCYYMMDD 等段落 | 1 |
| CSUTLDWY.cpy | 日期校验工作区 | WS-EDIT-DATE-CCYYMMDD | 0 |
| CSSTRPFY.cpy | PF 键→AID 映射过程段 | YYYY-STORE-PFKEY | 0 |
| UNUSED1Y.cpy | 未引用（版本串 `CardDemo_v1.0-56`） | — | 0 |
| COACTUP.CPY 等 17 个基础 BMS map copybook | 在线屏幕 I/O 字段布局（COACTUP、COACTVW、COADM01、COBIL00、COCRDLI、COCRDSL、COCRDUP、COMEN01、CORPT00、COSGN00、COTRN00、COTRN01、COTRN02、COUSR00、COUSR01、COUSR02、COUSR03） | 各 map 的 `*I`/`*O` 字段 | 各 1（COCRDSL 为 2） |
| COPAU00.cpy | 授权汇总屏 map | 汇总行 I/O 字段 | 1 |
| COPAU01.cpy | 授权明细屏 map | 明细 I/O 字段 | 1 |
| COTRTLI.cpy | 交易类型列表屏 map | 行数组 I/O 字段 | 1 |
| COTRTUP.cpy | 交易类型维护屏 map | 编辑字段 | 1 |
| CCPAURQY.cpy | 授权请求消息，152 字节 | 18 个逗号分隔字段（日期…交易 ID） | 1 |
| CCPAURLY.cpy | 授权应答消息，56 字节 | CARD-NUM/TRAN-ID/AUTH-ID/RESP/RESP-REASON/APPROVED-AMT | 1 |
| CCPAUERY.cpy | 授权错误日志记录 | ERR-DATE/TIME/APPLICATION/PROGRAM/LOCATION/LEVEL… | 1 |
| CIPAUSMY.cpy | IMS 根段 PAUTSUM0，100 字节 | 账户/客户键、额度、余额、批准/拒绝笔数与金额 | 7 |
| CIPAUDTY.cpy | IMS 子段 PAUTDTL1，200 字节 | 授权键、卡号、金额、商户、响应码、匹配/欺诈状态 | 8 |
| IMSFUNCS.cpy | DL/I 功能码常量 | FUNC-GU/GHU/GN/GHN/GNP/REPL/ISRT… | 3 |
| PAUTBPCB.CPY | 授权库 PCB 掩码 | DBDNAME/段级/状态/PROCOPT/KEYFB | 3 |
| PADFLPCB.CPY | PADFLDBD(GSAM) PCB 掩码 | 同上（KEYFB 255） | 1 |
| PASFLPCB.CPY | PASFLDBD(GSAM) PCB 掩码 | 同上（KEYFB 100） | 1 |
| CSDB2RPY.cpy | DB2 公共过程段（含 9998-PRIMING-QUERY） | DB2 错误处理段落 | 0 |
| CSDB2RWY.cpy | DB2 公共工作区 | WS-DB2-COMMON-VARS、SQLCA 显示字段 | 0 |

## 4. 数据存储清单

### 4.1 VSAM 与顺序文件（基础集群 10 + 备用索引路径 3）

| 逻辑名 | DSNAME | 键 | 记录长度 | 含义 | 证据 |
|---|---|---|---|---|---|
| ACCTDAT | ACCTDATA.VSAM.KSDS | KEYS(11 0) | 300/300 | 账户主文件 | `ACCTFILE.jcl:36-44`、`CARDDEMO.CSD:1` |
| CARDDAT | CARDDATA.VSAM.KSDS | KEYS(16 0) | 150/150 | 卡主文件 | `CARDFILE.jcl:50-58`、`CSD:25` |
| CARDAIX | CARDDATA.VSAM.AIX.PATH | KEYS(11 16) | 150 | 卡的账户号备用索引 | `CARDFILE.jcl:83-102`、`CSD:13` |
| CCXREF | CARDXREF.VSAM.KSDS | KEYS(16 0) | 50/50 | 卡→客户/账户交叉引用 | `XREFFILE.jcl:39-47`、`CSD:37-39` |
| CXACAIX | CARDXREF.VSAM.AIX.PATH | KEYS(11,25) | 50 | CCXREF 的账户号备用索引 | `XREFFILE.jcl:72-92`、`CSD:63-64` |
| CUSTDAT | CUSTDATA.VSAM.KSDS | KEYS(9 0) | 500/500 | 客户主文件 | `CUSTFILE.jcl:46-54`、`CSD:50-52` |
| TRANSACT | TRANSACT.VSAM.KSDS | KEYS(16 0) | 350/350 | 交易主文件 | `TRANFILE.jcl:49-57`、`CSD:76` |
| TRANSACT AIX | TRANSACT.VSAM.AIX.PATH | KEYS(26 304) | 350 | 交易处理时间戳备用索引（仅批处理定义） | `TRANIDX.jcl:25-44`、`TRANFILE.jcl:82-101` |
| USRSEC | USRSEC.VSAM.KSDS | KEYS(8,0) | 80/80 | 用户安全文件 | `DUSRSECJ.jcl:64-73`、`CSD:88` |
| TCATBALF | TCATBALF.VSAM.KSDS | KEYS(17 0) | 50/50 | 交易类别余额（账户+类型+类别） | `TCATBALF.jcl:36-44` |
| TRANTYPE | TRANTYPE.VSAM.KSDS | KEYS(2 0) | 60/60 | 交易类型参考数据 | `TRANTYPE.jcl:36-44` |
| TRANCATG | TRANCATG.VSAM.KSDS | KEYS(6 0) | 60/60 | 交易类别参考数据 | `TRANCATG.jcl:36-44` |
| DISCGRP | DISCGRP.VSAM.KSDS | KEYS(16 0) | 50/50 | 披露组（组+类型+类别→年利率） | `DISCGRP.jcl:36-44` |

顺序文件：`DALYTRAN.PS`（日交易输入，LRECL 350，`POSTTRAN.jcl:30-31`）、`DALYREJS(+1)`（拒绝记录 GDG，LRECL 430 = 350 数据 + 80 校验尾部，`POSTTRAN.jcl:34-38`、`CBTRN02C.cbl:176-181`）、`EXPORT.DATA`（迁移导出，KEYS(4 28)、RECORDSIZE 500，`CBEXPORT.jcl:32-33`）。**注**：导出集群 `KEYS(4 28)` 覆盖第 29–32 字节，与 `EXPORT-SEQUENCE-NUM`（第 28–31 字节，`CVEXPORT.cpy:16`）相差 1 字节。

### 4.2 DB2 表（3 张，均带唯一索引）

| 表 | 主键/索引 | 关键列 | 使用程序 | 证据 |
|---|---|---|---|---|
| CARDDEMO.TRANSACTION_TYPE | PK(TR_TYPE)；XTRAN_TYPE | TR_TYPE CHAR(2)、TR_DESCRIPTION VARCHAR(50) | COBTUPDT、COTRTLIC、COTRTUPC | `TRNTYPE.ddl:1-4`、`XTRNTYPE.ddl:1-4` |
| CARDDEMO.TRANSACTION_TYPE_CATEGORY | PK(TRC_TYPE_CODE,TRC_TYPE_CATEGORY)；X_TRAN_TYPE_CATG；FK→TRANSACTION_TYPE ON DELETE RESTRICT | TRC_TYPE_CODE CHAR(2)、TRC_TYPE_CATEGORY CHAR(4)、TRC_CAT_DATA VARCHAR(50) | 无程序 SQL 引用（仅 `TRANEXTR.jcl:112` 抽取、`DB2LTCAT.ctl:15` 装载、`DCLTRCAT.dcl` 声明） | `TRNTYCAT.ddl:1-7`、`XTRNTYCAT.ddl:1-5` |
| CARDDEMO.AUTHFRDS | PK(CARD_NUM,AUTH_TS)；XAUTHFRD(CARD_NUM ASC, AUTH_TS DESC) | 26 列，含 AUTH_RESP_CODE、AUTH_RESP_REASON、AUTH_FRAUD、MATCH_STATUS、ACCT_ID、CUST_ID | COPAUS2C（`INSERT`/`UPDATE`） | `AUTHFRDS.ddl:1-28`、`XAUTHFRD.ddl:1-4`、`COPAUS2C.cbl:142`、`:223` |

### 4.3 IMS 与 TDQ

| 对象 | 结构 | 关键字段 | 证据 |
|---|---|---|---|
| DBD DBPAUTP0（HIDAM/VSAM） | 根段 PAUTSUM0（100 字节，键 ACCNTID 6 字节 P）、子段 PAUTDTL1（200 字节，键 PAUT9CTS 8 字节） | 账户键 + 授权明细 | `DBPAUTP0.dbd:28-37` |
| DBD DBPAUTX0（INDEX） | 索引段 PAUTINDX（6 字节，FREQ=100000） | 指向 PAUTSUM0 的 ACCNTID | `DBPAUTX0.dbd:27-31` |
| PSB PSBPAUTB / PSBPAUTL | PAUTBPCB：PROCOPT=AP（BMP）/ PROCOPT=L（装载），SENSEG 两级 | 在线/BMP 与装载双 PSB | `PSBPAUTB.psb:17-20`、`PSBPAUTL.psb:17-20` |
| GSAM PADFLDBD / PASFLDBD | RECORD=(200) / (100)，RECFM=F | 授权输入/输出平面文件库 | `PADFLDBD.DBD:22-27`、`PASFLDBD.DBD:22-27` |
| TDQ JOBS | TYPE(EXTRA)、DDNAME(INREADER)、RECORDSIZE(80) FIXED | CICS 内部读卡机，提交批作业 | `CARDDEMO.CSD:499-505` |

## 5. 批处理作业清单（`app/jcl` 38 + 授权扩展 5 + 交易类型扩展 3 = 46）

| JCL | 主程序 | 输入 DD → 输出 DD | 用途 | 证据 |
|---|---|---|---|---|
| POSTTRAN.jcl | CBTRN02C | TRANFILE/DALYTRAN/XREFFILE/ACCTFILE/TCATBALF → DALYREJS | 日交易入账 | `POSTTRAN.jcl:23-42` |
| INTCALC.jcl | CBACT04C（`PARM='2022071800'`） | TCATBALF/XREFFILE/XREFFIL1/ACCTFILE/DISCGRP → TRANSACT(SYSTRAN) | 计息 | `INTCALC.jcl:22-41` |
| TRANREPT.jcl | REPROC + SORT + CBTRN03C | TRANSACT → TRANSACT.BKUP → TRANSACT.DALY → TRANREPT(133) | 交易报表 | `TRANREPT.jcl:23-80` |
| DALYREJS.jcl | IDCAMS | — → 拒绝 GDG 基 | 定义 DALYREJS GDG | `DALYREJS.jcl:19-31` |
| CBEXPORT.jcl | IDCAMS + CBEXPORT | 5 主文件 → EXPORT.DATA | 迁移导出 | `CBEXPORT.jcl:24-63` |
| CBIMPORT.jcl | CBIMPORT | EXPORT.DATA → CUST/ACCT/XREF/TRNX/ERROR | 迁移导入 | `CBIMPORT.jcl:22-60` |
| ACCTFILE.jcl / CARDFILE.jcl / CUSTFILE.jcl / XREFFILE.jcl / TRANFILE.jcl | IDCAMS（+SDSF 开关文件） | 定义集群、AIX、PATH 并 REPRO 初始数据 | 建库 | `ACCTFILE.jcl:36-61`、`CARDFILE.jcl:50-102`、`CUSTFILE.jcl:46-71`、`XREFFILE.jcl:39-92`、`TRANFILE.jcl:49-101` |
| TCATBALF.jcl / DISCGRP.jcl | IDCAMS | 定义 KSDS 并 REPRO | 参考/余额文件建库 | `TCATBALF.jcl:36-61`、`DISCGRP.jcl:36-61` |
| TRANTYPE.jcl / TRANCATG.jcl | IDCAMS | 定义 KSDS 并 REPRO | 参考数据建库 | `TRANTYPE.jcl:36-61`、`TRANCATG.jcl:36-61` |
| TRANIDX.jcl | IDCAMS | 交易 AIX + PATH | 补建交易时间戳索引 | `TRANIDX.jcl:25-44` |
| PRTCATBL.jcl | REPROC + SORT | TCATBALF → TCATBALF.REPT(40) | 打印类别余额（键升序、裁剪输出行） | `PRTCATBL.jcl:29-58` |
| CREASTMT.JCL | SORT + IDCAMS + CBSTM03A | TRANSACT → TRXFL.SEQ → TRXFL.VSAM → STMTFILE/HTMLFILE(80) | 生成对账单 | `CREASTMT.JCL:44-79` |
| COMBTRAN.jcl | SORT + IDCAMS | TRANSACT.BKUP(0) + SYSTRAN(0) → COMBINED → 交易主文件 | 合并在线/系统交易 | `COMBTRAN.jcl:22-45` |
| TRANBKP.jcl | REPROC + IDCAMS | TRANSACT → BKUP，随后删除重建 | 备份并重置交易主文件 | `TRANBKP.jcl:23-51` |
| READACCT / READCARD / READCUST / READXREF | CBACT01C / CBACT02C / CBACT03C / CBCUS01C | 主文件 → PS 或 SYSOUT | 文件诊断打印 | `READACCT.jcl:31-45`、`READCARD.jcl:22-29` |
| CBADMCDJ.jcl | DFHCSDUP | CSD 源 → CSD | 安装 CICS 资源 | `CBADMCDJ.jcl:27` |
| CBPAUP0J.jcl（扩展） | DFSRRC00 `PARM='BMP,CBPAUP0C,PSBPAUTB'` | IMS PSB/DBD 库 | 清理过期授权 | `CBPAUP0J.jcl:24-47` |
| DBPAUTP0.jcl / UNLDPADB.JCL / LOADPADB.JCL / UNLDGSAM.JCL | DFSRRC00（PARM 分别为 `ULU,DFSURGU0` / `DLI,PAUDBUNL,PAUTBUNL` / `BMP,PAUDBLOD,PSBPAUTB` / `DLI,DBUNLDGS,DLIGSAMP`） | IMS 库 ↔ 顺序文件 | 授权库卸载/装载维护 | `DBPAUTP0.jcl:16`、`UNLDPADB.JCL:39`、`LOADPADB.JCL:27`、`UNLDGSAM.JCL:27` |
| CREADB21.jcl / TRANEXTR.jcl / MNTTRDB2.jcl（扩展） | DSNTEP4 / DSNTIAUL / COBTUPDT | DB2 表 ↔ 抽取文件 | 建表、抽取、批维护 | `app-transaction-type-db2/jcl/*` |

**proc/TRANREPT.prc 的排序/过滤步骤**（`TRANREPT.prc`）：① `STEP01R` 调 `REPROC`，把 `TRANSACT.VSAM.KSDS` 卸载为 `TRANSACT.BKUP(+1)`（LRECL 350 FB，`:21-31`）；② `STEP05R`（SORT）用 SYMNAMES 声明 `TRAN-CARD-NUM,263,16,ZD`、`TRAN-PROC-DT,305,10,CH`、`PARM-START-DATE,C'2022-01-01'`、`PARM-END-DATE,C'2022-07-06'`（`:38-42`），执行 `SORT FIELDS=(TRAN-CARD-NUM,A)` 并按处理日期 `INCLUDE COND=(TRAN-PROC-DT,GE,PARM-START-DATE,AND,LE,PARM-END-DATE)`（`:44-46`）输出 `TRANSACT.DALY(+1)`；③ `STEP10R` 运行 CBTRN03C，读 DALY + CARDXREF + TRANTYPE + TRANCATG + DATEPARM，输出 133 字节 `TRANREPT`（`:57-78`）。日期区间为**硬编码**，TRANTREPT.jcl 内联同一段控制卡（`TRANREPT.jcl:40-50`）。

## 6. 接口清单

| 接口 | 提供方 / 消费方 | 结构/格式 | 证据 |
|---|---|---|---|
| CICS COMMAREA | 全部 21 个在线程序互相 XCTL | `CARDDEMO-COMMAREA` 160 字节：FROM/TO TRANID+PROGRAM、USER-ID、USER-TYPE(A/U)、PGM-CONTEXT(0/1)、客户/账户/卡键、上/下 mapset | `COCOM01Y.cpy:19-44` |
| TDQ JOBS | CORPT00C → JES 内部读卡机 | 80 字节定长卡（`RECORDSIZE(80)`） | `CARDDEMO.CSD:499-505`、`CORPT00C.cbl:6`、`:462` |
| MQ 授权 | 外部 POS → COPAUA0C → 外部 | 请求 152 字节 18 字段 CSV，应答 56 字节 6 字段 CSV；队列 `AWS.M2.CARDDEMO.PAUTH.REQUEST` / `.REPLY` | `CCPAURQY.cpy:19-36`、`CCPAURLY.cpy:19-24`、`README.md`(授权扩展) MQ 配置表 |
| MQ 账户/日期 | COACCT01 / CODATE01 | 请求带 `WS-FUNC='INQA'` + 账户键；应答文本 `SYSTEM DATE : …`；队列 `CARD.DEMO.REPLY.ACCT`、`CARD.DEMO.ERROR` | `COACCT01.cbl:393-404`、`:198`、`:294`、`CODATE01.cbl:343-366` |
| IMS PSB/PCB | COPAUA0C/COPAUS0C/COPAUS1C/COPAUS2C/CBPAUP0C/PAUDB* | PSBPAUTB（AP/L）、PSBPAUTL（装载）；段 PAUTSUM0/PAUTDTL1 | `PSBPAUTB.psb:17-20`、`PSBPAUTL.psb:17-20` |
| DB2 | COTRTLIC/COTRTUPC/COBTUPDT/COPAUS2C | 静态 SQL，3 张表 | `COTRTLIC.cbl:340-367`、`COPAUS2C.cbl:142` |
| JCL PARM | INTCALC → CBACT04C；CBPAUP0J → CBPAUP0C；WAITSTEP → COBSWAIT | 10 字节日期 `2022071800`；过期天数（缺省 5）；厘秒等待 | `CBACT04C.cbl:176-180`、`CBPAUP0C.cbl:196-199`、`COBSWAIT.cbl:37-38`、`WAITSTEP.jcl:20` |
| 文件级 | 见 §4.1；JCL DD 名与 COBOL `ASSIGN TO` 一一对应 | ACCTFILE/CARDFILE/XREFFILE/TRANFILE/TCATBALF/DISCGRP/TRANTYPE/TRANCATG/DATEPARM/EXPFILE… | `CBTRN03C.cbl:29-57`、`CBEXPORT.cbl:35-65` |
| 程序间 CALL | CBSTM03A→CBSTM03B（14 处）；CORPT00C/COTRN02C→CSUTLDTC；CBACT01C→COBDATFT(汇编)；COBSWAIT→MVSWAIT(汇编) | COBOL CALL / 汇编接口 | `CBSTM03A.CBL:351`、`CORPT00C.cbl:392`、`COTRN02C.cbl:393`、`CBACT01C.cbl:231`、`COBSWAIT.cbl:38` |

## 7. 存量风险量化

| 度量 | 数量 | 证据 |
|---|---|---|
| 程序数 | 44（在线 25 / 批处理 17 / 工具 2） | `app/**/*.cbl` 与 `*.CBL` 计数；§2 |
| 代码行数 | 30,175 | 44 个程序 `wc -l` 求和 |
| copybook 数 | 62（41 `.cpy` + 21 `.CPY`，其中 21 个为 BMS map） | `glob` 统计；§3 |
| DB2 表 / 索引 | 3 / 3 | `ddl/*.ddl`（6 个） |
| VSAM 文件资源 | 13（10 个 KSDS 基础集群 + 3 个 AIX PATH） | §4.1 |
| 顺序数据集 | 3 类（日交易 PS、拒绝 GDG、导出文件）+ 若干临时 SYSTRAN/TRXFL/COMBINED | `POSTTRAN.jcl:30-38`、`CBEXPORT.jcl:32`、`COMBTRAN.jcl:26-33` |
| IMS 段 | 3（PAUTSUM0、PAUTDTL1、PAUTINDX）+ 2 个 GSAM 库 | §4.3 |
| CICS 事务 / BC 程序定义 | 25 / 26（含无源码的 COCRDSEC/CDV1） | 4 个 CSD 求和；`CARDDEMO.CSD:211-218` |
| 批作业数 | 46（38 + 5 + 3） | `ls app/jcl`、两扩展 jcl 目录 |
| 对外接口类别 | 8（COMMAREA、TDQ、MQ×2、IMS、DB2、JCL PARM、文件） | §6 |
| 未解析调用边 | 6（扫描器误判的 DISPLAY 文本，非真实调用） | `/tmp/carddemo_scan.json` → `unresolved_calls` |

**5 个高风险程序**

| 程序 | 风险原因 | 证据 |
|---|---|---|
| CBTRN02C（731 行） | 全部余额变更集中于此：`ADD DALYTRAN-AMT TO ACCT-CURR-BAL` 后 `REWRITE`，无幂等/重跑防护，重放同一 DALYTRAN 会重复计提；且并发无锁 | `CBTRN02C.cbl:547-553` |
| CBACT04C（652 行） | 金额计算用 `TRAN-CAT-BAL * DIS-INT-RATE / 1200`（月息），交易 ID 由 PARM 日期 + 序号拼接；手续费段落 `1400-COMPUTE-FEES` 为空实现 | `CBACT04C.cbl:464-465`、`:476-480`、`:518-520` |
| COBIL00C（572 行） | 在线直接改写账户余额（`COMPUTE ACCT-CURR-BAL = ACCT-CURR-BAL - TRAN-AMT`），但写入的交易金额为**正数**，与批量入账的加总方向相反；还款全额仅按 `ACCT-CURR-BAL` 判定 | `COBIL00C.cbl:212-236`、`:224`、`:234` |
| COPAUA0C（1026 行） | 授权决策 + MQ 应答 + IMS 写入三步无分布式事务；`CARD-NOT-ACTIVE`/`ACCOUNT-CLOSED`/`CARD-FRAUD`/`MERCHANT-FRAUD` 四个 88 条件**从未被 SET**，对应 4200/4300/5100/5200 分支为死代码 | `COPAUA0C.cbl:141-145`、`:685-716`（仅 `INSUFFICIENT-FUND` 在 `:670`、`:678` 被置真） |
| COACTUPC（4236 行） | 单程序承担账户全部字段维护（额度、余额、周期累计、客户地址含 CITY），任何字段级规则变更都落在此文件 | `COACTUPC.cbl:1078-1140`、`:1333`、`:3704` |

## 8. 迁移影响评估

| 项 | 数值 | 说明与证据 |
|---|---|---|
| 需修改的存量程序 | 0 | 绿地新建，遗留源码不改动 |
| 需重写程序 | 38 | 在线 25（§2 中 CICS 在线行）+ 批处理 13（CBTRN02C、CBTRN03C、CBACT04C、CBSTM03A/B、CBEXPORT、CBIMPORT、CBPAUP0C、DBUNLDGS、PAUDBLOD、PAUDBUNL、COBTUPDT、CBTRN01C） |
| 可废弃程序 | 6 | COBSWAIT（等待工具）、CSUTLDTC（日期校验）、CBACT01C/CBACT02C/CBACT03C/CBCUS01C（仅格式演示与打印，`READACCT.jcl:31-45` 的 ARRY/VBR 输出无下游作业） |
| 数据迁移对象 | 9 个 ASCII 数据集 | 逐文件记录数见下表；另有 `app/data/EBCDIC` 13 个 `.PS` 二进制副本 |
| 迁移记录总数 | 626 条 / 161,549 字节 | `wc -l`：acctdata 50、carddata 50、cardxref 50、custdata 50、dailytran 300、discgrp 51、tcatbal 50、trancatg 18、trantype 7 |
| 需重建的参考数据 | 3 类 | 交易类型 7 条、交易类别 18 条（`trantype.txt`、`trancatg.txt`）、披露组 51 条（`discgrp.txt`，含 `A`/`DEFAULT`/`ZEROAPR` 三组） |
| 需保留的运行时资产 | CICS 25 事务码、TDQ JOBS、2 组 MQ 队列、3 个 IMS 段 | §4.3、§6 |
| 数据质量缺口 | 2 项 | `cardxref.txt` 每行仅 36 字节（缺 14 字节 FILLER，VSAM 需 50）；`acctdata.txt` 数值字段为 EBCDIC 过穿孔字符（见 04 文档 §5） |
| 未确认项 | 3 项 | COCRDSEC 源码缺失；`PA-AUTH-STATUS` 无赋值来源；`TRANSACTION_TYPE_CATEGORY` 无程序 SQL 读写 |
