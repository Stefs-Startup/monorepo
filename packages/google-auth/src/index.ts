export const GOOGLE_TASKS_SCOPE = "https://www.googleapis.com/auth/tasks";
export const GOOGLE_TASKS_DEFAULT_BASE_URL = "https://tasks.googleapis.com";

export interface GoogleAuthSession {
  readonly email: string;
  readonly accessToken: string;
  readonly expiresAtEpochMs?: number;
  readonly scopes: readonly string[];
}

export interface AuthDiagnosticResult {
  readonly statusCode: number | null;
  readonly statusName:
    | "DEVELOPER_ERROR"
    | "SIGN_IN_FAILED"
    | "SIGN_IN_CANCELED"
    | "NETWORK_ERROR"
    | "UNCLASSIFIED_AUTH_ERROR";
  readonly userFacingTitle: string;
  readonly userFacingExplanation: string;
  readonly remediationStep: string;
  readonly telemetryAttributes: Readonly<Record<string, string>>;
}

export interface GoogleTaskListDto {
  readonly id: string;
  readonly title: string;
}

export interface GoogleTaskListsResponse {
  readonly items?: readonly GoogleTaskListDto[];
}

export interface GoogleTaskDto {
  readonly id?: string;
  readonly title: string;
  readonly notes?: string | null;
  readonly status: "needsAction" | "completed";
  readonly due?: string | null;
  readonly completed?: string | null;
  readonly updated?: string | null;
}

export interface GoogleTasksResponse {
  readonly items?: readonly GoogleTaskDto[];
}

export interface GoogleTaskUpsertInput {
  readonly taskListId?: string;
  readonly googleTaskId?: string | null;
  readonly title: string;
  readonly notes?: string;
  readonly isCompleted?: boolean;
  readonly dueEpochMillis?: number | null;
}

export interface GoogleTasksProvider {
  fetchTaskLists(accessToken: string): Promise<GoogleTaskListDto[]>;
  fetchTasksForList(accessToken: string, taskListId?: string): Promise<GoogleTaskDto[]>;
  createOrUpdateTask(accessToken: string, input: GoogleTaskUpsertInput): Promise<GoogleTaskDto>;
}

export function formatTasksScope(): string {
  return `oauth2:${GOOGLE_TASKS_SCOPE}`;
}

export function validateGoogleEmail(email: string): boolean {
  const trimmed = email.trim();
  if (trimmed.length === 0 || !trimmed.includes("@") || !trimmed.includes(".")) {
    return false;
  }
  const parts = trimmed.split("@");
  return parts.length === 2 && (parts[0]?.length ?? 0) > 0 && (parts[1]?.length ?? 0) >= 3;
}

export function isAuthorizedSession(email: string, token: string): boolean {
  return validateGoogleEmail(email) && token.trim().length > 0;
}

export function isSessionValid(
  session: GoogleAuthSession | null | undefined,
  nowEpochMs: number = Date.now(),
): boolean {
  if (!session) return false;
  if (!isAuthorizedSession(session.email, session.accessToken)) return false;
  if (
    typeof session.expiresAtEpochMs === "number" &&
    session.expiresAtEpochMs <= nowEpochMs
  ) {
    return false;
  }
  return session.scopes.includes(GOOGLE_TASKS_SCOPE);
}

export function maskToken(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length <= 8) return "****";
  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return `${prefix}...${suffix}`;
}

export function scrubAuthSensitiveText(rawText: string): string {
  return rawText
    .replace(/ya29\.[A-Za-z0-9_-]+/g, "[REDACTED_TOKEN]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED_TOKEN]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[REDACTED_EMAIL]");
}

export function parseRfc3339ToEpoch(rfcString?: string | null): number | null {
  if (!rfcString || rfcString.trim().length === 0) return null;
  const parsed = Date.parse(rfcString);
  return Number.isNaN(parsed) ? null : parsed;
}

export function formatEpochToRfc3339(epochMillis: number): string {
  return new Date(epochMillis).toISOString().replace(".000Z", "Z");
}

export function extractAuthStatusCode(message?: string | null): number | null {
  if (!message || message.trim().length === 0) return null;
  const trimmed = message.trim();
  const leadingMatch = /^(\d+):/.exec(trimmed);
  if (leadingMatch?.[1]) {
    const parsed = Number.parseInt(leadingMatch[1], 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  const codeMatch = /\b(10|12500|12501|16|7)\b/.exec(message);
  if (codeMatch?.[1]) {
    const parsed = Number.parseInt(codeMatch[1], 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export function classifyGoogleSignInFailure(
  error: unknown,
  options?: { readonly appPackageName?: string },
): AuthDiagnosticResult {
  const pkg = options?.appPackageName ?? "com.pulse.accountability";
  const errObj =
    typeof error === "object" && error !== null
      ? (error as { statusCode?: unknown; message?: unknown; name?: unknown })
      : {};
  const explicitCode =
    typeof errObj.statusCode === "number" ? errObj.statusCode : null;
  const rawMessage =
    typeof errObj.message === "string"
      ? errObj.message
      : typeof error === "string"
        ? error
        : "Unknown error";
  const exceptionType =
    typeof errObj.name === "string" && errObj.name.length > 0
      ? errObj.name
      : "Error";
  const code = explicitCode ?? extractAuthStatusCode(rawMessage);

  if (code === 10) {
    return {
      statusCode: 10,
      statusName: "DEVELOPER_ERROR",
      userFacingTitle: "OAuth Client Configuration Mismatch (Code 10)",
      userFacingExplanation: `Google Play Services rejected the sign-in request because the OAuth 2.0 Client ID (package ${pkg} + SHA-1) or OAuth Consent Screen is not yet registered in Google Cloud Console.`,
      remediationStep: `Register an OAuth 2.0 Client ID in Google Cloud Console (APIs & Services > Credentials) for ${pkg} with debug SHA-1 B5:C2:92:ED:7B:F6:BC:30:C1:0F:F3:69:28:75:96:3B:17:B0:BF:E9.`,
      telemetryAttributes: {
        auth_error_code: "10",
        auth_error_name: "DEVELOPER_ERROR",
        exception_type: exceptionType,
      },
    };
  }

  if (code === 12500) {
    return {
      statusCode: 12500,
      statusName: "SIGN_IN_FAILED",
      userFacingTitle: "OAuth Consent Screen Incomplete (Code 12500)",
      userFacingExplanation:
        "Google Play Services could not complete the sign-in handshake because the OAuth Consent Screen in Google Cloud Console is missing a support email, test user, or the Tasks scope.",
      remediationStep: `In Google Cloud Console > OAuth consent screen, add your Google account as a Test User and ensure ${GOOGLE_TASKS_SCOPE} is listed.`,
      telemetryAttributes: {
        auth_error_code: "12500",
        auth_error_name: "SIGN_IN_FAILED",
        exception_type: exceptionType,
      },
    };
  }

  if (code === 12501 || code === 16) {
    return {
      statusCode: code,
      statusName: "SIGN_IN_CANCELED",
      userFacingTitle: `Sign-In Sheet Closed (Code ${code})`,
      userFacingExplanation:
        "The Google account picker was dismissed or canceled before completing sign-in (or Play Services aborted due to missing OAuth client registration).",
      remediationStep:
        "Tap 'Sign In with Google' again, or verify that the OAuth Client ID is active in Google Cloud Console.",
      telemetryAttributes: {
        auth_error_code: String(code),
        auth_error_name: "SIGN_IN_CANCELED",
        exception_type: exceptionType,
      },
    };
  }

  if (code === 7) {
    return {
      statusCode: 7,
      statusName: "NETWORK_ERROR",
      userFacingTitle: "Network Connection Error (Code 7)",
      userFacingExplanation:
        "Google authentication servers could not be reached.",
      remediationStep: "Check Wi-Fi or cellular connectivity and retry.",
      telemetryAttributes: {
        auth_error_code: "7",
        auth_error_name: "NETWORK_ERROR",
        exception_type: exceptionType,
      },
    };
  }

  const safeMsg = scrubAuthSensitiveText(rawMessage);
  return {
    statusCode: code,
    statusName: "UNCLASSIFIED_AUTH_ERROR",
    userFacingTitle: `Google Sign-In Error${code !== null ? ` (Code ${code})` : ""}`,
    userFacingExplanation: `Sign-in did not complete: ${safeMsg}`,
    remediationStep:
      "Verify OAuth Client ID and Tasks API scope in Google Cloud Console.",
    telemetryAttributes: {
      auth_error_code: code !== null ? String(code) : "none",
      auth_error_name: "UNCLASSIFIED_AUTH_ERROR",
      exception_type: exceptionType,
    },
  };
}

export interface HttpFetchLikeResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  text(): Promise<string>;
}

export type HttpFetchLike = (
  url: string,
  init: {
    readonly method: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly body?: string;
  },
) => Promise<HttpFetchLikeResponse>;

export class HttpGoogleTasksClient implements GoogleTasksProvider {
  private readonly baseUrl: string;
  private readonly fetchFn: HttpFetchLike;

  constructor(options?: {
    readonly baseUrl?: string;
    readonly fetchFn?: HttpFetchLike;
  }) {
    this.baseUrl = (options?.baseUrl ?? GOOGLE_TASKS_DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetchFn = options?.fetchFn ?? (globalThis.fetch as unknown as HttpFetchLike);
  }

  async fetchTaskLists(accessToken: string): Promise<GoogleTaskListDto[]> {
    const response = await this.fetchFn(
      `${this.baseUrl}/tasks/v1/users/@me/lists?maxResults=20`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Google Tasks API HTTP ${response.status}: ${response.statusText}`);
    }
    const bodyText = await response.text();
    const parsed = (bodyText ? JSON.parse(bodyText) : {}) as GoogleTaskListsResponse;
    return parsed.items ? [...parsed.items] : [];
  }

  async fetchTasksForList(
    accessToken: string,
    taskListId: string = "@default",
  ): Promise<GoogleTaskDto[]> {
    const response = await this.fetchFn(
      `${this.baseUrl}/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks?showCompleted=true&showHidden=true&maxResults=100`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Google Tasks API HTTP ${response.status}: ${response.statusText}`);
    }
    const bodyText = await response.text();
    const parsed = (bodyText ? JSON.parse(bodyText) : {}) as GoogleTasksResponse;
    return parsed.items ? [...parsed.items] : [];
  }

  async createOrUpdateTask(
    accessToken: string,
    input: GoogleTaskUpsertInput,
  ): Promise<GoogleTaskDto> {
    const taskListId = input.taskListId ?? "@default";
    const dueRfc3339 =
      typeof input.dueEpochMillis === "number"
        ? formatEpochToRfc3339(input.dueEpochMillis)
        : null;
    const payload = {
      title: input.title,
      notes: input.notes && input.notes.trim().length > 0 ? input.notes : null,
      status: input.isCompleted ? "completed" : "needsAction",
      due: dueRfc3339,
    };
    const isUpdate =
      typeof input.googleTaskId === "string" && input.googleTaskId.trim().length > 0;
    const url = isUpdate
      ? `${this.baseUrl}/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(input.googleTaskId!)}`
      : `${this.baseUrl}/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks`;
    const response = await this.fetchFn(url, {
      method: isUpdate ? "PATCH" : "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Google Tasks Sync failed (${response.status})`);
    }
    const bodyText = await response.text();
    return JSON.parse(bodyText) as GoogleTaskDto;
  }
}

export class FakeGoogleOAuthProvider {
  private session: GoogleAuthSession | null = null;
  private readonly nowEpochMs: number;

  constructor(options?: { readonly nowEpochMs?: number }) {
    this.nowEpochMs = options?.nowEpochMs ?? 1_762_992_000_000;
  }

  signIn(email: string = "alex.rivera@example.com"): GoogleAuthSession {
    if (!validateGoogleEmail(email)) {
      throw new Error("10: Invalid Google account email");
    }
    const slug = email.split("@")[0]?.replace(/[^A-Za-z0-9]/g, "_") ?? "user";
    this.session = {
      email,
      accessToken: `ya29.fake_deterministic_token_${slug}`,
      expiresAtEpochMs: this.nowEpochMs + 3_600_000,
      scopes: [GOOGLE_TASKS_SCOPE],
    };
    return this.session;
  }

  getCurrentSession(): GoogleAuthSession | null {
    return this.session;
  }

  revoke(): void {
    this.session = null;
  }
}

export class FakeGoogleTasksProvider implements GoogleTasksProvider {
  private readonly nowEpochMs: number;
  private readonly taskLists: GoogleTaskListDto[];
  private readonly tasksByList: Map<string, GoogleTaskDto[]>;

  constructor(options?: { readonly nowEpochMs?: number }) {
    this.nowEpochMs = options?.nowEpochMs ?? 1_762_992_000_000;
    this.taskLists = [
      { id: "@default", title: "My Tasks" },
      { id: "work-list", title: "Work Priorities" },
    ];
    const nowIso = formatEpochToRfc3339(this.nowEpochMs);
    this.tasksByList = new Map<string, GoogleTaskDto[]>([
      [
        "@default",
        [
          {
            id: "gtask-1",
            title: "Ship Q4 architecture review",
            notes: "Include zero-PII observability checklist",
            status: "needsAction",
            due: formatEpochToRfc3339(this.nowEpochMs + 86_400_000),
            updated: nowIso,
          },
          {
            id: "gtask-2",
            title: "Consolidate Q3 expense receipts",
            notes: "Export CSV for finance",
            status: "needsAction",
            due: formatEpochToRfc3339(this.nowEpochMs - 172_800_000),
            updated: nowIso,
          },
        ],
      ],
      ["work-list", []],
    ]);
  }

  private assertValidToken(accessToken: string): void {
    const trimmed = accessToken.trim();
    if (trimmed.length === 0 || trimmed === "expired-token") {
      throw new Error("Google Tasks API HTTP 401: Unauthorized");
    }
    if (trimmed === "scope-insufficient-token") {
      throw new Error("Google Tasks API HTTP 403: ACCESS_TOKEN_SCOPE_INSUFFICIENT");
    }
  }

  async fetchTaskLists(accessToken: string): Promise<GoogleTaskListDto[]> {
    this.assertValidToken(accessToken);
    return this.taskLists.map((item) => ({ ...item }));
  }

  async fetchTasksForList(
    accessToken: string,
    taskListId: string = "@default",
  ): Promise<GoogleTaskDto[]> {
    this.assertValidToken(accessToken);
    const items = this.tasksByList.get(taskListId) ?? [];
    return items.map((item) => ({ ...item }));
  }

  async createOrUpdateTask(
    accessToken: string,
    input: GoogleTaskUpsertInput,
  ): Promise<GoogleTaskDto> {
    this.assertValidToken(accessToken);
    const taskListId = input.taskListId ?? "@default";
    const list = this.tasksByList.get(taskListId) ?? [];
    const nowIso = formatEpochToRfc3339(this.nowEpochMs);
    const dueRfc3339 =
      typeof input.dueEpochMillis === "number"
        ? formatEpochToRfc3339(input.dueEpochMillis)
        : null;
    const status = input.isCompleted ? "completed" : "needsAction";

    if (input.googleTaskId && input.googleTaskId.trim().length > 0) {
      const idx = list.findIndex((t) => t.id === input.googleTaskId);
      const updated: GoogleTaskDto = {
        id: input.googleTaskId,
        title: input.title,
        notes: input.notes && input.notes.trim().length > 0 ? input.notes : null,
        status,
        due: dueRfc3339,
        completed: input.isCompleted ? nowIso : null,
        updated: nowIso,
      };
      if (idx >= 0) {
        list[idx] = updated;
      } else {
        list.push(updated);
      }
      this.tasksByList.set(taskListId, list);
      return { ...updated };
    }

    const created: GoogleTaskDto = {
      id: `gtask-${list.length + 1}`,
      title: input.title,
      notes: input.notes && input.notes.trim().length > 0 ? input.notes : null,
      status,
      due: dueRfc3339,
      completed: input.isCompleted ? nowIso : null,
      updated: nowIso,
    };
    list.push(created);
    this.tasksByList.set(taskListId, list);
    return { ...created };
  }
}
