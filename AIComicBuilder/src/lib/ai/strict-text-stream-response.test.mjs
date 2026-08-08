import assert from "node:assert/strict";
import test from "node:test";

import {
  IncompleteTextGenerationError,
  toStrictTextStreamResponse,
} from "./strict-text-stream-response.ts";

function streamOf(...parts) {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
}

test("returns text and persists only after a clean stop", async () => {
  let persisted;
  const response = toStrictTextStreamResponse(
    streamOf(
      { type: "start" },
      { type: "text-delta", id: "1", text: "hello " },
      { type: "text-delta", id: "1", text: "world" },
      { type: "finish", finishReason: "stop" },
    ),
    { onSuccess: (text) => { persisted = text; } },
  );

  assert.equal(await response.text(), "hello world");
  assert.equal(persisted, "hello world");
  assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
});

test("propagates provider errors and does not persist partial text", async () => {
  let persisted = false;
  const failure = new Error("provider failed");
  const response = toStrictTextStreamResponse(
    streamOf(
      { type: "text-delta", id: "1", text: "partial" },
      { type: "error", error: failure },
    ),
    { onSuccess: () => { persisted = true; } },
  );

  await assert.rejects(response.text(), failure);
  assert.equal(persisted, false);
});

test("propagates aborts and does not persist partial text", async () => {
  let persisted = false;
  const response = toStrictTextStreamResponse(
    streamOf(
      { type: "text-delta", id: "1", text: "partial" },
      { type: "abort", reason: "timeout" },
    ),
    { onSuccess: () => { persisted = true; } },
  );

  await assert.rejects(response.text(), (error) => {
    assert.equal(error.name, "AbortError");
    assert.equal(error.message, "timeout");
    return true;
  });
  assert.equal(persisted, false);
});

test("rejects length-truncated output and does not persist it", async () => {
  let persisted = false;
  const response = toStrictTextStreamResponse(
    streamOf(
      { type: "text-delta", id: "1", text: "partial" },
      { type: "finish", finishReason: "length" },
    ),
    { onSuccess: () => { persisted = true; } },
  );

  await assert.rejects(
    response.text(),
    (error) => error instanceof IncompleteTextGenerationError
      && error.finishReason === "length",
  );
  assert.equal(persisted, false);
});

for (const finishReason of ["content-filter", "tool-calls", "error", "other"]) {
  test(`rejects ${finishReason} output and does not persist it`, async () => {
    let persisted = false;
    const response = toStrictTextStreamResponse(
      streamOf(
        { type: "text-delta", id: "1", text: "partial" },
        { type: "finish", finishReason },
      ),
      { onSuccess: () => { persisted = true; } },
    );

    await assert.rejects(
      response.text(),
      (error) => error instanceof IncompleteTextGenerationError
        && error.finishReason === finishReason,
    );
    assert.equal(persisted, false);
  });
}

test("rejects a stream that closes without a finish event", async () => {
  const response = toStrictTextStreamResponse(
    streamOf({ type: "text-delta", id: "1", text: "partial" }),
  );

  await assert.rejects(
    response.text(),
    (error) => error instanceof IncompleteTextGenerationError
      && error.finishReason === "missing",
  );
});
