import { createHash } from "node:crypto";
import {
  and,
  desc,
  eq,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm";
import { db } from "@/lib/db";
import { episodes, orchestratorRuns, projects } from "@/lib/db/schema";
import { id as genId } from "@/lib/id";
import { OrchestratorError } from "./errors";
import { invokeProjectGeneration, type GenerationOutcome } from "./executor";
import {
  ORCHESTRATOR_ACTION_SPECS,
  type CreateRunInput,
  type ListRunsInput,
  type ResumeAction,
} from "./types";

export type OrchestratorRun = typeof orchestratorRuns.$inferSelect;

const DEFAULT_MAX_CONCURRENCY = 3;

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(input: CreateRunInput): string {
  return createHash("sha256")
    .update(
      stableStringify({
        projectId: input.projectId,
        episodeId: input.episodeId ?? null,
        action: input.action,
        payload: input.payload,
        providerProfileId: input.providerProfileId ?? null,
        requiresApproval: input.requiresApproval,
        dryRun: input.dryRun,
        maxRetries: input.maxRetries,
      }),
    )
    .digest("hex");
}

export function getMaxConcurrency(): number {
  const parsed = Number.parseInt(
    process.env.ORCHESTRATOR_MAX_CONCURRENCY || "",
    10,
  );
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_MAX_CONCURRENCY;
  return Math.min(parsed, 10);
}

/**
 * In-process generation cannot survive an application restart. Mark orphaned
 * runs as failed so they release concurrency slots and can use normal retry.
 */
export async function recoverInterruptedRuns(): Promise<number> {
  const now = new Date();
  const recovered = await db
    .update(orchestratorRuns)
    .set({
      status: "failed",
      error: "Generation was interrupted by an application restart; review persisted output before retrying",
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(orchestratorRuns.status, "running"))
    .returning({ id: orchestratorRuns.id });
  return recovered.length;
}

async function verifyTarget(userId: string, input: CreateRunInput) {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, input.projectId), eq(projects.userId, userId)))
    .limit(1);
  if (!project) {
    throw new OrchestratorError("Project not found", 404, "PROJECT_NOT_FOUND");
  }

  if (input.episodeId) {
    const [episode] = await db
      .select({ id: episodes.id })
      .from(episodes)
      .where(
        and(
          eq(episodes.id, input.episodeId),
          eq(episodes.projectId, input.projectId),
        ),
      )
      .limit(1);
    if (!episode) {
      throw new OrchestratorError("Episode not found", 404, "EPISODE_NOT_FOUND");
    }
  }
}

async function findIdempotentRun(userId: string, idempotencyKey: string) {
  const [run] = await db
    .select()
    .from(orchestratorRuns)
    .where(
      and(
        eq(orchestratorRuns.userId, userId),
        eq(orchestratorRuns.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);
  return run;
}

function ensureMatchingFingerprint(run: OrchestratorRun, expected: string) {
  if (run.requestFingerprint !== expected) {
    throw new OrchestratorError(
      "idempotencyKey was already used for a different request",
      409,
      "IDEMPOTENCY_CONFLICT",
      { runId: run.id },
    );
  }
}

function buildDryRunPlan(input: CreateRunInput): Record<string, unknown> {
  const spec = ORCHESTRATOR_ACTION_SPECS[input.action];
  return {
    type: "dry-run",
    target: {
      projectId: input.projectId,
      episodeId: input.episodeId ?? null,
    },
    invocation: {
      method: "POST",
      endpoint: `/api/projects/${input.projectId}/generate`,
      action: input.action,
      providerProfileId: input.providerProfileId ?? null,
    },
    effects: {
      resourceClass: spec.resourceClass,
      mutatesProject: spec.mutatesProject,
      modelCallsAllowed: false,
    },
    controls: {
      requiresApproval: input.requiresApproval,
      maxRetries: input.maxRetries,
      maxGlobalConcurrency: getMaxConcurrency(),
    },
  };
}

export async function createRun(
  userId: string,
  input: CreateRunInput,
): Promise<{ run: OrchestratorRun; idempotentReplay: boolean }> {
  await verifyTarget(userId, input);
  const requestFingerprint = fingerprint(input);

  if (input.idempotencyKey) {
    const existing = await findIdempotentRun(userId, input.idempotencyKey);
    if (existing) {
      ensureMatchingFingerprint(existing, requestFingerprint);
      return { run: existing, idempotentReplay: true };
    }
  }

  const now = new Date();
  const status = input.dryRun
    ? "planned"
    : input.requiresApproval
      ? "awaiting_approval"
      : "ready";
  const [inserted] = await db
    .insert(orchestratorRuns)
    .values({
      id: genId(),
      userId,
      projectId: input.projectId,
      episodeId: input.episodeId ?? null,
      action: input.action,
      payload: input.payload,
      providerProfileId: input.providerProfileId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      requestFingerprint,
      status,
      requiresApproval: input.requiresApproval,
      dryRun: input.dryRun,
      maxRetries: input.maxRetries,
      result: input.dryRun ? buildDryRunPlan(input) : null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning();

  if (inserted) return { run: inserted, idempotentReplay: false };
  if (input.idempotencyKey) {
    const existing = await findIdempotentRun(userId, input.idempotencyKey);
    if (existing) {
      ensureMatchingFingerprint(existing, requestFingerprint);
      return { run: existing, idempotentReplay: true };
    }
  }
  throw new OrchestratorError(
    "Could not create orchestrator run",
    409,
    "RUN_CREATE_CONFLICT",
  );
}

export async function getRun(
  userId: string,
  runId: string,
): Promise<OrchestratorRun> {
  const [run] = await db
    .select()
    .from(orchestratorRuns)
    .where(
      and(eq(orchestratorRuns.id, runId), eq(orchestratorRuns.userId, userId)),
    )
    .limit(1);
  if (!run) {
    throw new OrchestratorError("Run not found", 404, "RUN_NOT_FOUND");
  }
  return run;
}

export async function listRuns(
  userId: string,
  input: ListRunsInput,
): Promise<OrchestratorRun[]> {
  const predicate = input.projectId
    ? and(
        eq(orchestratorRuns.userId, userId),
        eq(orchestratorRuns.projectId, input.projectId),
      )
    : eq(orchestratorRuns.userId, userId);
  return db
    .select()
    .from(orchestratorRuns)
    .where(predicate)
    .orderBy(desc(orchestratorRuns.createdAt))
    .limit(input.limit);
}

async function approveRun(userId: string, runId: string) {
  const current = await getRun(userId, runId);
  if (current.dryRun) {
    throw new OrchestratorError(
      "Dry-run plans cannot be approved for execution",
      409,
      "DRY_RUN_ONLY",
    );
  }
  if (current.approvedAt) return current;
  if (current.status !== "awaiting_approval") {
    throw new OrchestratorError(
      `Run cannot be approved from status '${current.status}'`,
      409,
      "INVALID_RUN_STATE",
    );
  }

  const now = new Date();
  const [updated] = await db
    .update(orchestratorRuns)
    .set({ status: "ready", approvedAt: now, updatedAt: now })
    .where(
      and(
        eq(orchestratorRuns.id, runId),
        eq(orchestratorRuns.userId, userId),
        eq(orchestratorRuns.status, "awaiting_approval"),
      ),
    )
    .returning();
  return updated ?? getRun(userId, runId);
}

async function cancelRun(userId: string, runId: string) {
  const current = await getRun(userId, runId);
  if (current.status === "cancelled" || current.status === "completed") {
    return current;
  }

  const now = new Date();
  if (current.status === "running") {
    const [updated] = await db
      .update(orchestratorRuns)
      .set({ cancelRequestedAt: now, updatedAt: now })
      .where(
        and(
          eq(orchestratorRuns.id, runId),
          eq(orchestratorRuns.userId, userId),
          eq(orchestratorRuns.status, "running"),
          isNull(orchestratorRuns.cancelRequestedAt),
        ),
      )
      .returning();
    return updated ?? getRun(userId, runId);
  }

  const [updated] = await db
    .update(orchestratorRuns)
    .set({
      status: "cancelled",
      cancelRequestedAt: now,
      completedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(orchestratorRuns.id, runId),
        eq(orchestratorRuns.userId, userId),
      ),
    )
    .returning();
  return updated ?? getRun(userId, runId);
}

async function countRunningRuns() {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orchestratorRuns)
    .where(eq(orchestratorRuns.status, "running"));
  return Number(row?.count ?? 0);
}

async function claimRun(
  userId: string,
  runId: string,
  expectedStatus: "ready" | "failed",
): Promise<OrchestratorRun> {
  const current = await getRun(userId, runId);
  if (current.dryRun) {
    throw new OrchestratorError(
      "Dry-run plans cannot execute",
      409,
      "DRY_RUN_ONLY",
    );
  }
  if (current.status === "completed") return current;
  if (current.status !== expectedStatus) {
    throw new OrchestratorError(
      `Run cannot ${expectedStatus === "failed" ? "retry" : "execute"} from status '${current.status}'`,
      409,
      "INVALID_RUN_STATE",
    );
  }
  if (expectedStatus === "failed" && current.attemptCount > current.maxRetries) {
    throw new OrchestratorError(
      "Run retry limit has been reached",
      409,
      "RETRY_LIMIT_REACHED",
      { attemptCount: current.attemptCount, maxRetries: current.maxRetries },
    );
  }

  const maxConcurrency = getMaxConcurrency();
  const now = new Date();
  const retryGuard = expectedStatus === "failed"
    ? sql`${orchestratorRuns.attemptCount} <= ${orchestratorRuns.maxRetries}`
    : sql`1 = 1`;
  const [claimed] = await db
    .update(orchestratorRuns)
    .set({
      status: "running",
      attemptCount: sql`${orchestratorRuns.attemptCount} + 1`,
      startedAt: now,
      completedAt: null,
      cancelRequestedAt: null,
      result: null,
      error: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(orchestratorRuns.id, runId),
        eq(orchestratorRuns.userId, userId),
        eq(orchestratorRuns.status, expectedStatus),
        retryGuard,
        sql`(
          SELECT count(*)
          FROM orchestrator_runs AS active_runs
          WHERE active_runs.status = 'running'
        ) < ${maxConcurrency}`,
      ),
    )
    .returning();

  if (claimed) return claimed;
  const refreshed = await getRun(userId, runId);
  if (refreshed.status !== expectedStatus) {
    throw new OrchestratorError(
      `Run is already in status '${refreshed.status}'`,
      409,
      "INVALID_RUN_STATE",
    );
  }
  const running = await countRunningRuns();
  throw new OrchestratorError(
    "Orchestrator concurrency limit reached",
    429,
    "CONCURRENCY_LIMIT",
    { running, limit: maxConcurrency },
  );
}

function sanitizeError(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [redacted]")
    .replace(/(api[_-]?key|secret[_-]?key|token)\s*[:=]\s*[^\s,}]+/gi, "$1=[redacted]")
    .slice(0, 4000);
}

function outcomeResult(outcome: GenerationOutcome): Record<string, unknown> {
  return {
    httpStatus: outcome.httpStatus,
    contentType: outcome.contentType,
    body: outcome.body,
    truncated: outcome.truncated,
  };
}

function outcomeError(outcome: GenerationOutcome): string {
  if (outcome.body && typeof outcome.body === "object" && !Array.isArray(outcome.body)) {
    const error = (outcome.body as Record<string, unknown>).error;
    if (typeof error === "string") return sanitizeError(error);
  }
  if (typeof outcome.body === "string" && outcome.body.trim()) {
    return sanitizeError(outcome.body);
  }
  return `Generation request failed with HTTP ${outcome.httpStatus}`;
}

async function finalizeRun(
  run: OrchestratorRun,
  result: Record<string, unknown>,
  error: string | null,
) {
  const now = new Date();
  const terminalStatus = error ? "failed" : "completed";
  const [finished] = await db
    .update(orchestratorRuns)
    .set({
      status: terminalStatus,
      result,
      error,
      completedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(orchestratorRuns.id, run.id),
        eq(orchestratorRuns.userId, run.userId),
        eq(orchestratorRuns.status, "running"),
        isNull(orchestratorRuns.cancelRequestedAt),
      ),
    )
    .returning();
  if (finished) return finished;

  const [cancelled] = await db
    .update(orchestratorRuns)
    .set({
      status: "cancelled",
      result,
      error: "Cancellation was requested; the underlying operation may have completed",
      completedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(orchestratorRuns.id, run.id),
        eq(orchestratorRuns.userId, run.userId),
        eq(orchestratorRuns.status, "running"),
        isNotNull(orchestratorRuns.cancelRequestedAt),
      ),
    )
    .returning();
  return cancelled ?? getRun(run.userId, run.id);
}

async function executeClaimedRun(run: OrchestratorRun) {
  try {
    const outcome = await invokeProjectGeneration(run);
    return finalizeRun(
      run,
      outcomeResult(outcome),
      outcome.ok ? null : outcomeError(outcome),
    );
  } catch (error) {
    const message = sanitizeError(
      error instanceof Error ? error.message : String(error),
    );
    return finalizeRun(
      run,
      { transportError: true, message },
      message,
    );
  }
}

async function executeRun(userId: string, runId: string, retry: boolean) {
  const claimed = await claimRun(userId, runId, retry ? "failed" : "ready");
  if (claimed.status === "completed") return claimed;
  return executeClaimedRun(claimed);
}

export async function resumeRun(
  userId: string,
  runId: string,
  action: ResumeAction,
): Promise<OrchestratorRun> {
  if (action === "approve") return approveRun(userId, runId);
  if (action === "cancel") return cancelRun(userId, runId);
  return executeRun(userId, runId, action === "retry");
}
