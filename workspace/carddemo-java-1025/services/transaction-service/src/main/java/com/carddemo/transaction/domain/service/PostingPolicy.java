package com.carddemo.transaction.domain.service;

import com.carddemo.transaction.domain.model.AccountSnapshot;
import com.carddemo.transaction.domain.model.CardSnapshot;
import com.carddemo.transaction.domain.model.RejectReason;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

/**
 * 入账校验策略（CBTRN02C 380-420）。判定顺序 100 → 101 → 102 → 103，首个命中即拒付。
 * 纯领域服务：不依赖 Spring、不做 I/O。
 */
public class PostingPolicy {

    /**
     * @param card         卡号对应的卡快照，卡号不存在时为 {@code null}
     * @param account      卡号解析出的账户快照，账户不存在时为 {@code null}
     * @param amount       本笔交易金额
     * @param originalDate 交易原始日期（原始时间戳的日期部分）
     * @return 拒付原因；通过校验时返回空
     */
    public Optional<RejectReason> evaluate(CardSnapshot card, AccountSnapshot account, BigDecimal amount,
                                           LocalDate originalDate) {
        if (card == null) {
            return Optional.of(RejectReason.INVALID_CARD_NUMBER);
        }
        if (account == null) {
            return Optional.of(RejectReason.ACCOUNT_NOT_FOUND);
        }
        BigDecimal projected = account.currentCycleCredit()
                .subtract(account.currentCycleDebit())
                .add(amount);
        if (account.creditLimit().compareTo(projected) < 0) {
            return Optional.of(RejectReason.OVERLIMIT);
        }
        if (account.expirationDate() != null && account.expirationDate().isBefore(originalDate)) {
            return Optional.of(RejectReason.ACCOUNT_EXPIRED);
        }
        return Optional.empty();
    }
}
