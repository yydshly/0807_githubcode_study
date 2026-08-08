import test from "node:test";
import assert from "node:assert/strict";
import {
  prepareFirstMiniMaxReference,
  shouldRetryMiniMaxImageWithoutReference,
} from "./minimax-reference.ts";

test("prepares only the first usable MiniMax image reference", () => {
  const calls = [];
  const selected = prepareFirstMiniMaxReference(
    ["missing.png", "relevant-character.png", "other-character.png"],
    ["missing", "小满", "路人"],
    (imagePath, label) => {
      calls.push({ imagePath, label });
      return imagePath === "missing.png" ? undefined : { imagePath, label };
    },
  );

  assert.deepEqual(selected, {
    imagePath: "relevant-character.png",
    label: "小满",
  });
  assert.deepEqual(calls, [
    { imagePath: "missing.png", label: "missing" },
    { imagePath: "relevant-character.png", label: "小满" },
  ]);
});

test("keeps a first-frame anchor ahead of later character references", () => {
  const selected = prepareFirstMiniMaxReference(
    ["generated-first-frame.png", "character-sheet.png"],
    ["首帧/First Frame", "小满"],
    (imagePath, label) => ({ imagePath, label }),
  );

  assert.deepEqual(selected, {
    imagePath: "generated-first-frame.png",
    label: "首帧/First Frame",
  });
});

test("retries without a reference only for MiniMax status 2013", () => {
  assert.equal(
    shouldRetryMiniMaxImageWithoutReference(
      { base_resp: { status_code: 2013 } },
      true,
    ),
    true,
  );
  assert.equal(
    shouldRetryMiniMaxImageWithoutReference(
      { base_resp: { status_code: 2013 } },
      false,
    ),
    false,
  );
  assert.equal(
    shouldRetryMiniMaxImageWithoutReference(
      { base_resp: { status_code: 1004 } },
      true,
    ),
    false,
  );
});
