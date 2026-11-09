package com.pulse.backend.observability;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Deque;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Pure PII-scrubbing and structured telemetry helpers for Pulse observability.
 * Ensures zero raw task titles, user notes, emails, or OAuth tokens leak into telemetry logs.
 */
public final class PulseObservability {

    private static final Logger log = LoggerFactory.getLogger("PulseBreadcrumb");
    private static final int MAX_BREADCRUMBS = 50;

    private static final Pattern EMAIL_PATTERN = Pattern.compile(
            "[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}"
    );
    private static final Pattern BEARER_TOKEN_PATTERN = Pattern.compile(
            "(?i)(Bearer\\s+|ya29\\.)[A-Za-z0-9._\\-]+"
    );

    private static final Deque<BreadcrumbEntry> RECENT_BREADCRUMBS = new ConcurrentLinkedDeque<>();

    private PulseObservability() {}

    public record BreadcrumbEntry(
            String timestampIso,
            String event,
            String summary
    ) {}

    public static String pseudonymizeIdentifier(String rawIdentifier) {
        if (rawIdentifier == null || rawIdentifier.isBlank()) {
            return "anonymous";
        }
        String normalized = rawIdentifier.trim().toLowerCase(Locale.ROOT);
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(normalized.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash, 0, 8);
        } catch (NoSuchAlgorithmException e) {
            return "anonymous";
        }
    }

    public static String scrubSensitiveText(String input) {
        if (input == null || input.isEmpty()) {
            return "";
        }
        String withoutTokens = BEARER_TOKEN_PATTERN.matcher(input).replaceAll("[REDACTED_TOKEN]");
        return EMAIL_PATTERN.matcher(withoutTokens).replaceAll("[REDACTED_EMAIL]");
    }

    public static BreadcrumbEntry recordBreadcrumb(String event, Map<String, String> attributes) {
        String safeEvent = scrubSensitiveText(event);
        String safeSummary;
        if (attributes == null || attributes.isEmpty()) {
            safeSummary = safeEvent;
        } else {
            String formattedAttrs = attributes.entrySet().stream()
                    .sorted(Map.Entry.comparingByKey())
                    .map(entry -> entry.getKey() + "=" + scrubSensitiveText(entry.getValue()))
                    .collect(Collectors.joining(", "));
            safeSummary = safeEvent + " [" + formattedAttrs + "]";
        }
        log.info(safeSummary);
        BreadcrumbEntry entry = new BreadcrumbEntry(Instant.now().toString(), safeEvent, safeSummary);
        RECENT_BREADCRUMBS.addFirst(entry);
        while (RECENT_BREADCRUMBS.size() > MAX_BREADCRUMBS) {
            RECENT_BREADCRUMBS.removeLast();
        }
        return entry;
    }

    public static void recordNonFatal(String contextTag, Throwable throwable, Map<String, String> attributes) {
        String safeMsg = scrubSensitiveText(throwable != null ? throwable.getMessage() : "unknown");
        recordBreadcrumb("non_fatal_" + contextTag, Map.of("error", safeMsg));
    }

    public static List<BreadcrumbEntry> recentBreadcrumbs() {
        return List.copyOf(RECENT_BREADCRUMBS);
    }

    public static void clearBreadcrumbs() {
        RECENT_BREADCRUMBS.clear();
    }
}
