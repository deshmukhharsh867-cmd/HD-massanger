package com.avmessenger;

import java.util.*;
import java.util.regex.*;

/**
 * A.VMESSENGER — Java Message Validation Service
 *
 * This service validates and sanitizes chat messages before persistence.
 * It's called by the Node.js server via REST (Spring Boot) or child_process.
 *
 * Responsibilities:
 *   - Max length enforcement
 *   - Spam pattern detection
 *   - Profanity / banned word filtering (configurable)
 *   - Rate limiting metadata
 *   - Message type classification (text / link / emoji-only)
 */
public class MessageValidator {

    // ── Constants ──────────────────────────────────────────────
    private static final int MAX_LENGTH    = 2000;
    private static final int MIN_LENGTH    = 1;
    private static final int MAX_LINES     = 20;
    private static final int SPAM_REPEAT   = 5;   // same char repeated N+ times
    private static final Pattern URL_PATTERN =
        Pattern.compile("https?://[\\w\\-._~:/?#\\[\\]@!$&'()*+,;=%]+");
    private static final Pattern EMOJI_ONLY =
        Pattern.compile("^[\\p{So}\\p{Sm}\\s]+$");

    // Configurable banned words list (extend as needed)
    private static final Set<String> BANNED_WORDS = new HashSet<>(Arrays.asList(
        "spam_word_1", "spam_word_2"  // replace with real words
    ));

    // ── Validation Result ──────────────────────────────────────
    public static class ValidationResult {
        public final boolean valid;
        public final String  sanitized;
        public final String  error;
        public final String  type;       // "text" | "link" | "emoji"
        public final Map<String, Object> meta;

        private ValidationResult(boolean v, String s, String e, String t, Map<String,Object> m) {
            this.valid = v; this.sanitized = s; this.error = e;
            this.type  = t; this.meta      = m;
        }

        @Override
        public String toString() {
            return String.format(
                "{valid:%b, type:'%s', length:%d, error:%s}",
                valid, type, sanitized != null ? sanitized.length() : 0, error
            );
        }
    }

    // ── Main Validation Entry Point ────────────────────────────
    public static ValidationResult validate(String text) {
        Map<String, Object> meta = new LinkedHashMap<>();

        // 1. Null / empty check
        if (text == null || text.isBlank()) {
            return fail("Message cannot be empty", meta);
        }

        // 2. Trim and normalize whitespace
        String cleaned = text.strip()
            .replaceAll("[ \\t]+", " ")       // collapse spaces
            .replaceAll("(\\r\\n|\\r)", "\n"); // normalize line endings

        meta.put("originalLength", text.length());
        meta.put("cleanedLength",  cleaned.length());

        // 3. Length check
        if (cleaned.length() < MIN_LENGTH) return fail("Message too short", meta);
        if (cleaned.length() > MAX_LENGTH) {
            cleaned = cleaned.substring(0, MAX_LENGTH);
            meta.put("truncated", true);
        }

        // 4. Line count
        long lines = cleaned.chars().filter(c -> c == '\n').count() + 1;
        if (lines > MAX_LINES) return fail("Too many lines (max " + MAX_LINES + ")", meta);

        // 5. Spam detection: repeating characters
        if (hasSpamPattern(cleaned)) {
            return fail("Message looks like spam (repeating characters)", meta);
        }

        // 6. Banned words
        String lower = cleaned.toLowerCase();
        for (String banned : BANNED_WORDS) {
            if (lower.contains(banned)) return fail("Message contains disallowed content", meta);
        }

        // 7. Classify type
        String type = classify(cleaned);
        meta.put("type",    type);
        meta.put("hasLink", URL_PATTERN.matcher(cleaned).find());
        meta.put("lines",   lines);

        return new ValidationResult(true, cleaned, null, type, meta);
    }

    // ── Helper: Spam detection ─────────────────────────────────
    private static boolean hasSpamPattern(String text) {
        // Check for N+ consecutive identical characters (e.g., "aaaaaaaaaa")
        int count = 1;
        for (int i = 1; i < text.length(); i++) {
            if (text.charAt(i) == text.charAt(i - 1)) {
                if (++count >= SPAM_REPEAT * 3) return true;
            } else {
                count = 1;
            }
        }
        return false;
    }

    // ── Helper: Message type classification ───────────────────
    private static String classify(String text) {
        if (EMOJI_ONLY.matcher(text).matches()) return "emoji";
        if (URL_PATTERN.matcher(text).find())    return "link";
        return "text";
    }

    // ── Helper: Failure result ─────────────────────────────────
    private static ValidationResult fail(String error, Map<String, Object> meta) {
        return new ValidationResult(false, null, error, null, meta);
    }

    // ── CLI entry point (for Node.js child_process calls) ─────
    public static void main(String[] args) {
        if (args.length == 0) {
            System.err.println("Usage: java MessageValidator <message>");
            System.exit(1);
        }

        String input = String.join(" ", args);
        ValidationResult result = validate(input);

        // Output JSON for easy Node.js parsing
        System.out.printf("{\"valid\":%b,\"sanitized\":\"%s\",\"type\":\"%s\",\"error\":%s}%n",
            result.valid,
            result.valid ? escapeJson(result.sanitized) : "",
            result.type != null ? result.type : "",
            result.error != null ? "\"" + result.error + "\"" : "null"
        );

        System.exit(result.valid ? 0 : 1);
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }
}
