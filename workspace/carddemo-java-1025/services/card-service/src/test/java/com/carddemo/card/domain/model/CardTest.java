package com.carddemo.card.domain.model;

import com.carddemo.card.domain.exception.BusinessRuleException;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CardTest {

    private Card card(LocalDate expirationDate) {
        return new Card(new CardRegistration("0500024453765740", "00000000001", "000000001",
                "074", "IMMANUEL KESSLER", expirationDate, "Y"));
    }

    private Card card() {
        return card(LocalDate.of(2028, 5, 20));
    }

    @Test
    void maintenanceRejectsStatusOutsideLegacyEnumeration() {
        Card card = card();

        assertThatThrownBy(() -> card.applyMaintenance("IMMANUEL KESSLER", "X", 5, 2028))
                .isInstanceOf(BusinessRuleException.class)
                .extracting("code").isEqualTo("VALIDATION_FAILED");
    }

    @Test
    void maintenanceRejectsEmbossedNameWithNonLetters() {
        Card card = card();

        assertThatThrownBy(() -> card.applyMaintenance("IMMANUEL 9", "Y", 5, 2028))
                .isInstanceOf(BusinessRuleException.class)
                .extracting("code").isEqualTo("VALIDATION_FAILED");
    }

    @Test
    void maintenanceRejectsMissingEmbossedName() {
        Card card = card();

        assertThatThrownBy(() -> card.applyMaintenance("   ", "Y", 5, 2028))
                .isInstanceOf(BusinessRuleException.class)
                .extracting("code").isEqualTo("VALIDATION_FAILED");
    }

    @Test
    void maintenanceRejectsEmbossedNameLongerThanFiftyCharacters() {
        Card card = card();
        String tooLong = "A".repeat(26) + " " + "B".repeat(24);

        assertThatThrownBy(() -> card.applyMaintenance(tooLong, "Y", 5, 2028))
                .isInstanceOf(BusinessRuleException.class)
                .extracting("code").isEqualTo("VALIDATION_FAILED");
    }

    @Test
    void maintenanceRejectsExpiryMonthOutsideOneToTwelve() {
        Card card = card();

        assertThatThrownBy(() -> card.applyMaintenance("IMMANUEL KESSLER", "Y", 0, 2028))
                .isInstanceOf(BusinessRuleException.class)
                .extracting("code").isEqualTo("VALIDATION_FAILED");
        assertThatThrownBy(() -> card.applyMaintenance("IMMANUEL KESSLER", "Y", 13, 2028))
                .isInstanceOf(BusinessRuleException.class)
                .extracting("code").isEqualTo("VALIDATION_FAILED");
    }

    @Test
    void maintenanceRejectsExpiryYearOutside1950To2099() {
        Card card = card();

        assertThatThrownBy(() -> card.applyMaintenance("IMMANUEL KESSLER", "Y", 5, 1949))
                .isInstanceOf(BusinessRuleException.class)
                .extracting("code").isEqualTo("VALIDATION_FAILED");
        assertThatThrownBy(() -> card.applyMaintenance("IMMANUEL KESSLER", "Y", 5, 2100))
                .isInstanceOf(BusinessRuleException.class)
                .extracting("code").isEqualTo("VALIDATION_FAILED");
    }

    @Test
    void maintenanceNeverChangesCvv() {
        Card card = card();

        card.applyMaintenance("IMANUEL KESSLER", "N", 8, 2029);

        assertThat(card.getCvv()).isEqualTo("074");
        assertThat(card.getEmbossedName()).isEqualTo("IMANUEL KESSLER");
        assertThat(card.getActiveStatus()).isEqualTo("N");
    }

    @Test
    void maintenanceKeepsOriginalDayWhenMonthSupportsIt() {
        Card card = card(LocalDate.of(2028, 5, 20));

        card.applyMaintenance("IMMANUEL KESSLER", "Y", 8, 2029);

        assertThat(card.getExpirationDate()).isEqualTo(LocalDate.of(2029, 8, 20));
    }

    @Test
    void maintenanceFallsBackToLastDayOfShortMonth() {
        Card card = card(LocalDate.of(2028, 1, 31));

        card.applyMaintenance("IMMANUEL KESSLER", "Y", 2, 2029);

        assertThat(card.getExpirationDate()).isEqualTo(LocalDate.of(2029, 2, 28));
    }

    @Test
    void maintenanceFallsBackToLeapDayInLeapYear() {
        Card card = card(LocalDate.of(2028, 1, 31));

        card.applyMaintenance("IMMANUEL KESSLER", "Y", 2, 2028);

        assertThat(card.getExpirationDate()).isEqualTo(LocalDate.of(2028, 2, 29));
    }

    @Test
    void rejectedMaintenanceLeavesCardUnchanged() {
        Card card = card(LocalDate.of(2028, 5, 20));

        assertThatThrownBy(() -> card.applyMaintenance("IMMANUEL KESSLER", "Y", 13, 2028))
                .isInstanceOf(BusinessRuleException.class);

        assertThat(card.getEmbossedName()).isEqualTo("IMMANUEL KESSLER");
        assertThat(card.getActiveStatus()).isEqualTo("Y");
        assertThat(card.getExpirationDate()).isEqualTo(LocalDate.of(2028, 5, 20));
        assertThat(card.getCvv()).isEqualTo("074");
    }

    @Test
    void registrationRejectsCardNumberThatIsNotSixteenDigits() {
        assertThatThrownBy(() -> new Card(new CardRegistration("500024453765740", "00000000001",
                "000000001", "074", "IMMANUEL KESSLER", LocalDate.of(2028, 5, 20), "Y")))
                .isInstanceOf(BusinessRuleException.class)
                .extracting("code").isEqualTo("VALIDATION_FAILED");
    }

    @Test
    void registrationRejectsExpirationYearOutside1950To2099() {
        assertThatThrownBy(() -> card(LocalDate.of(1949, 5, 20)))
                .isInstanceOf(BusinessRuleException.class)
                .extracting("code").isEqualTo("VALIDATION_FAILED");
    }
}
