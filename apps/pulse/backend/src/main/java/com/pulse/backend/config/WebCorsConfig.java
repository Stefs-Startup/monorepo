package com.pulse.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;

/**
 * 12-Factor CORS configuration allowing local dev origins by default and
 * explicit comma-separated production SPA origins via CORS_ALLOWED_ORIGINS.
 */
@Configuration
public class WebCorsConfig implements WebMvcConfigurer {

    private static final String[] DEFAULT_ORIGINS = {"http://localhost:*", "http://127.0.0.1:*"};

    private final String[] allowedOriginPatterns;

    public WebCorsConfig(
            @Value("${pulse.cors.allowed-origin-patterns:http://localhost:*,http://127.0.0.1:*}")
            String allowedOriginPatternsRaw
    ) {
        String[] parsed = allowedOriginPatternsRaw == null
                ? new String[0]
                : Arrays.stream(allowedOriginPatternsRaw.split(","))
                        .map(String::trim)
                        .filter(origin -> !origin.isEmpty())
                        .toArray(String[]::new);
        this.allowedOriginPatterns = parsed.length > 0 ? parsed : DEFAULT_ORIGINS;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns(this.allowedOriginPatterns)
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*");
    }
}
