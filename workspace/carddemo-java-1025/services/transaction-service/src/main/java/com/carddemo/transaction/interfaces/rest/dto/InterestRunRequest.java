package com.carddemo.transaction.interfaces.rest.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

/**
 * 利息运行请求；statementDate 缺省为服务端当天。
 */
public record InterestRunRequest(@NotNull(message = "Statement Date must be supplied.") LocalDate statementDate) {
}
