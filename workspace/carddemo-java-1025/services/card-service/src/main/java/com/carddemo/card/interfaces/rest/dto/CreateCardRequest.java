package com.carddemo.card.interfaces.rest.dto;

import com.carddemo.card.domain.model.CardRegistration;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * 新卡注册请求。BR-CARD-01/07/08：卡号 16 位、账户号 11 位、客户号 9 位、卡面名仅字母空格。
 */
public record CreateCardRequest(
        @NotBlank
        @Pattern(regexp = "\\d{16}", message = "Card Number must be 16 digits.")
        String cardNumber,

        @NotBlank
        @Pattern(regexp = "\\d{11}", message = "Account ID must be 11 digits.")
        String accountId,

        @NotBlank
        @Pattern(regexp = "\\d{9}", message = "Customer ID must be 9 digits.")
        String customerId,

        @NotBlank
        @Pattern(regexp = "\\d{3}", message = "CVV must be 3 digits.")
        String cvv,

        @NotBlank(message = "Embossed Name must be supplied.")
        @Size(max = 50, message = "Embossed Name must be 50 characters or less.")
        @Pattern(regexp = "[A-Za-z]+(?: [A-Za-z]+)*",
                message = "Embossed Name must contain letters and spaces only.")
        String embossedName,

        @NotNull(message = "Expiration Date must be supplied.")
        LocalDate expiryDate,

        @NotBlank
        @Pattern(regexp = "[YN]", message = "Card Status must be Y or N.")
        String activeStatus) {

    public CardRegistration toRegistration() {
        return new CardRegistration(cardNumber, accountId, customerId, cvv, embossedName,
                expiryDate, activeStatus);
    }
}
