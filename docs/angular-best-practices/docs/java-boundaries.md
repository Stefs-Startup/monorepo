# Strict Java Boundary Enforcement

In enterprise Java environments, maintaining domain boundaries over time is a constant battle. Developers frequently bypass interfaces, create circular dependencies between modules, or leak infrastructure implementations (like Spring JPA Hibernate classes) directly into business domains.

We enforce clean architectural boundaries in our Java stacks using two core mechanisms: **Package-Private Encapsulation** and **ArchUnit Architecture Testing**.

---

## 🔒 Package-Private Encapsulation

Java's default access level (no keyword, also known as **package-private**) restricts visibility exclusively to other classes within the same package. Developers often lazily declare every class and method as `public`, which destroys encapsulation.

We enforce the following access levels across Hexagonal layers:

```
[ billing-adapter-out-persistence ]
  ├── InvoiceRepositoryPort.java    <-- PUBLIC (Defined in Application, exposed to Domain)
  ├── JpaInvoiceRepository.java     <-- PACKAGE-PRIVATE (Internal implementation, hidden)
  └── PersistenceAdapter.java      <-- PUBLIC (Exposes implementation to Application via configuration)
```

### Encapsulation Rules:
1.  **Hide Adapter Implementations**: Database adapter classes (e.g., JPA Entities, Spring Data Repository interfaces, Mapper utilities) must be declared **package-private** (`class JpaInvoiceRepository`). Only the configuration class that hooks up the adapter to the Port should be public.
2.  **Expose via Ports**: The application domain must only consume outbound adapters through abstract, public Port interfaces defined inside the `application` package. It must never have direct imports or references to adapter implementation classes.

---

## 📐 Programmatic Boundaries with ArchUnit

Hoping that developers will read documentation and respect packaging boundaries is not a risk-mitigation strategy. We enforce our architecture programmatically by writing **ArchUnit** unit tests that run on every CI build. If a developer accidentally imports a JPA database entity inside the domain, the unit test fails.

### Standard ArchUnit Boundary Rule Suite:

Add the ArchUnit dependency to your project:
```kotlin
// build.gradle.kts
testImplementation("com.tngtech.archunit:archunit-junit5:1.2.1")
```

Create a dedicated architecture test suite class in your test module:

```java
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import static com.tngtech.archunit.library.Architectures.onionArchitecture;

@AnalyzeClasses(packages = "com.company.billing")
public class ArchitectureBoundaryTest {

    // 1. Onion/Hexagonal Structure Rule
    @ArchTest
    public static final ArchRule hexagonal_architecture_boundaries_are_respected = 
        onionArchitecture()
            .domainModel("com.company.billing.domain.model..")
            .domainServices("com.company.billing.domain.service..")
            .applicationServices("com.company.billing.application..")
            .adapter("web", "com.company.billing.adapter.in.web..")
            .adapter("persistence", "com.company.billing.adapter.out.persistence..");

    // 2. Strict Domain Purity Rule
    @ArchTest
    public static final ArchRule domain_must_never_depend_on_frameworks = 
        classes()
            .that().resideInAPackage("..domain..")
            .should().onlyDependOnClassesThat()
            .resideInAnyPackage(
                "java..",              // Standard Java libraries
                "org.slf4j..",         // Structured logger APIs
                "..domain.."           // Internal domain classes
            )
            .because("The core business domain must remain framework-agnostic (Zero Spring/JPA imports!).");

    // 3. Inbound Adapters Separation Rule
    @ArchTest
    public static final ArchRule adapters_must_not_talk_to_each_other =
        noClasses()
            .that().resideInAPackage("..adapter.in..")
            .should().dependOnClassesThat().resideInAPackage("..adapter.out..")
            .because("Inbound adapters (REST/Web) can only communicate with the hexagon core via Ports.");
}
```

### Why ArchUnit is Critical for Enterprise Grade:
*   **Fail-Fast CI**: The build fails immediately during compile/test phases before any architectural drift is merged to `main`.
*   **Living Documentation**: The rules in the code act as self-documenting and automatically updating specifications of how the application boundaries are defined.
