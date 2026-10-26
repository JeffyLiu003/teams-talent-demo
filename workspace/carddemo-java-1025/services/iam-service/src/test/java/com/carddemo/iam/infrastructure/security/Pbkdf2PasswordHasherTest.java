package com.carddemo.iam.infrastructure.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class Pbkdf2PasswordHasherTest {

    private final Pbkdf2PasswordHasher hasher = new Pbkdf2PasswordHasher();

    @Test
    void hashesWithAdr008FormatAndNeverRevealsPlaintext() {
        String encoded = hasher.hash("admin123");

        assertThat(encoded).startsWith("pbkdf2$210000$").doesNotContain("admin123");
        assertThat(encoded).isNotEqualTo(hasher.hash("admin123"));
    }

    @Test
    void verifiesOnlyTheMatchingPassword() {
        String encoded = hasher.hash("user1234");

        assertThat(hasher.verify("user1234", encoded)).isTrue();
        assertThat(hasher.verify("user1235", encoded)).isFalse();
        assertThat(hasher.verify("USER1234", encoded)).isFalse();
        assertThat(hasher.verify("user1234", "not-a-hash")).isFalse();
        assertThat(hasher.verify(null, encoded)).isFalse();
    }
}
