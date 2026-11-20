package com.pulse.backend.api;

import com.pulse.backend.api.PulseDtos.PulseDashboardResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.core.util.DefaultIndenter;
import tools.jackson.core.util.DefaultPrettyPrinter;
import tools.jackson.core.util.Separators;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Traceability: REQ-PULSE-003 (RFC-0003 Contract-First OpenAPI 3.1 APIs).
 *
 * <p>Runs in two modes:
 * <ul>
 *   <li><strong>Export mode</strong> ({@code -Dpulse.openapi.export=true}): writes canonical sorted
 *       OpenAPI 3.1.0 JSON to {@code ../contracts/pulse-api.openapi.json}.</li>
 *   <li><strong>CI / Verification mode</strong> (default): fails with an actionable sync command if
 *       committed {@code ../contracts/pulse-api.openapi.json} drifts from live Spring MVC controllers/DTOs.</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("REQ-PULSE-003: OpenAPI 3.1 Contract Export, Drift Detection & Golden Fixture")
class OpenApiContractExportTest {

    private static final Path CONTRACT_PATH = Path.of("../contracts/pulse-api.openapi.json");
    private static final Path GOLDEN_FIXTURE_PATH = Path.of("../contracts/fixtures/pulse-state.golden.json");

    private static final ObjectMapper CANONICAL_MAPPER = JsonMapper.builder().build();

    @Autowired
    private MockMvc mockMvc;

    @Test
    void exportOrVerifyOpenApi31Contract() throws Exception {
        MvcResult apiDocsResult = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn();

        String rawSpec = apiDocsResult.getResponse().getContentAsString(StandardCharsets.UTF_8);
        JsonNode root = CANONICAL_MAPPER.readTree(rawSpec);

        assertEquals("3.1.0", root.get("openapi").asString());

        JsonNode paths = root.get("paths");
        assertNotNull(paths, "OpenAPI paths object must be present");
        List<String> expectedPaths = List.of(
                "/api/v1/pulse/state",
                "/api/v1/pulse/tasks/{taskId}/triage",
                "/api/v1/pulse/tasks/swap",
                "/api/v1/pulse/tasks/{taskId}/chat",
                "/api/v1/pulse/settings",
                "/api/v1/pulse/demo/reset"
        );
        for (String expectedPath : expectedPaths) {
            assertTrue(paths.has(expectedPath), "Missing OpenAPI path: " + expectedPath);
        }
        assertEquals(6, paths.size(), "Expected exactly 6 Pulse API paths (actuator excluded)");

        assertEquals("getPulseState", paths.get("/api/v1/pulse/state").get("get").get("operationId").asString());
        assertEquals("triageTask", paths.get("/api/v1/pulse/tasks/{taskId}/triage").get("post").get("operationId").asString());
        assertEquals("swapTop3", paths.get("/api/v1/pulse/tasks/swap").get("post").get("operationId").asString());
        assertEquals("sendChatMessage", paths.get("/api/v1/pulse/tasks/{taskId}/chat").get("post").get("operationId").asString());
        assertEquals("updateSettings", paths.get("/api/v1/pulse/settings").get("put").get("operationId").asString());
        assertEquals("resetDemo", paths.get("/api/v1/pulse/demo/reset").get("post").get("operationId").asString());

        JsonNode schemas = root.get("components").get("schemas");
        assertNotNull(schemas.get("ApiErrorResponse"), "ApiErrorResponse schema must be exported");
        for (String enumName : List.of(
                "TriageActionCode",
                "AccountabilityCategory",
                "TaskCommitmentState",
                "TaskEnergyLevel",
                "HorizonWindowType",
                "ChatRole"
        )) {
            assertNotNull(schemas.get(enumName), enumName + " enum schema must be hoisted into components.schemas");
        }
        assertEquals(
                "#/components/schemas/TriageActionCode",
                schemas.get("TriageRequest").get("properties").get("action").get("$ref").asString()
        );
        assertEquals(
                "#/components/schemas/AccountabilityCategory",
                schemas.get("TaskAccountabilityStatus").get("properties").get("category").get("$ref").asString()
        );
        assertEquals(
                "#/components/schemas/AccountabilityCategory",
                schemas.get("HorizonWindowBarItem").get("properties").get("category").get("$ref").asString()
        );

        Set<String> actionEnums = new HashSet<>();
        for (JsonNode item : schemas.get("TriageActionCode").get("enum")) {
            actionEnums.add(item.asString());
        }
        assertEquals(
                Set.of(
                        "COMMIT_TODAY", "PIN_TOP_3", "UNPIN", "SHRINK_TO_5M",
                        "RESCHEDULE", "DELEGATE", "PARK_SOMEDAY", "DROP_CONSCIOUSLY", "COMPLETE"
                ),
                actionEnums
        );

        assertOpenApi31Nullable(schemas.get("TaskItem").get("properties").get("googleTaskId"), "string");
        assertOpenApi31Nullable(schemas.get("TaskItem").get("properties").get("dueEpochMillis"), "integer");
        assertOpenApi31Nullable(schemas.get("TaskItem").get("properties").get("completedEpochMillis"), "integer");
        assertOpenApi31Nullable(schemas.get("ConversationalMessage").get("properties").get("suggestedActionCode"), "string");
        assertOpenApi31Nullable(schemas.get("PulseDashboardResponse").get("properties").get("pendingSwapCandidateTaskId"), "string");
        assertOpenApi31Nullable(schemas.get("TriageRequest").get("properties").get("waitingOn"), "string");
        assertOpenApi31Nullable(schemas.get("TriageRequest").get("properties").get("postponeDays"), "integer");

        String canonicalJson = canonicalize(root);

        if (Boolean.getBoolean("pulse.openapi.export")) {
            Files.createDirectories(CONTRACT_PATH.getParent());
            Files.writeString(CONTRACT_PATH, canonicalJson, StandardCharsets.UTF_8);
            assertTrue(Files.exists(CONTRACT_PATH));
            return;
        }

        assertTrue(
                Files.exists(CONTRACT_PATH),
                "Committed OpenAPI contract missing at " + CONTRACT_PATH
                        + ". Run `./gradlew exportOpenApiSpec` or `bash scripts/api-contract.sh sync`."
        );

        String committed = Files.readString(CONTRACT_PATH, StandardCharsets.UTF_8);
        assertEquals(
                committed,
                canonicalJson,
                "Committed OpenAPI 3.1 contract in apps/pulse/contracts/pulse-api.openapi.json is stale! "
                        + "Run `bash scripts/api-contract.sh sync` (or `cd apps/pulse/backend && ./gradlew exportOpenApiSpec`) and commit updated artifacts."
        );
    }

    @Test
    void goldenFixtureDeserializesAndMatchesLiveEndpointTopLevelShape() throws Exception {
        assertTrue(Files.exists(GOLDEN_FIXTURE_PATH), "Golden fixture missing: " + GOLDEN_FIXTURE_PATH);
        String fixtureJson = Files.readString(GOLDEN_FIXTURE_PATH, StandardCharsets.UTF_8);

        PulseDashboardResponse decodedFixture = CANONICAL_MAPPER.readValue(fixtureJson, PulseDashboardResponse.class);
        assertNotNull(decodedFixture);
        assertEquals(3, decodedFixture.horizon().windows().size());
        assertEquals(18, decodedFixture.wcagContrastAudit().size());
        assertFalse(decodedFixture.allStatuses().isEmpty());

        mockMvc.perform(post("/api/v1/pulse/demo/reset"))
                .andExpect(status().isOk());

        MvcResult stateResult = mockMvc.perform(get("/api/v1/pulse/state"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode liveTree = CANONICAL_MAPPER.readTree(stateResult.getResponse().getContentAsString(StandardCharsets.UTF_8));
        JsonNode fixtureTree = CANONICAL_MAPPER.readTree(fixtureJson);

        assertEquals(fieldNames(liveTree), fieldNames(fixtureTree), "Golden fixture top-level fields must match live /state response");
        assertEquals(
                fieldNames(liveTree.get("horizon")),
                fieldNames(fixtureTree.get("horizon")),
                "Golden fixture horizon fields must match live /state response"
        );
        assertEquals(
                fieldNames(liveTree.get("settings")),
                fieldNames(fixtureTree.get("settings")),
                "Golden fixture settings fields must match live /state response"
        );
    }

    @Test
    void invalidTriageActionEnumAndSwaggerUiEndpointConformToContract() throws Exception {
        mockMvc.perform(post("/api/v1/pulse/tasks/task-tax-receipts/triage")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"action\":\"INVALID_ACTION\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").isString());

        mockMvc.perform(get("/swagger-ui/index.html"))
                .andExpect(status().isOk());
    }

    private static void assertOpenApi31Nullable(JsonNode propertyNode, String expectedPrimaryType) {
        assertNotNull(propertyNode, "Property schema must exist");
        JsonNode typeNode = propertyNode.get("type");
        assertNotNull(typeNode, "OpenAPI 3.1 nullable property must declare type array: " + propertyNode);
        assertTrue(typeNode.isArray(), "Expected OpenAPI 3.1 type array, got: " + typeNode);
        Set<String> types = new HashSet<>();
        for (JsonNode entry : typeNode) {
            types.add(entry.asString());
        }
        assertEquals(Set.of(expectedPrimaryType, "null"), types);
        assertFalse(propertyNode.has("nullable"), "OpenAPI 3.1 schemas should not emit legacy 3.0 nullable boolean");
    }

    private static Set<String> fieldNames(JsonNode objectNode) {
        Set<String> names = new HashSet<>();
        for (Map.Entry<String, JsonNode> entry : objectNode.properties()) {
            names.add(entry.getKey());
        }
        return names;
    }

    private static String canonicalize(JsonNode node) {
        JsonNode sorted = sortRecursively(node);
        DefaultIndenter indenter = new DefaultIndenter("  ", "\n");
        Separators separators = Separators.createDefaultInstance()
                .withObjectNameValueSpacing(Separators.Spacing.AFTER);
        DefaultPrettyPrinter printer = new DefaultPrettyPrinter()
                .withSeparators(separators)
                .withObjectIndenter(indenter)
                .withArrayIndenter(indenter);
        return CANONICAL_MAPPER.writer().with(printer).writeValueAsString(sorted) + "\n";
    }

    private static JsonNode sortRecursively(JsonNode node) {
        if (node.isObject()) {
            ObjectNode sorted = CANONICAL_MAPPER.createObjectNode();
            List<String> keys = new ArrayList<>();
            for (Map.Entry<String, JsonNode> entry : node.properties()) {
                keys.add(entry.getKey());
            }
            Collections.sort(keys);
            for (String key : keys) {
                sorted.set(key, sortRecursively(node.get(key)));
            }
            return sorted;
        }
        if (node.isArray()) {
            ArrayNode sortedArray = CANONICAL_MAPPER.createArrayNode();
            for (JsonNode item : node) {
                sortedArray.add(sortRecursively(item));
            }
            return sortedArray;
        }
        return node;
    }
}
