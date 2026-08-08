import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOrderedRefVideoPromptReferences,
  buildRefVideoPromptRequest,
} from "./ref-video-prompt-generate.ts";

test("orders character references before frames and assigns matching indexes", () => {
  const references = buildOrderedRefVideoPromptReferences({
    characters: [
      { name: "小满", image: "characters/xiaoman.png", visualHint: "红色三角发夹" },
      { name: "阿澜", image: "characters/alan.png" },
    ],
    sceneFrames: [
      { label: "首帧", image: "frames/first.png" },
      { label: "尾帧", image: "frames/last.png" },
    ],
  });

  assert.deepEqual(references.images, [
    "characters/xiaoman.png",
    "characters/alan.png",
    "frames/first.png",
    "frames/last.png",
  ]);
  assert.deepEqual(
    references.characters.map(({ name, index }) => ({ name, index })),
    [
      { name: "小满", index: 1 },
      { name: "阿澜", index: 2 },
    ],
  );
  assert.deepEqual(references.sceneFrames, [
    { label: "首帧", index: 3 },
    { label: "尾帧", index: 4 },
  ]);

  const request = buildRefVideoPromptRequest({
    motionScript: "从首帧自然过渡到尾帧",
    cameraDirection: "static",
    duration: 5,
    characters: references.characters,
    sceneFrames: references.sceneFrames,
  });
  assert.match(request, /@图片1 = 角色：小满/);
  assert.match(request, /@图片2 = 角色：阿澜/);
  assert.match(request, /@图片3 = 场景：首帧/);
  assert.match(request, /@图片4 = 场景：尾帧/);
});

test("removes unusable images together with metadata and keeps indexes contiguous", () => {
  const references = buildOrderedRefVideoPromptReferences({
    characters: [
      { name: "无图角色", image: "  " },
      { name: "有效角色", image: "  characters/valid.png  " },
    ],
    sceneFrames: [
      { label: "缺失帧", image: undefined },
      { label: "有效帧", image: "frames/valid.png" },
    ],
  });

  assert.deepEqual(references.images, ["characters/valid.png", "frames/valid.png"]);
  assert.deepEqual(
    references.characters.map(({ name, index }) => ({ name, index })),
    [{ name: "有效角色", index: 1 }],
  );
  assert.deepEqual(references.sceneFrames, [{ label: "有效帧", index: 2 }]);
});

test("starts scene indexes at one when no character reference is usable", () => {
  const references = buildOrderedRefVideoPromptReferences({
    characters: [{ name: "无图角色", image: null }],
    sceneFrames: [
      { label: "首帧", image: "frames/first.png" },
      { label: "尾帧", image: "frames/last.png" },
    ],
  });

  assert.deepEqual(references.images, ["frames/first.png", "frames/last.png"]);
  assert.deepEqual(references.characters, []);
  assert.deepEqual(references.sceneFrames, [
    { label: "首帧", index: 1 },
    { label: "尾帧", index: 2 },
  ]);
});

test("gives five-second shots an executable single-take action budget", () => {
  const request = buildRefVideoPromptRequest({
    motionScript: "小满在桌前抬眼，然后按下台灯开关。",
    cameraDirection: "平视中景缓慢推近",
    duration: 5,
    characters: [{ name: "小满", index: 1 }],
    sceneFrames: [{ label: "工作室", index: 2 }],
    transitionMode: "scene-sequence",
  });

  assert.match(request, /5 秒内必须是一个连续镜头/);
  assert.match(request, /最多一个主运镜/);
  assert.match(request, /只安排 1-2 个清晰可见的动作节拍/);
  assert.match(request, /不得新增参考图、剧本动作和机位指令之外的画面外场景或元素/);
  assert.match(request, /屋顶、室外空间、风/);
});

test("treats a keyframe pair as endpoints of one shot, not two scenes", () => {
  const request = buildRefVideoPromptRequest({
    motionScript: "小满在桌前抬眼。",
    cameraDirection: "固定平视中景",
    duration: 5,
    characters: [{ name: "小满", index: 1 }],
    sceneFrames: [
      { label: "首帧", index: 2 },
      { label: "尾帧", index: 3 },
    ],
    transitionMode: "keyframe-pair",
  });

  assert.match(request, /@图片2 = 同一镜头首帧/);
  assert.match(request, /@图片3 = 同一镜头尾帧/);
  assert.match(request, /不是两个场景/);
  assert.match(request, /已有首尾帧时不得改变既定机位或布局/);
  assert.match(request, /只能对两帧已经体现的差异做连续插值/);
  assert.doesNotMatch(request, /按顺序对应镜头内的空间切换/);
});

test("keeps explicit multi-scene transitions in scene-sequence mode", () => {
  const request = buildRefVideoPromptRequest({
    motionScript: "从竹林地面跃上竹梢。",
    cameraDirection: "低角度跟随",
    duration: 10,
    characters: [{ name: "剑客", index: 1 }],
    sceneFrames: [
      { label: "竹林地面", index: 2 },
      { label: "竹梢高空", index: 3 },
    ],
    transitionMode: "scene-sequence",
  });

  assert.match(request, /按顺序对应镜头内的空间切换/);
  assert.doesNotMatch(request, /10 秒内必须是一个连续镜头/);
  assert.doesNotMatch(request, /不是两个场景/);
});
