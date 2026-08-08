interface ExecutableRun {
  projectId: string;
  episodeId: string | null;
  action: string;
  payload: Record<string, unknown>;
  providerProfileId: string | null;
  userId: string;
}

export interface GenerationOutcome {
  ok: boolean;
  httpStatus: number;
  contentType: string;
  body: unknown;
  truncated: boolean;
}

const DEFAULT_MAX_RESULT_BYTES = 4 * 1024 * 1024;

function getMaxResultBytes() {
  const parsed = Number.parseInt(
    process.env.ORCHESTRATOR_MAX_RESULT_BYTES || "",
    10,
  );
  if (!Number.isFinite(parsed) || parsed < 1024) return DEFAULT_MAX_RESULT_BYTES;
  return Math.min(parsed, 16 * 1024 * 1024);
}

async function consumeResponseBody(response: Response): Promise<{
  text: string;
  truncated: boolean;
}> {
  if (!response.body) return { text: "", truncated: false };

  const limit = getMaxResultBytes();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let storedBytes = 0;
  let truncated = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (storedBytes < limit) {
      const remaining = limit - storedBytes;
      const storedChunk = value.byteLength <= remaining
        ? value
        : value.subarray(0, remaining);
      chunks.push(decoder.decode(storedChunk, { stream: true }));
      storedBytes += storedChunk.byteLength;
    }
    if (storedBytes >= limit && value.byteLength > 0) truncated = true;
  }
  chunks.push(decoder.decode());
  return { text: chunks.join(""), truncated };
}

/**
 * Calls the existing project generation route in-process so all current
 * generation, streaming and persistence behavior stays in one place.
 */
export async function invokeProjectGeneration(
  run: ExecutableRun,
): Promise<GenerationOutcome> {
  const { POST: generateProject } = await import(
    "@/app/api/projects/[id]/generate/route"
  );
  const request = new Request(
    `http://localhost/api/projects/${encodeURIComponent(run.projectId)}/generate`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": run.userId,
      },
      body: JSON.stringify({
        action: run.action,
        payload: run.payload,
        ...(run.providerProfileId && {
          providerProfileId: run.providerProfileId,
        }),
        ...(run.episodeId && { episodeId: run.episodeId }),
      }),
    },
  );

  const response = await generateProject(request, {
    params: Promise.resolve({ id: run.projectId }),
  });
  const contentType = response.headers.get("content-type") || "text/plain";
  const consumed = await consumeResponseBody(response);
  let body: unknown = consumed.text;
  if (!consumed.truncated && contentType.includes("application/json")) {
    try {
      body = consumed.text ? JSON.parse(consumed.text) : null;
    } catch {
      body = consumed.text;
    }
  }

  return {
    ok: response.ok,
    httpStatus: response.status,
    contentType,
    body,
    truncated: consumed.truncated,
  };
}

