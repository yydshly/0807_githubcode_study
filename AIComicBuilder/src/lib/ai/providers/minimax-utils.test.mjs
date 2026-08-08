import test from "node:test";
import assert from "node:assert/strict";
import {
  addMiniMaxThinkingDefaults,
  buildMiniMaxApiUrl,
  compactMiniMaxImagePrompt,
  compactMiniMaxImagePromptWithReferences,
  createMiniMaxFetch,
  MINIMAX_IMAGE_PROMPT_LIMIT,
  normalizeMiniMaxBaseUrl,
  parseImageSize,
  selectMiniMaxImageResult,
  stripMiniMaxThinking,
} from "./minimax-utils.ts";

test("normalizes MiniMax hosts and native endpoint URLs", () => {
  assert.equal(normalizeMiniMaxBaseUrl("https://api.minimax.io/"), "https://api.minimax.io/v1");
  assert.equal(
    normalizeMiniMaxBaseUrl("https://api.minimaxi.com/v1/"),
    "https://api.minimaxi.com/v1",
  );
  assert.equal(
    buildMiniMaxApiUrl("https://api.minimax.io", "/image_generation"),
    "https://api.minimax.io/v1/image_generation",
  );
});

test("adds safe thinking defaults without replacing explicit choices", () => {
  assert.deepEqual(addMiniMaxThinkingDefaults({ model: "MiniMax-M3" }), {
    model: "MiniMax-M3",
    thinking: { type: "disabled" },
    reasoning_split: true,
  });
  assert.deepEqual(
    addMiniMaxThinkingDefaults({
      model: "MiniMax-M3",
      thinking: { type: "adaptive" },
      reasoning_split: false,
    }),
    {
      model: "MiniMax-M3",
      thinking: { type: "adaptive" },
      reasoning_split: false,
    },
  );
  assert.deepEqual(addMiniMaxThinkingDefaults({ model: "MiniMax-M2.7" }), {
    model: "MiniMax-M2.7",
    reasoning_split: true,
  });
});

test("injects thinking controls only into chat completion requests", async () => {
  const calls = [];
  const fakeFetch = async (input, init) => {
    calls.push({ input: String(input), body: init?.body });
    return new Response("{}", { status: 200 });
  };
  const minimaxFetch = createMiniMaxFetch(fakeFetch);

  await minimaxFetch("https://api.minimax.io/v1/chat/completions", {
    method: "POST",
    body: JSON.stringify({ model: "MiniMax-M3" }),
  });
  await minimaxFetch("https://api.minimax.io/v1/models", { method: "GET" });

  assert.deepEqual(JSON.parse(calls[0].body), {
    model: "MiniMax-M3",
    thinking: { type: "disabled" },
    reasoning_split: true,
  });
  assert.equal(calls[1].body, undefined);
});

test("strips inline thinking and accepts both image response formats", () => {
  assert.equal(
    stripMiniMaxThinking("<think>private reasoning</think>\n```json\n{\"ok\":true}\n```"),
    "```json\n{\"ok\":true}\n```",
  );
  assert.deepEqual(
    selectMiniMaxImageResult({ data: { image_base64: ["YWJj"] } }),
    { type: "base64", value: "YWJj" },
  );
  assert.deepEqual(
    selectMiniMaxImageResult({ data: { image_urls: ["https://example.com/image.png"] } }),
    { type: "url", value: "https://example.com/image.png" },
  );
});

test("parses only MiniMax-supported custom image dimensions", () => {
  assert.deepEqual(parseImageSize("1024x768"), { width: 1024, height: 768 });
  assert.equal(parseImageSize("1023x768"), undefined);
  assert.equal(parseImageSize("4096x4096"), undefined);
});

test("compacts long character sheets around the authoritative description", () => {
  const prompt = `${"generic style policy ".repeat(120)}
=== CHARACTER DESCRIPTION (authoritative) ===
Name: 小满
电影感二维手绘动画，东方绘本水墨与彩铅质感——女，22岁，齐下巴黑色短发，左侧红色三角发夹，芥末黄色连帽衫，深绿色背带裤，右脸颊石墨灰痕。
=== FACE — HIGH DETAIL ===
${"generic face policy ".repeat(80)}`;
  const compacted = compactMiniMaxImagePrompt(prompt);

  assert.ok(compacted.length <= MINIMAX_IMAGE_PROMPT_LIMIT);
  assert.match(compacted, /小满/);
  assert.match(compacted, /女，22岁/);
  assert.match(compacted, /左侧红色三角发夹/);
  assert.match(compacted, /角色明确为女性/);
  assert.match(compacted, /正面、右前3\/4侧面、右侧面、背面/);
  assert.doesNotMatch(compacted, /generic style policy/);
});

test("does not override a character's requested medium while compacting", () => {
  const prompt = `${"generic style policy ".repeat(120)}
=== CHARACTER DESCRIPTION (authoritative) ===
Name: 阿澜
3D 国漫 CG 渲染，成年女性，银灰短发，PBR 丝绸披风。
=== FACE — HIGH DETAIL ===
${"generic face policy ".repeat(80)}`;
  const compacted = compactMiniMaxImagePrompt(prompt);

  assert.match(compacted, /3D 国漫 CG 渲染/);
  assert.match(compacted, /严格遵循权威描述指定的媒介与画风/);
  assert.doesNotMatch(compacted, /二维角色设计稿/);
});

test("compacts long frame prompts around frame and scene descriptions", () => {
  const prompt = `生成此镜头的首帧，作为一张高质量图像。
${"通用规则。".repeat(400)}
=== 场景环境 ===
雨夜屋顶小画室，左侧雨窗、中央书桌、右侧矮书架。
=== 帧描述 ===
9:16竖屏，小满坐在书桌前，齐下巴黑色短发，左侧红色三角发夹，右脸颊石墨灰痕，冷蓝台灯照亮画稿。
=== 角色描述 ===
小满：22岁女性，芥末黄色连帽衫，深绿色背带裤。
=== 参考图（角色设定图）===
${"参考规则。".repeat(200)}`;
  const compacted = compactMiniMaxImagePrompt(prompt);

  assert.ok(compacted.length <= MINIMAX_IMAGE_PROMPT_LIMIT);
  assert.match(compacted, /帧内容（最高优先级）/);
  assert.match(compacted, /左侧红色三角发夹/);
  assert.match(compacted, /左侧雨窗、中央书桌、右侧矮书架/);
  assert.match(compacted, /22岁女性/);
  assert.doesNotMatch(compacted, /通用规则。通用规则/);
});

test("fairly reserves space for long frame, scene, and character sections", () => {
  const prompt = `生成此镜头的首帧，作为一张高质量图像。
${"通用规则。".repeat(400)}
=== 场景环境 ===
SCENE_HEAD ${"场景细节。".repeat(800)} SCENE_TAIL
=== 帧描述 ===
FRAME_HEAD 16:9横屏 ${"动作细节。".repeat(1200)} FRAME_TAIL
=== 角色描述 ===
CHARACTER_HEAD ${"角色锚点。".repeat(800)} CHARACTER_TAIL
=== 参考图（角色设定图）===
${"参考规则。".repeat(200)}`;
  const compacted = compactMiniMaxImagePrompt(prompt);

  assert.ok(compacted.length <= MINIMAX_IMAGE_PROMPT_LIMIT);
  assert.match(compacted, /FRAME_HEAD/);
  assert.match(compacted, /FRAME_TAIL/);
  assert.match(compacted, /SCENE_HEAD/);
  assert.match(compacted, /SCENE_TAIL/);
  assert.match(compacted, /CHARACTER_HEAD/);
  assert.match(compacted, /CHARACTER_TAIL/);
  assert.match(compacted, /16:9横屏/);
  assert.match(compacted, /保持帧内容指定的画幅/);
  assert.doesNotMatch(compacted, /保持9:16/);
});

test("bounds very long reference labels without truncating authoritative prompt closing", () => {
  const prompt = `${"generic style policy ".repeat(120)}
=== CHARACTER DESCRIPTION (authoritative) ===
Name: 小满
二维手绘动画，22岁女性，左侧红色三角发夹，右脸颊石墨灰痕。
=== FACE — HIGH DETAIL ===
${"generic face policy ".repeat(80)}`;
  const compacted = compactMiniMaxImagePromptWithReferences(prompt, [
    `小满角色设定图 ${"极长标签。".repeat(1000)}`,
    `同镜头首帧 ${"另一段极长标签。".repeat(1000)}`,
  ]);

  assert.ok(compacted.length <= MINIMAX_IMAGE_PROMPT_LIMIT);
  assert.match(compacted, /Name: 小满/);
  assert.match(compacted, /右脸颊石墨灰痕/);
  assert.match(compacted, /只画这一名角色的四个视图/);
  assert.match(compacted, /不要文字、标志、水印或界面元素。/);
  assert.match(compacted, /Subject reference order:/);
  assert.match(compacted, /Reference image 1:/);
  assert.match(compacted, /Reference image 2:/);
});

test("preserves the no-people contract for long scene-frame prompts", () => {
  const prompt = `生成一张电影级静帧图像，作为纯场景参考帧。画面中不得出现任何人物。
${"通用规则。".repeat(400)}
=== 场景描述 ===
雨夜屋顶小画室，左侧雨窗、中央书桌、右侧矮书架，冷蓝光。
=== 渲染 ===
${"渲染规则。".repeat(100)}`;
  const compacted = compactMiniMaxImagePrompt(prompt);

  assert.ok(compacted.length <= MINIMAX_IMAGE_PROMPT_LIMIT);
  assert.match(compacted, /雨夜屋顶小画室/);
  assert.match(compacted, /绝对不出现人物/);
});
