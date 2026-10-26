package com.carddemo.transaction.application;

import java.math.BigDecimal;

/**
 * 按卡号分组的合计（BR-RPT-03）。
 */
public record CardTotal(String cardNumber, BigDecimal total) {
}
