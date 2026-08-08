import { OrchestratorError } from "./errors";
import {
  isOrchestratorAction,
  type CreateRunInput,
  type ListRunsInput,
  type ResumeAction,
} from "./types";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const PROFILE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const MAX_PAYLOAD_BYTES = 256 * 1024;
const SENSITIVE_KEY_PATTERN = /^(api[_-]?key|secret[_-]?key|authorization|access[_-]?token|refresh[_-]?token|token)$/i;

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OrchestratorError(`${label} must be a JSON object`, 400, "INVALID_REQUEST");
  }
  return value as Record<string, unknown>;
}

function requiredString(
  value: unknown,
  label: string,
  maxLength = 128,
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new OrchestratorError(`${label} is required`, 400, "INVALID_REQUEST");
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new OrchestratorError(`${label} is too long`, 400, "INVALID_REQUEST");
  }
  return normalized;
}

function optionalString(
  value: unknown,
  label: string,
  maxLength = 128,
): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredString(value, label, maxLength);
}

function optionalBoolean(
  value: unknown,
  label: string,
  fallback: boolean,
): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") {
    throw new OrchestratorError(`${label} must be a boolean`, 400, "INVALID_REQUEST");
  }
  return value;
}

function assertNoPersistedSecrets(payload: Record<string, unknown>) {
  const pending: unknown[] = [payload];
  while (pending.length > 0) {
    const value = pending.pop();
    if (!value || typeof value !== "object") continue;

    if (Array.isArray(value)) {
      pending.push(...value);
      continue;
    }

    for (const [key, child] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        throw new OrchestratorError(
          `payload must not contain credential field '${key}'; use providerProfileId`,
          400,
          "CREDENTIALS_NOT_ALLOWED",
        );
      }
      pending.push(child);
    }
  }
}

export function assertLocalRequest(request: Request) {
  let hostname: string;
  try {
    hostname = new URL(request.url).hostname.toLowerCase();
  } catch {
    throw new OrchestratorError("Invalid request URL", 400, "INVALID_REQUEST_URL");
  }

  if (!LOCAL_HOSTS.has(hostname) && !hostname.endsWith(".localhost")) {
    throw new OrchestratorError(
      "The orchestrator API is available from localhost only",
      403,
      "LOCALHOST_ONLY",
    );
  }
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new OrchestratorError(
      "Request body must be valid JSON",
      400,
      "INVALID_JSON",
    );
  }
}

export function parseCreateRunInput(value: unknown): CreateRunInput {
  const body = asObject(value, "request body");
  if ("modelConfig" in body) {
    throw new OrchestratorError(
      "modelConfig cannot be persisted; use providerProfileId",
      400,
      "CREDENTIALS_NOT_ALLOWED",
    );
  }

  const projectId = requiredString(body.projectId, "projectId");
  const episodeId = optionalString(body.episodeId, "episodeId");
  const actionValue = requiredString(body.action, "action", 64);
  if (!isOrchestratorAction(actionValue)) {
    throw new OrchestratorError(
      `Unsupported orchestrator action: ${actionValue}`,
      400,
      "UNSUPPORTED_ACTION",
    );
  }

  const payload = body.payload === undefined
    ? {}
    : asObject(body.payload, "payload");
  assertNoPersistedSecrets(payload);
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > MAX_PAYLOAD_BYTES) {
    throw new OrchestratorError(
      `payload exceeds ${MAX_PAYLOAD_BYTES} bytes`,
      413,
      "PAYLOAD_TOO_LARGE",
    );
  }

  const providerProfileId = optionalString(
    body.providerProfileId,
    "providerProfileId",
    64,
  );
  if (providerProfileId && !PROFILE_ID_PATTERN.test(providerProfileId)) {
    throw new OrchestratorError(
      "providerProfileId has an invalid format",
      400,
      "INVALID_PROVIDER_PROFILE_ID",
    );
  }

  const idempotencyKey = optionalString(
    body.idempotencyKey,
    "idempotencyKey",
    128,
  );
  if (idempotencyKey && !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    throw new OrchestratorError(
      "idempotencyKey has an invalid format",
      400,
      "INVALID_IDEMPOTENCY_KEY",
    );
  }

  const maxRetriesValue = body.maxRetries ?? 2;
  if (
    typeof maxRetriesValue !== "number" ||
    !Number.isInteger(maxRetriesValue) ||
    maxRetriesValue < 0 ||
    maxRetriesValue > 5
  ) {
    throw new OrchestratorError(
      "maxRetries must be an integer from 0 to 5",
      400,
      "INVALID_REQUEST",
    );
  }

  return {
    projectId,
    ...(episodeId && { episodeId }),
    action: actionValue,
    payload,
    ...(providerProfileId && { providerProfileId }),
    ...(idempotencyKey && { idempotencyKey }),
    requiresApproval: optionalBoolean(
      body.requiresApproval,
      "requiresApproval",
      true,
    ),
    dryRun: optionalBoolean(body.dryRun, "dryRun", true),
    maxRetries: maxRetriesValue,
  };
}

export function parseResumeAction(value: unknown): ResumeAction {
  const body = asObject(value, "request body");
  if (
    body.action !== "approve" &&
    body.action !== "execute" &&
    body.action !== "retry" &&
    body.action !== "cancel"
  ) {
    throw new OrchestratorError(
      "action must be approve, execute, retry, or cancel",
      400,
      "INVALID_RESUME_ACTION",
    );
  }
  return body.action;
}

export function parseListRunsInput(url: URL): ListRunsInput {
  const projectId = optionalString(
    url.searchParams.get("projectId"),
    "projectId",
  );
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit === null ? 25 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new OrchestratorError(
      "limit must be an integer from 1 to 100",
      400,
      "INVALID_LIMIT",
    );
  }
  return { ...(projectId && { projectId }), limit };
}
