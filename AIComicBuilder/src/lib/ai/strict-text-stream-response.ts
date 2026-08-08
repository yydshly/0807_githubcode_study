import type { FinishReason, TextStreamPart, ToolSet } from "ai";

type StrictTextStreamResponseOptions = {
  init?: ResponseInit;
  onSuccess?: (text: string) => void | PromiseLike<void>;
};

/**
 * Raised when a provider closes a text generation without a clean `stop`.
 * In particular, `length` means the caller received only a truncated result.
 */
export class IncompleteTextGenerationError extends Error {
  readonly finishReason: FinishReason | "missing";

  constructor(finishReason: FinishReason | "missing") {
    super(
      finishReason === "missing"
        ? "Text generation ended without a finish event"
        : `Text generation did not finish cleanly (${finishReason})`,
    );
    this.name = "IncompleteTextGenerationError";
    this.finishReason = finishReason;
  }
}

function normalizeStreamError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(
    typeof error === "string" && error.trim()
      ? error
      : "Text generation failed",
  );
}

/**
 * Converts an AI SDK full stream to a plain-text response without hiding
 * provider failures. The success callback runs only after a terminal `stop`,
 * so callers can persist complete text without saving truncated generations.
 */
export function toStrictTextStreamResponse<TOOLS extends ToolSet>(
  fullStream: ReadableStream<TextStreamPart<TOOLS>>,
  options: StrictTextStreamResponseOptions = {},
): Response {
  const encoder = new TextEncoder();
  let text = "";
  let finishReason: FinishReason | undefined;

  const body = fullStream.pipeThrough(
    new TransformStream<TextStreamPart<TOOLS>, Uint8Array>({
      transform(part, controller) {
        switch (part.type) {
          case "text-delta":
            text += part.text;
            controller.enqueue(encoder.encode(part.text));
            break;
          case "error":
            controller.error(normalizeStreamError(part.error));
            break;
          case "abort":
            controller.error(
              new DOMException(
                part.reason || "Text generation aborted",
                "AbortError",
              ),
            );
            break;
          case "finish":
            finishReason = part.finishReason;
            if (finishReason !== "stop") {
              controller.error(
                new IncompleteTextGenerationError(finishReason),
              );
            }
            break;
        }
      },
      async flush() {
        if (finishReason === undefined) {
          throw new IncompleteTextGenerationError("missing");
        }
        if (finishReason !== "stop") {
          throw new IncompleteTextGenerationError(finishReason);
        }
        await options.onSuccess?.(text);
      },
    }),
  );

  const headers = new Headers(options.init?.headers);
  headers.set("Content-Type", "text/plain; charset=utf-8");

  return new Response(body, { ...options.init, headers });
}
