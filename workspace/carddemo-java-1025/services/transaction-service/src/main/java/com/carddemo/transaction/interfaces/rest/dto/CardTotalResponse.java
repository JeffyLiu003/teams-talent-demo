package com.carddemo.transaction.interfaces.rest.dto;

import com.carddemo.transaction.application.CardTotal;

import java.math.BigDecimal;

public record CardTotalResponse(String cardNumber, BigDecimal total) {

    public static CardTotalResponse from(CardTotal total) {
        return new CardTotalResponse(total.cardNumber(), total.total());
    }
}
