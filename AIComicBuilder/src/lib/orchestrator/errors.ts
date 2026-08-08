export class OrchestratorError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "OrchestratorError";
  }
}

export function toErrorPayload(error: unknown): {
  status: number;
  body: Record<string, unknown>;
} {
  if (error instanceof OrchestratorError) {
    return {
      status: error.status,
      body: {
        error: error.message,
        code: error.code,
        ...(error.details && { details: error.details }),
      },
    };
  }

  console.error("[Orchestrator] Unexpected error", error);
  return {
    status: 500,
    body: {
      error: "Internal orchestrator error",
      code: "ORCHESTRATOR_INTERNAL_ERROR",
    },
  };
}

