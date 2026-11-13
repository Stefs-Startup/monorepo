/**
 * Curated + heuristic coordinate-to-package mappings for Java (Gradle/Maven) and TypeScript/Angular (npm/pnpm).
 */

const CURATED_JAVA_PACKAGES: ReadonlyArray<{
  match: (group: string, artifact: string) => boolean;
  packages: string[];
}> = [
  {
    match: (g, a) =>
      g === "org.springframework.boot" &&
      (a === "spring-boot-starter-webmvc" ||
        a === "spring-boot-starter-web" ||
        a === "spring-boot-starter-webflux"),
    packages: [
      "org.springframework.web",
      "org.springframework.http",
      "org.springframework.boot",
      "org.springframework.context",
      "org.springframework.stereotype",
    ],
  },
  {
    match: (g, a) =>
      g === "org.springframework.boot" && a === "spring-boot-starter-validation",
    packages: ["jakarta.validation", "org.springframework.validation"],
  },
  {
    match: (g, a) =>
      g === "org.springframework.boot" && a === "spring-boot-starter-actuator",
    packages: ["org.springframework.boot.actuate", "io.micrometer"],
  },
  {
    match: (g, a) =>
      (g === "org.springframework.boot" && a === "spring-boot-starter-security") ||
      g === "org.springframework.security",
    packages: [
      "org.springframework.security",
      "org.springframework.context.annotation",
    ],
  },
  {
    match: (g, a) =>
      (g === "org.springframework.boot" &&
        (a === "spring-boot-starter-data-jpa" || a === "spring-boot-starter-jdbc")) ||
      g === "org.springframework.data" ||
      (g === "org.springframework" && a === "spring-tx"),
    packages: [
      "org.springframework.transaction",
      "org.springframework.data",
      "jakarta.persistence",
      "org.springframework.jdbc",
    ],
  },
  {
    match: (g, a) =>
      g === "org.springframework.boot" &&
      (a === "spring-boot" ||
        a === "spring-boot-autoconfigure" ||
        a === "spring-boot-gradle-plugin" ||
        a === "spring-boot-starter-parent" ||
        a === "spring-boot-dependencies" ||
        a === "spring-boot-starter-test" ||
        a === "spring-boot-starter-webmvc-test"),
    packages: [
      "org.springframework.boot",
      "org.springframework.web",
      "org.springframework.http",
      "org.springframework.context",
      "org.springframework.stereotype",
      "org.springframework.transaction",
      "org.springframework.security",
      "jakarta.validation",
    ],
  },
  {
    match: (g, a) =>
      g === "org.springframework" &&
      (a === "spring-webmvc" || a === "spring-web" || a === "spring-webflux"),
    packages: ["org.springframework.web", "org.springframework.http"],
  },
  {
    match: (g, a) =>
      g === "org.springframework" &&
      (a === "spring-context" || a === "spring-beans" || a === "spring-core"),
    packages: [
      "org.springframework.context",
      "org.springframework.stereotype",
      "org.springframework.beans",
    ],
  },
  {
    match: (g, a) =>
      g.startsWith("com.fasterxml.jackson") ||
      g.startsWith("tools.jackson") ||
      a.includes("jackson"),
    packages: ["com.fasterxml.jackson", "tools.jackson"],
  },
  {
    match: (g) => g === "jakarta.validation" || g === "org.hibernate.validator",
    packages: ["jakarta.validation", "org.hibernate.validator"],
  },
  {
    match: (g) => g === "org.slf4j" || g === "ch.qos.logback",
    packages: ["org.slf4j", "ch.qos.logback"],
  },
  {
    match: (g) => g === "com.tngtech.archunit",
    packages: ["com.tngtech.archunit"],
  },
  {
    match: (g) => g === "com.squareup.okhttp3",
    packages: ["okhttp3", "com.squareup.okhttp3"],
  },
  {
    match: (g) => g === "io.micrometer",
    packages: ["io.micrometer"],
  },
  {
    match: (g) => g === "org.junit.jupiter" || g === "org.junit.platform",
    packages: ["org.junit"],
  },
];

/**
 * Infers Java package prefixes from Maven/Gradle group:artifact coordinates.
 */
export function inferJavaPackages(coord: string): string[] {
  const parts = coord.split(":");
  const group = (parts[0] ?? "").trim();
  const artifact = (parts[1] ?? "").trim();
  if (!group) return [];

  const result = new Set<string>();

  for (const rule of CURATED_JAVA_PACKAGES) {
    if (rule.match(group, artifact)) {
      for (const pkg of rule.packages) {
        result.add(pkg);
      }
    }
  }

  // Handle spring-boot-starter-<feature> dynamically
  if (
    group === "org.springframework.boot" &&
    artifact.startsWith("spring-boot-starter-")
  ) {
    const feature = artifact.replace("spring-boot-starter-", "").replace(/-test$/, "");
    result.add("org.springframework.boot");
    if (feature && feature !== "web" && feature !== "webmvc") {
      result.add(`org.springframework.${feature.replace(/-/g, ".")}`);
    }
  }

  // Heuristic fallback using group (if >= 2 segments and not already covered more specifically)
  const segments = group.split(".").filter(Boolean);
  if (segments.length >= 2) {
    if (group === "org.springframework.boot" && result.size === 0) {
      result.add("org.springframework.boot");
    } else if (group !== "org.springframework.boot" && group !== "org.springframework") {
      result.add(group);
    } else if (result.size === 0) {
      result.add(group);
    }
  }

  return Array.from(result).sort();
}

export function isJacksonCoordinate(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes("jackson") ||
    lower.startsWith("com.fasterxml.jackson") ||
    lower.startsWith("tools.jackson")
  );
}

export function isSpringWebOrBootCoordinate(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.startsWith("org.springframework.boot:") ||
    lower.startsWith("org.springframework:spring-web") ||
    lower.startsWith("org.springframework:spring-context")
  );
}

/**
 * Infers npm / pnpm module specifiers from a package name.
 */
export function inferNpmPackages(packageName: string): string[] {
  const clean = packageName.trim();
  if (!clean) return [];
  const packages = new Set<string>([clean]);

  if (clean === "@angular/common") {
    packages.add("@angular/common/http");
  } else if (clean === "@angular/core") {
    packages.add("@angular/core/rxjs-interop");
  } else if (clean === "rxjs") {
    packages.add("rxjs/operators");
    packages.add("@angular/core/rxjs-interop");
  }

  return Array.from(packages).sort();
}

/**
 * Checks whether a Java import FQN matches a mapped package prefix.
 */
export function javaImportMatchesPackage(
  importFqn: string,
  pkgPrefix: string,
): boolean {
  return (
    importFqn === pkgPrefix ||
    importFqn.startsWith(`${pkgPrefix}.`)
  );
}

/**
 * Checks whether a TypeScript module specifier matches an npm package name.
 */
export function tsImportMatchesPackage(
  specifier: string,
  pkgName: string,
): boolean {
  return specifier === pkgName || specifier.startsWith(`${pkgName}/`);
}
