package com.pulse.backend.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.servers.Server;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/**
 * OpenAPI 3.1 contract customization for RFC-0003.
 *
 * <p>Keeps {@code com.pulse.backend.domain} 100% free of Spring/Swagger annotations (ADR-007)
 * while enforcing deterministic OpenAPI 3.1 nullability and strict {@code required} field sets
 * across generated TypeScript (Angular 21) and Kotlin Multiplatform (JVM + wasmJs) clients.
 */
@Configuration
public class OpenApiContractConfig {

    private static final Map<String, Set<String>> NULLABLE_REQUIRED_RESPONSE_FIELDS = Map.of(
            "TaskItem", Set.of("googleTaskId", "dueEpochMillis", "completedEpochMillis"),
            "ConversationalMessage", Set.of("suggestedActionCode"),
            "PulseDashboardResponse", Set.of("pendingSwapCandidateTaskId")
    );

    private static final Map<String, Set<String>> OPTIONAL_NULLABLE_REQUEST_FIELDS = Map.of(
            "TriageRequest", Set.of("waitingOn", "postponeDays")
    );

    private static final Map<String, String> ENUM_COMPONENT_MAP = Map.of(
            "TriageRequest.action", "TriageActionCode",
            "TaskAccountabilityStatus.category", "AccountabilityCategory",
            "HorizonWindowBarItem.category", "AccountabilityCategory",
            "TaskItem.commitment", "TaskCommitmentState",
            "TaskItem.energy", "TaskEnergyLevel",
            "HorizonWindowCardModel.windowType", "HorizonWindowType",
            "ConversationalMessage.role", "ChatRole"
    );

    @Bean
    public OpenAPI pulseOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Pulse Accountability API")
                        .version("1.0.0")
                        .description(
                                "Contract-first OpenAPI 3.1.0 specification shared across Spring Boot 4 (Java 21), "
                                        + "Angular 21 (openapi-typescript), and Kotlin Multiplatform (JVM + wasmJs). "
                                        + "Evolved under Expand-and-Contract compatibility enforced by oasdiff."
                        ))
                .servers(List.of(
                        new Server()
                                .url("/")
                                .description("Same-origin / Nginx edge-proxied Pulse API")
                ));
    }

    @Bean
    @SuppressWarnings({"rawtypes", "unchecked"})
    public OpenApiCustomizer pulseContractSchemaCustomizer() {
        return openApi -> {
            Components components = openApi.getComponents();
            if (components == null || components.getSchemas() == null) {
                return;
            }

            Map<String, Schema> sortedSchemas = new TreeMap<>(components.getSchemas());
            Map<String, Schema> hoistedEnums = new TreeMap<>();
            for (Map.Entry<String, Schema> entry : sortedSchemas.entrySet()) {
                String schemaName = entry.getKey();
                Schema<?> schema = entry.getValue();
                Map<String, Schema> properties = schema.getProperties();
                if (properties == null || properties.isEmpty()) {
                    continue;
                }

                Set<String> nullableRequired = NULLABLE_REQUIRED_RESPONSE_FIELDS.getOrDefault(schemaName, Set.of());
                Set<String> optionalNullable = OPTIONAL_NULLABLE_REQUEST_FIELDS.getOrDefault(schemaName, Set.of());

                List<String> required = new ArrayList<>();
                Map<String, Schema> sortedProperties = new TreeMap<>(properties);
                for (Map.Entry<String, Schema> propEntry : sortedProperties.entrySet()) {
                    String propName = propEntry.getKey();
                    Schema<?> propSchema = propEntry.getValue();
                    String enumTargetName = ENUM_COMPONENT_MAP.get(schemaName + "." + propName);
                    if (enumTargetName != null && propSchema.getEnum() != null && !propSchema.getEnum().isEmpty()) {
                        hoistedEnums.computeIfAbsent(enumTargetName, ignored -> buildEnumComponentSchema(propSchema));
                        sortedProperties.put(propName, new Schema<>().$ref("#/components/schemas/" + enumTargetName));
                    } else {
                        boolean isNullable = nullableRequired.contains(propName) || optionalNullable.contains(propName);
                        normalizeOpenApi31Nullability(propSchema, isNullable);
                    }

                    if (!optionalNullable.contains(propName)) {
                        required.add(propName);
                    }
                }

                schema.setProperties(sortedProperties);
                required.sort(Comparator.naturalOrder());
                schema.setRequired(required.isEmpty() ? null : required);
            }
            sortedSchemas.putAll(hoistedEnums);
            components.setSchemas(sortedSchemas);
        };
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static Schema<?> buildEnumComponentSchema(Schema<?> sourcePropSchema) {
        Schema<Object> enumSchema = new Schema<>();
        enumSchema.setTypes(Set.of("string"));
        enumSchema.setEnum(new ArrayList<>(sourcePropSchema.getEnum()));
        if (sourcePropSchema.getDescription() != null && !sourcePropSchema.getDescription().isBlank()) {
            enumSchema.setDescription(sourcePropSchema.getDescription());
        }
        return enumSchema;
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static void normalizeOpenApi31Nullability(Schema<?> propSchema, boolean isNullable) {
        propSchema.setNullable(null);

        if (!isNullable) {
            return;
        }

        Set<String> types = new LinkedHashSet<>();
        if (propSchema.getTypes() != null && !propSchema.getTypes().isEmpty()) {
            types.addAll(propSchema.getTypes());
        } else if (propSchema.getType() != null && !propSchema.getType().isBlank()) {
            types.add(propSchema.getType());
        }
        types.add("null");
        propSchema.setType(null);
        propSchema.setTypes(types);
    }
}
