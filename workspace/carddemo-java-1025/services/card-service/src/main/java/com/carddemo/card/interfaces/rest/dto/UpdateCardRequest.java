package com.carddemo.card.interfaces.rest.dto;

import com.carddemo.card.domain.model.CardMaintenance;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 卡片维护请求。BR-CARD-07/08/09：卡面名仅字母空格且必填、状态 [YN]、月 1–12、年 1950–2099。
 * 到期日与 CVV 不可通过本请求修改（NR-CARD-01）。
 */
public record UpdateCardRequest(
        @Schema(description = "卡面姓名（仅字母与空格）", example = "IMMANUEL KESSLER",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "Embossed Name must be supplied.")
        @Size(max = 50, message = "Embossed Name must be 50 characters or less.")
        @Pattern(regexp = "[A-Za-z]+(?: [A-Za-z]+)*",
                message = "Embossed Name must contain letters and spaces only.")
        String embossedName,

        @Schema(description = "卡状态 Y/N", example = "Y", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull
        @Pattern(regexp = "[YN]", message = "Card Status must be Y or N.")
        String activeStatus,

        @Schema(description = "到期月 1-12", example = "5", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "Expiry Month must be supplied.")
        @Min(value = 1, message = "Expiry Month must be between 1 and 12.")
        @Max(value = 12, message = "Expiry Month must be between 1 and 12.")
        Integer expiryMonth,

        @Schema(description = "到期年 1950-2099", example = "2028", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "Expiry Year must be supplied.")
        @Min(value = 1950, message = "Expiry Year must be between 1950 and 2099.")
        @Max(value = 2099, message = "Expiry Year must be between 1950 and 2099.")
        Integer expiryYear) {

    public CardMaintenance toMaintenance() {
        return new CardMaintenance(embossedName, activeStatus, expiryMonth, expiryYear);
    }
}
