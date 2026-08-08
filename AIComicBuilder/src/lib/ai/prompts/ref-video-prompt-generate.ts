/**
 * User-message builder for the `ref_video_prompt` AI call.
 *
 * NOTE: The system prompt is NOT defined here — it lives in
 * `registry.ts` under `refVideoPromptDef` (single source of truth, also
 * exposed in the prompt management UI so users can override it).
 * This file only builds the per-request user payload.
 *
 * Output style follows the official 即梦 / Seedance inline syntax:
 *   - References are written as `@图片N` (not `@图片N`)
 *   - Flowing natural-language prose, no structured mapping header, no
 *     "节拍 1/2/3" labels, no 【对白口型】tags
 *   - Dialogue inline as "角色台词：..." appended after the action prose
 */

export interface SceneFrameInfo {
  label: string;      // e.g. "宫殿外"、"竹林"
  index: number;      // 1-based position in the ordered reference list
}

export interface CharacterRefInfo {
  name: string;
  index: number;      // 1-based position in the ordered reference list
  visualHint?: string | null;
}

export type RefVideoTransitionMode = "scene-sequence" | "keyframe-pair";

export interface CharacterRefImageInput {
  name: string;
  image: string | null | undefined;
  visualHint?: string | null;
}

export interface SceneFrameImageInput {
  label: string;
  image: string | null | undefined;
}

export interface OrderedRefVideoPromptReferences {
  /** Exact image order passed to the multimodal text provider. */
  images: string[];
  /** Character labels indexed against `images`. */
  characters: CharacterRefInfo[];
  /** Scene/frame labels indexed against `images`. */
  sceneFrames: SceneFrameInfo[];
  /** Validated subsets, useful to consumers that need the first scene frame. */
  characterImages: string[];
  sceneImages: string[];
}

function normalizeReferenceImage(image: string | null | undefined): string | null {
  if (typeof image !== "string") return null;
  const normalized = image.trim();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Build the single source of truth for `@图片N` labels and provider images.
 * Invalid image entries are removed together with their metadata so indexes
 * stay contiguous and can never drift from the actual multimodal payload.
 */
export function buildOrderedRefVideoPromptReferences(params: {
  characters: CharacterRefImageInput[];
  sceneFrames: SceneFrameImageInput[];
}): OrderedRefVideoPromptReferences {
  const validCharacters = params.characters.flatMap((character) => {
    const image = normalizeReferenceImage(character.image);
    return image ? [{ ...character, image }] : [];
  });
  const validSceneFrames = params.sceneFrames.flatMap((sceneFrame) => {
    const image = normalizeReferenceImage(sceneFrame.image);
    return image ? [{ ...sceneFrame, image }] : [];
  });

  const characterImages = validCharacters.map((character) => character.image);
  const sceneImages = validSceneFrames.map((sceneFrame) => sceneFrame.image);
  const characters = validCharacters.map((character, index) => ({
    name: character.name,
    index: index + 1,
    visualHint: character.visualHint,
  }));
  const sceneFrames = validSceneFrames.map((sceneFrame, index) => ({
    label: sceneFrame.label,
    index: characters.length + index + 1,
  }));

  return {
    images: [...characterImages, ...sceneImages],
    characters,
    sceneFrames,
    characterImages,
    sceneImages,
  };
}

export function buildRefVideoPromptRequest(params: {
  motionScript: string;
  cameraDirection: string;
  duration: number;
  characters: CharacterRefInfo[];
  sceneFrames: SceneFrameInfo[];
  transitionMode?: RefVideoTransitionMode;
  dialogues?: Array<{ characterName: string; text: string; offscreen?: boolean; visualHint?: string }>;
}): string {
  const lines: string[] = [];
  const isKeyframePair =
    params.transitionMode === "keyframe-pair" && params.sceneFrames.length === 2;

  lines.push(
    `你会收到以下参考图（顺序严格对应 @图片1、@图片2、@图片3 ...，必须使用 \`@图片N\` 形式，**不能**写成 \`@图片N\`）：`
  );
  for (const c of params.characters) {
    const hint = c.visualHint ? `（${c.visualHint}）` : "";
    lines.push(`  @图片${c.index} = 角色：${c.name}${hint}`);
  }
  for (const [i, s] of params.sceneFrames.entries()) {
    const frameType = isKeyframePair
      ? `同一镜头${i === 0 ? "首帧" : "尾帧"}`
      : "场景";
    lines.push(`  @图片${s.index} = ${frameType}：${s.label}`);
  }
  lines.push(``);

  if (isKeyframePair) {
    lines.push(
      `本镜头的两张画面是同一空间、同一连续镜头的首帧与尾帧，不是两个场景。必须从第一张的现有机位、景别、构图和空间布局连续过渡到第二张；已有首尾帧时不得改变既定机位或布局，只能对两帧已经体现的差异做连续插值，禁止切镜、跳切或另起机位。`
    );
    lines.push(``);
  } else if (params.sceneFrames.length > 1) {
    lines.push(
      `本镜头有 ${params.sceneFrames.length} 张场景参考图，按顺序对应镜头内的空间切换。散文中要依次经过这些场景并写清楚过渡。`
    );
    lines.push(``);
  }

  if (params.characters.length === 0) {
    lines.push(
      `注意：本镜头没有角色登场，只描述场景环境变化和镜头运动，不要编造任何人物。`
    );
    lines.push(``);
  }

  lines.push(`剧本动作：${params.motionScript}`);
  lines.push(`机位指令：${params.cameraDirection}`);
  lines.push(`时长：${params.duration}s`);

  if (params.duration <= 5) {
    lines.push(
      `【${params.duration}s 动作预算硬约束】${params.duration} 秒内必须是一个连续镜头，最多一个主运镜（固定机位也算一种选择），只安排 1-2 个清晰可见的动作节拍。微表情、呼吸或手部细节可作为同一节拍的连续变化，不得把它们扩写成新机位、新景别或多次切镜。`
    );
  }
  lines.push(
    `【创作边界硬约束】不得新增参考图、剧本动作和机位指令之外的画面外场景或元素，包括屋顶、室外空间、风、额外天气效果、新道具或新角色；只能在现有画面可见空间内完成动作与过渡。`
  );

  if (params.dialogues?.length) {
    lines.push(
      `对白（保持原文语言，直接嵌入散文末尾，用"角色名台词：..."的格式）：${params.dialogues
        .map((d) => `${d.characterName}: "${d.text}"`)
        .join("; ")}`
    );
  }

  lines.push(``);
  lines.push(`严格要求：`);
  lines.push(`1. 使用 \`@图片N\` 形式引用所有角色和场景（例：@图片1、@图片2），禁止写成 \`@图片N\``);
  lines.push(`2. 写作风格为连贯的自然散文，把 @图片N 直接嵌入描述里，禁止"节拍 1/2/3"结构化标签`);
  lines.push(`3. 禁止提示词开头写"图像映射：@图片1是 X，@图片2是 Y" 这种单独映射声明行——信息要融进散文`);
  lines.push(`4. 每次 @图片N 后面都必须加括号注释角色/场景名，写成 @图片N（名字）的格式`);
  lines.push(`5. 对白（如有）直接写在散文末尾：角色名台词：原文台词（不要 【对白口型】 等标签）`);
  lines.push(`6. 时长预算、创作边界和首尾帧连续性是最高优先级；若剧本动作或机位指令暗示更多切换，必须删减到预算内，不得补写画面外内容`);
  lines.push(`7. 仅输出提示词正文，无前言，无 markdown`);

  return lines.join("\n");
}
