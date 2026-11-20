# =============================================================================
# RFC-0002 Surface 1: apps/pulse/backend (Spring Boot 4 + Java 21)
# Pattern: Multi-stage Gradle builder -> Distroless non-root runtime
# =============================================================================

# --- Stage 1: Build the executable bootJar & pure-JDK health probe -----------
FROM eclipse-temurin:21-jdk-jammy AS builder

WORKDIR /workspace

# Copy Gradle wrapper & build scripts FIRST so Docker caches dependency layers
# whenever only Java source files change.
COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY gradle ./gradle
RUN chmod +x gradlew && ./gradlew dependencies --no-daemon > /dev/null || true

# Copy application source & Docker-only health probe source, then compile.
COPY src ./src
COPY docker ./docker

RUN ./gradlew bootJar --no-daemon --stacktrace \
    && mkdir -p /out /probe \
    && find build/libs -maxdepth 1 -name '*.jar' ! -name '*-plain.jar' -exec cp {} /out/app.jar \; \
    && test -s /out/app.jar \
    && javac /workspace/docker/HttpHealthProbe.java -d /probe

# --- Stage 2: Minimal distroless runtime (zero shell, zero package manager) --
# Using :nonroot drops privileges to UID 65532 automatically and removes bash/curl,
# shrinking attack surface & image footprint while keeping the Java 21 JRE.
FROM gcr.io/distroless/java21-debian12:nonroot AS runtime

USER nonroot:nonroot
WORKDIR /app

COPY --from=builder /out/app.jar /app/app.jar
COPY --from=builder /probe/HttpHealthProbe.class /probe/HttpHealthProbe.class

# 12-Factor defaults (overridden at runtime by Cloud Run or Docker Compose).
ENV PORT=8080 \
    APP_VERSION=0.6.0 \
    APP_REVISION=local \
    APP_ENV=local

EXPOSE 8080

# Distroless has no curl/wget/sh, so HEALTHCHECK runs our 1.5 KB pure-JDK probe.
HEALTHCHECK --interval=10s --timeout=5s --start-period=25s --retries=3 \
    CMD ["java", "-cp", "/probe", "HttpHealthProbe", "/actuator/health/readiness"]

# Exec-form ENTRYPOINT (JSON array) makes `java` PID 1 so SIGTERM reaches Spring
# Boot directly for graceful HTTP request draining (server.shutdown=graceful).
# -XX:MaxRAMPercentage=75.0 caps JVM heap cleanly inside container memory limits.
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-Djava.security.egd=file:/dev/./urandom", "-jar", "/app/app.jar"]
