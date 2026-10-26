package com.carddemo.authorization.domain.service;

import com.carddemo.authorization.domain.exception.BusinessRuleException;
import com.carddemo.authorization.domain.model.AccountSnapshot;
import com.carddemo.authorization.domain.model.AuthorizationCase;
import com.carddemo.authorization.domain.model.AuthorizationSummary;
import com.carddemo.authorization.domain.model.CardSnapshot;
import com.carddemo.authorization.domain.model.CustomerSnapshot;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * 授权决策策略（COPAUA0C 6000-MAKE-DECISION）。判定顺序即原因码优先级（BR-AUTH-09）：
 * 3100 不存在 → 4100 额度不足 → 4200 卡未激活 → 4300 账户关闭 → 5100 卡级欺诈 → 批准。
 * 纯领域服务：不依赖 Spring、不做 I/O。
 */
public class AuthorizationPolicy {

    public static final String REASON_APPROVED = "0000";
    public static final String REASON_NOT_FOUND = "3100";
    public static final String REASON_INSUFFICIENT_FUND = "4100";
    public static final String REASON_CARD_INACTIVE = "4200";
    public static final String REASON_ACCOUNT_CLOSED = "4300";
    public static final String REASON_CARD_FRAUD = "5100";

    /**
     * @param card              卡号对应的卡快照，卡号不存在时为 {@code null}
     * @param customer          卡上的客户快照，客户不存在时为 {@code null}
     * @param account           卡上的账户快照，账户不存在时为 {@code null}
     * @param summary           该账户的待授权汇总，尚无汇总时为 {@code null}
     * @param cardFraudFlagged  卡级欺诈标记是否命中
     * @param transactionAmount 本笔交易金额（必须大于 0）
     * @return 决策（响应码、原因码、批准金额）
     */
    public Decision decide(CardSnapshot card, CustomerSnapshot customer, AccountSnapshot account,
                           AuthorizationSummary summary, boolean cardFraudFlagged,
                           BigDecimal transactionAmount) {
        if (transactionAmount == null || transactionAmount.signum() <= 0) {
            throw new BusinessRuleException("INVALID_TRANSACTION_AMOUNT",
                    "Transaction Amount must be greater than zero.");
        }
        if (card == null || customer == null || account == null) {
            return decline(REASON_NOT_FOUND);
        }
        if (transactionAmount.compareTo(availableCredit(account, summary)) > 0) {
            return decline(REASON_INSUFFICIENT_FUND);
        }
        if (!"Y".equals(card.activeStatus())) {
            return decline(REASON_CARD_INACTIVE);
        }
        if (!"Y".equals(account.activeStatus())) {
            return decline(REASON_ACCOUNT_CLOSED);
        }
        if (cardFraudFlagged) {
            return decline(REASON_CARD_FRAUD);
        }
        return approve(transactionAmount);
    }

    /**
     * BR-AUTH-03 + NR-AUTH-03：可用额度 = 信用额度 − 账户当前欠款 − 未过期批准占用。
     * 遗留系统在存在待授权汇总时只减汇总信用余额、忽略账户当前欠款，导致首笔授权后额度被放大；
     * 新系统始终同时扣除两者。
     */
    public static BigDecimal availableCredit(AccountSnapshot account, AuthorizationSummary summary) {
        BigDecimal pendingApproved = summary == null
                ? BigDecimal.ZERO.setScale(2)
                : summary.getCreditBalance();
        return account.creditLimit().subtract(account.currentBalance()).subtract(pendingApproved);
    }

    private static Decision decline(String reasonCode) {
        return new Decision(AuthorizationCase.DECLINED, reasonCode, BigDecimal.ZERO.setScale(2));
    }

    private static Decision approve(BigDecimal transactionAmount) {
        return new Decision(AuthorizationCase.APPROVED, REASON_APPROVED,
                transactionAmount.setScale(2, RoundingMode.HALF_UP));
    }

    /**
     * 决策结果。批准（00）时 approvedAmount 为交易金额，拒绝（05）时为 0.00。
     */
    public record Decision(String responseCode, String reasonCode, BigDecimal approvedAmount) {
    }
}
