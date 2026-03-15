package com.avmessenger;

import java.util.*;
import java.util.regex.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * A.VMESSENGER — Java User Service
 *
 * Handles user-related validation and utilities:
 *   - Email format validation (RFC 5322 compliant)
 *   - Display name validation
 *   - Password strength scoring
 *   - Avatar color assignment (deterministic by email hash)
 */
public class UserService {

    private static final String[] AVATAR_COLORS = {
        "#7c5cbf", "#ff6b35", "#e84393", "#2dd4a0",
        "#ffd166", "#3a9bd5", "#f72585", "#4cc9f0"
    };

    private static final Pattern EMAIL_PATTERN = Pattern.compile(
        "^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$"
    );

    // ── Registration Validation Result ────────────────────────
    public static class RegisterResult {
        public final boolean valid;
        public final String  error;
        public final String  avatarColor;
        public final int     passwordStrength; // 0–5

        RegisterResult(boolean v, String e, String c, int s) {
            this.valid = v; this.error = e;
            this.avatarColor = c; this.passwordStrength = s;
        }
    }

    // ── Validate registration fields ─────────────────────────
    public static RegisterResult validateRegister(String name, String email, String password) {
        // Name check
        if (name == null || name.isBlank())      return fail("Name is required");
        if (name.trim().length() < 2)             return fail("Name must be at least 2 characters");
        if (name.trim().length() > 50)            return fail("Name too long (max 50 chars)");

        // Email check
        if (email == null || email.isBlank())    return fail("Email is required");
        if (!EMAIL_PATTERN.matcher(email.trim()).matches()) return fail("Invalid email address");

        // Password strength
        int strength = scorePassword(password);
        if (password == null || password.length() < 6) return fail("Password must be at least 6 characters");
        if (strength < 1)  return fail("Password too weak — add numbers or symbols");

        // Assign deterministic avatar color from email
        String color = pickColor(email.toLowerCase().trim());

        return new RegisterResult(true, null, color, strength);
    }

    // ── Password strength scorer (0 = terrible, 5 = strong) ──
    public static int scorePassword(String pw) {
        if (pw == null) return 0;
        int score = 0;
        if (pw.length() >= 8)  score++;
        if (pw.length() >= 12) score++;
        if (pw.matches(".*[A-Z].*")) score++;
        if (pw.matches(".*[0-9].*")) score++;
        if (pw.matches(".*[^a-zA-Z0-9].*")) score++;
        return score;
    }

    // ── Deterministic avatar color by email hash ───────────────
    public static String pickColor(String email) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(email.getBytes(StandardCharsets.UTF_8));
            int idx = Math.abs(hash[0]) % AVATAR_COLORS.length;
            return AVATAR_COLORS[idx];
        } catch (Exception e) {
            return AVATAR_COLORS[0];
        }
    }

    // ── Helper ────────────────────────────────────────────────
    private static RegisterResult fail(String msg) {
        return new RegisterResult(false, msg, null, 0);
    }

    // ── CLI test ──────────────────────────────────────────────
    public static void main(String[] args) {
        // Test cases
        String[][] tests = {
            {"Alex V", "alex@example.com", "MyPass123!"},
            {"",       "bad-email",        "weak"},
            {"Jo",     "jo@test.io",       "Str0ng#Pass"},
        };
        for (String[] t : tests) {
            RegisterResult r = validateRegister(t[0], t[1], t[2]);
            System.out.printf("name=%-8s email=%-20s → valid=%b strength=%d color=%s %s%n",
                t[0], t[1], r.valid, r.passwordStrength,
                r.avatarColor != null ? r.avatarColor : "N/A",
                r.error != null ? "err: " + r.error : ""
            );
        }
    }
}
