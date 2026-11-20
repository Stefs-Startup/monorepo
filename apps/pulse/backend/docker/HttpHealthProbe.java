import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Minimal pure-JDK HTTP health probe for distroless containers that omit curl/wget/sh.
 * Compiled separately from src/main/java so Gradle/ArchUnit/Pitest stay clean.
 */
public final class HttpHealthProbe {

    private HttpHealthProbe() {}

    public static void main(String[] args) {
        String port = System.getenv("PORT");
        if (port == null || port.isBlank()) {
            port = "8080";
        }
        String path = args.length > 0 && !args[0].isBlank()
                ? args[0]
                : "/actuator/health/readiness";

        URI uri = URI.create("http://127.0.0.1:" + port + path);
        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();
        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(3))
                .GET()
                .build();

        try {
            HttpResponse<Void> response = client.send(request, HttpResponse.BodyHandlers.discarding());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                System.exit(0);
            }
            System.err.println("Health probe failed with HTTP " + response.statusCode() + " at " + uri);
            System.exit(1);
        } catch (Exception ex) {
            System.err.println("Health probe error at " + uri + ": " + ex.getMessage());
            System.exit(1);
        }
    }
}
