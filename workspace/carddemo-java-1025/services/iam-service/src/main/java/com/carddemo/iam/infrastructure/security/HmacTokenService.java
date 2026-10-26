package com.carddemo.iam.infrastructure.security;

import com.carddemo.iam.domain.security.IssuedToken;
import com.carddemo.iam.domain.security.TokenService;
import com.carddemo.iam.domain.security.TokenVerification;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;

/**
 * ADR-007：token = base64url(payload) + "." + base64url(HmacSHA256(payload, secret))，
 * payload 明文为 {@code userId|userType|expiresAtEpochSecond}。
 */
@Component
public class HmacTokenService implements TokenService {

    private static final String ALGORITHM = "HmacSHA256";
    private static final String SEPARATOR = "|";

    private final byte[] secret;
    private final long ttlSeconds;

    public HmacTokenService(@Value("${iam.token.secret}") String secret,
                            @Value("${iam.token.ttl-seconds}") long ttlSeconds) {
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.ttlSeconds = ttlSeconds;
    }

    @Override
    public IssuedToken issue(String userId, String userType) {
        Instant expiresAt = Instant.now().plusSeconds(ttlSeconds).truncatedTo(ChronoUnit.SECONDS);
        String payload = userId + SEPARATOR + userType + SEPARATOR + expiresAt.getEpochSecond();
        Base64.Encoder encoder = Base64.getUrlEncoder().withoutPadding();
        String token = encoder.encodeToString(payload.getBytes(StandardCharsets.UTF_8))
                + "." + encoder.encodeToString(sign(payload));
        return new IssuedToken(token, expiresAt);
    }

    @Override
    public TokenVerification verify(String token) {
        if (token == null || token.isBlank()) {
            return TokenVerification.invalid();
        }
        int separator = token.lastIndexOf('.');
        if (separator <= 0 || separator == token.length() - 1) {
            return TokenVerification.invalid();
        }
        String payload;
        byte[] signature;
        try {
            Base64.Decoder decoder = Base64.getUrlDecoder();
            payload = new String(decoder.decode(token.substring(0, separator)), StandardCharsets.UTF_8);
            signature = decoder.decode(token.substring(separator + 1));
        } catch (IllegalArgumentException ex) {
            return TokenVerification.invalid();
        }
        if (!MessageDigest.isEqual(sign(payload), signature)) {
            return TokenVerification.invalid();
        }
        String[] parts = payload.split("\\" + SEPARATOR);
        if (parts.length != 3 || parts[0].isBlank() || parts[1].isBlank()) {
            return TokenVerification.invalid();
        }
        Instant expiresAt;
        try {
            expiresAt = Instant.ofEpochSecond(Long.parseLong(parts[2]));
        } catch (NumberFormatException ex) {
            return TokenVerification.invalid();
        }
        if (!expiresAt.isAfter(Instant.now())) {
            return TokenVerification.invalid();
        }
        return new TokenVerification(true, parts[0], parts[1], expiresAt);
    }

    private byte[] sign(String payload) {
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(new SecretKeySpec(secret, ALGORITHM));
            return mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException | InvalidKeyException ex) {
            throw new IllegalStateException("Token signing is unavailable", ex);
        }
    }
}
