package com.carddemo.iam.infrastructure.security;

import com.carddemo.iam.domain.security.PasswordHasher;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.security.spec.InvalidKeySpecException;
import java.util.Base64;

/**
 * ADR-008：PBKDF2-HMAC-SHA256，210000 次迭代，16 字节随机盐，
 * 编码格式 {@code pbkdf2$<iterations>$<saltBase64>$<hashBase64>}。
 */
@Component
public class Pbkdf2PasswordHasher implements PasswordHasher {

    private static final String ALGORITHM = "PBKDF2WithHmacSHA256";
    private static final String PREFIX = "pbkdf2";
    private static final String SEPARATOR = "$";
    private static final int ITERATIONS = 210_000;
    private static final int SALT_BYTES = 16;
    private static final int KEY_BITS = 256;

    private final SecureRandom random = new SecureRandom();

    @Override
    public String hash(String rawPassword) {
        byte[] salt = new byte[SALT_BYTES];
        random.nextBytes(salt);
        byte[] derived = derive(rawPassword, salt, ITERATIONS);
        Base64.Encoder encoder = Base64.getEncoder();
        return PREFIX + SEPARATOR + ITERATIONS + SEPARATOR
                + encoder.encodeToString(salt) + SEPARATOR + encoder.encodeToString(derived);
    }

    @Override
    public boolean verify(String rawPassword, String encodedPassword) {
        if (rawPassword == null || encodedPassword == null) {
            return false;
        }
        String[] parts = encodedPassword.split("\\" + SEPARATOR);
        if (parts.length != 4 || !PREFIX.equals(parts[0])) {
            return false;
        }
        try {
            int iterations = Integer.parseInt(parts[1]);
            byte[] salt = Base64.getDecoder().decode(parts[2]);
            byte[] expected = Base64.getDecoder().decode(parts[3]);
            byte[] actual = derive(rawPassword, salt, iterations);
            return MessageDigest.isEqual(expected, actual);
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    private static byte[] derive(String rawPassword, byte[] salt, int iterations) {
        char[] password = rawPassword.toCharArray();
        PBEKeySpec spec = new PBEKeySpec(password, salt, iterations, KEY_BITS);
        try {
            return SecretKeyFactory.getInstance(ALGORITHM).generateSecret(spec).getEncoded();
        } catch (NoSuchAlgorithmException | InvalidKeySpecException ex) {
            throw new IllegalStateException("Password hashing is unavailable", ex);
        } finally {
            spec.clearPassword();
        }
    }

}
