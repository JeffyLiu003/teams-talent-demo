# ISO 20022 报文标准参考

## 1. 概述

ISO 20022 是金融业通用报文标准，定义了支付、清算、证券等领域的统一报文格式。银行支付系统开发中常见以下报文族：

| 报文族 | 前缀 | 用途 | 典型场景 |
|--------|------|------|---------|
| pain | 支付发起 | Customer Credit Transfer Initiation | 客户发起转账 |
| pacs | 支付清算 | FIToFIPaymentStatusReport / CreditTransfer | 跨行清算 |
| camt | 现金管理 | BankToCustomerStatement / Notification | 对账文件 |
| pacs.008 | 跨行贷记 | FI to FI Customer Credit Transfer | 跨行转账 |
| pacs.004 | 冲正 | Payment Reversal | 交易冲正 |
| camt.053 | 对账单 | Bank to Customer Statement | 日终对账 |
| camt.054 | 通知 | Bank to Customer Debit Credit Notification | 交易通知 |

## 2. 核心报文结构（pacs.008 示例）

```
<Document>
  <FIToFICstmrCdtTrf>
    <GrpHdr>            -- 报文头（全局信息）
      <MsgId>           -- 报文唯一标识
      <CreDtTm>         -- 创建时间
      <NbOfTxs>         -- 交易笔数
      <SttlmInf>        -- 结算信息
    </GrpHdr>
    <CdtTrfTxInf>       -- 贷记转账信息（可多条）
      <PmtId>           -- 支付标识
        <EndToEndId>    -- 端到端标识（全链路唯一）
        <TxId>          -- 交易标识
        <UETR>          -- 唯一端到端交易参考（UUID）
      </PmtId>
      <IntrBkSttlmAmt>  -- 行间结算金额
      <ChrgBr>          -- 手续费承担方
      <CdtrAgt>         -- 收款行
      <DbtrAgt>         -- 付款行
      <Cdtr>            -- 收款人
      <Dbtr>            -- 付款人
      <RmtInf>          -- 附言信息
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>
```

## 3. 开发约束

| 约束 | 说明 |
|------|------|
| 字段长度 | 严格按ISO 20022定义，不得超长截断 |
| 字符编码 | UTF-8，金额字段不含千分位 |
| 必填校验 | GrpHdr/MsgId/CreDtTm/NbOfTxs 必填 |
| 唯一性 | EndToEndId 和 UETR 须全局唯一 |
| 幂等性 | 相同 MsgId 重复提交应返回相同结果 |
| 时区 | CreDtTm 使用 UTC，展示时按本地时区转换 |

## 4. 本行报文适配

本行在 ISO 20022 基础上做如下适配：

| 标准字段 | 本行适配 | 原因 |
|---------|---------|------|
| BIC | 改用行内机构号 | 本行跨机构用内部编码 |
| IBAN | 改用本行账号 | 国内账户无IBAN |
| Currency | 默认CNY | 人民币优先 |
| RmtInf | 限制140字符 | 行内存储字段长度限制 |

> 适配映射须在 `references/iso20022-mapping.md` 中维护，报文解析/生成脚本须校验映射一致性。