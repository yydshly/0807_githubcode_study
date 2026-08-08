export const DEFAULT_MINIMAX_BASE_URL = "https://api.minimax.io/v1";
export const MINIMAX_IMAGE_PROMPT_LIMIT = 1500;

const THINK_BLOCK_PATTERN = /<think>[\s\S]*?<\/think>\s*/gi;

export interface MiniMaxImageApiResponse {
  id?: string;
  data?: {
    image_urls?: string[];
    image_base64?: string[];
  };
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
}

export type MiniMaxImageResult =
  | { type: "base64"; value: string }
  | { type: "url"; value: string };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractPromptSection(prompt: string, headings: string[]): string {
  for (const heading of headings) {
    const marker = new RegExp(`===\\s*${escapeRegExp(heading)}\\s*===`, "i").exec(prompt);
    if (!marker) continue;
    const contentStart = marker.index + marker[0].length;
    const remainder = prompt.slice(contentStart);
    const nextMarker = remainder.search(/\n\s*===\s*[^\n]+?\s*===/);
    return (nextMarker >= 0 ? remainder.slice(0, nextMarker) : remainder).trim();
  }
  return "";
}

function truncatePromptPart(value: string, limit: number): string {
  if (limit <= 0) return "";
  const normalized = value.trim();
  if (normalized.length <= limit) return normalized;
  if (limit < 24) return normalized.slice(0, limit);
  const separator = "\n…\n";
  const available = limit - separator.length;
  const headLength = Math.ceil(available * 0.7);
  return normalized.slice(0, headLength) + separator + normalized.slice(-available + headLength);
}

interface PromptSection {
  label: string;
  content: string;
  weight?: number;
}

function allocatePromptSectionBudgets(
  sections: PromptSection[],
  availableChars: number,
): number[] {
  const allocations = sections.map(() => 0);
  let remainingChars = Math.max(0, availableChars);
  let unresolved = sections.map((_, index) => index);

  while (remainingChars > 0 && unresolved.length > 0) {
    const totalWeight = unresolved.reduce(
      (total, index) => total + Math.max(1, sections[index].weight ?? 1),
      0,
    );
    const shares = unresolved.map((index) => ({
      index,
      exact:
        (remainingChars * Math.max(1, sections[index].weight ?? 1)) / totalWeight,
    }));
    const sectionsThatFit = shares.filter(
      ({ index, exact }) => sections[index].content.length <= Math.floor(exact),
    );

    if (sectionsThatFit.length > 0) {
      const completed = new Set<number>();
      for (const { index } of sectionsThatFit) {
        allocations[index] = sections[index].content.length;
        remainingChars -= allocations[index];
        completed.add(index);
      }
      unresolved = unresolved.filter((index) => !completed.has(index));
      continue;
    }

    let assignedChars = 0;
    for (const { index, exact } of shares) {
      allocations[index] = Math.floor(exact);
      assignedChars += allocations[index];
    }

    const remainderOrder = [...shares].sort(
      (left, right) =>
        right.exact - Math.floor(right.exact) -
          (left.exact - Math.floor(left.exact)) ||
        left.index - right.index,
    );
    for (let index = 0; index < remainingChars - assignedChars; index += 1) {
      allocations[remainderOrder[index].index] += 1;
    }
    break;
  }

  return allocations;
}

function composePromptWithinLimit(
  opening: string,
  sections: PromptSection[],
  closing: string,
  maxChars: number,
): string {
  const limit = Math.max(0, Math.floor(maxChars));
  if (limit === 0) return "";

  const normalizedOpening = opening.trim();
  const normalizedSections = sections
    .map((section) => ({ ...section, content: section.content.trim() }))
    .filter((section) => section.content.length > 0);
  const end = closing.trim() ? `\n${closing.trim()}` : "";
  const sectionPrefixes = normalizedSections.map((section) => `\n${section.label}\n`);
  const structuralLength =
    normalizedOpening.length +
    sectionPrefixes.reduce((total, prefix) => total + prefix.length, 0) +
    end.length;

  if (structuralLength > limit) {
    if (end.length >= limit) return truncatePromptPart(closing, limit);

    const semanticLead = [
      normalizedOpening,
      ...normalizedSections.flatMap((section) => [section.label, section.content]),
    ]
      .filter(Boolean)
      .join("\n");
    return `${truncatePromptPart(semanticLead, limit - end.length)}${end}`;
  }

  const allocations = allocatePromptSectionBudgets(
    normalizedSections,
    limit - structuralLength,
  );
  let output = normalizedOpening;
  for (const [index, section] of normalizedSections.entries()) {
    output +=
      sectionPrefixes[index] + truncatePromptPart(section.content, allocations[index]);
  }
  return output + end;
}

/**
 * MiniMax image prompts are capped at 1500 characters. The application's
 * reusable prompt templates put long policy blocks before the actual subject,
 * so a naive prefix slice can remove the character or frame description.
 * Compact known structured prompts around their authoritative content instead.
 */
export function compactMiniMaxImagePrompt(
  prompt: string,
  maxChars = MINIMAX_IMAGE_PROMPT_LIMIT,
): string {
  if (prompt.length <= maxChars) return prompt;

  const characterDescription = extractPromptSection(prompt, [
    "CHARACTER DESCRIPTION (authoritative)",
    "角色描述（权威）",
  ]);
  if (characterDescription) {
    const explicitlyFemale = /女(?:性|孩|人|，|,|。|；|;|\s|$)|\b(?:female|woman|girl)\b/i.test(
      characterDescription,
    );
    const explicitlyMale = /男(?:性|孩|人|，|,|。|；|;|\s|$)|\b(?:male|man|boy)\b/i.test(
      characterDescription,
    );
    const genderGuard = explicitlyFemale
      ? "角色明确为女性，不得画成男性，不得添加胡须。"
      : explicitlyMale
        ? "角色明确为男性，不得改变性别。"
        : "不得擅自改变角色性别或年龄。";
    return composePromptWithinLimit(
      "专业角色四视图设定图。以下角色描述是最高权威，必须保留姓名、性别、年龄、脸型、发型、服装、配色、标志特征与指定画风。",
      [{ label: "【权威角色描述】", content: characterDescription }],
      `${genderGuard} 同一个角色以四个一致的全身视图从左到右排列：正面、右前3/4侧面、右侧面、背面。纯白背景，严格遵循权威描述指定的媒介与画风；四个视图身份、比例、发型、服装和颜色完全一致。只画这一名角色的四个视图，不要其他人物，不要文字、标志、水印或界面元素。`,
      maxChars,
    );
  }

  const frameDescription = extractPromptSection(prompt, ["帧描述", "画面描述"]);
  const sceneDescription = extractPromptSection(prompt, ["场景环境", "场景描述"]);
  const characterDetails = extractPromptSection(prompt, ["角色描述"]);
  if (frameDescription) {
    const isLastFrame = /(?:尾帧|结束帧)/.test(prompt.slice(0, 160));
    return composePromptWithinLimit(
      `生成一张高质量${isLastFrame ? "尾帧" : "首帧"}图像，严格按帧内容绘制。`,
      [
        { label: "【帧内容（最高优先级）】", content: frameDescription, weight: 5 },
        { label: "【场景】", content: sceneDescription, weight: 3 },
        { label: "【角色补充】", content: characterDetails, weight: 3 },
      ],
      `${isLastFrame ? "第一张参考图是同镜头首帧，" : ""}严格匹配附带角色参考图的身份、脸、发型、服装、颜色和画风；保持帧内容指定的画幅、构图及场景布局。只生成单张完整画面，不要分栏、拼贴、字幕、文字、标志或水印。`,
      maxChars,
    );
  }

  if (sceneDescription && /(?:不得出现任何人物|纯场景参考帧)/.test(prompt)) {
    return composePromptWithinLimit(
      "生成一张电影级纯场景参考帧。",
      [{ label: "【场景】", content: sceneDescription }],
      "画面中绝对不出现人物、背影、剪影、人形、手脚或身体部位。完整渲染环境、道具、天气、光线与景深；不要文字、标志或水印。",
      maxChars,
    );
  }

  return prompt.slice(0, maxChars);
}

/**
 * Keep subject-reference labels useful without allowing verbose labels to crowd
 * the structured, authoritative prompt out of MiniMax's 1500-character limit.
 */
export function compactMiniMaxImagePromptWithReferences(
  prompt: string,
  referenceLabels: string[],
  maxChars = MINIMAX_IMAGE_PROMPT_LIMIT,
): string {
  const limit = Math.max(0, Math.floor(maxChars));
  const labels = referenceLabels.map((label) => label.trim()).filter(Boolean);
  if (labels.length === 0) return compactMiniMaxImagePrompt(prompt, limit);

  const separator = "\n\n";
  const minimumCorePromptBudget = Math.min(1200, limit);
  const referenceBudget = Math.min(
    300,
    Math.max(0, limit - minimumCorePromptBudget - separator.length),
  );
  if (referenceBudget === 0) return compactMiniMaxImagePrompt(prompt, limit);

  const referenceInstruction = composePromptWithinLimit(
    "Subject reference order:",
    labels.map((label, index) => ({
      label: `Reference image ${index + 1}:`,
      content: label,
    })),
    "",
    referenceBudget,
  );
  const corePrompt = compactMiniMaxImagePrompt(
    prompt,
    limit - referenceInstruction.length - separator.length,
  );
  return `${corePrompt}${separator}${referenceInstruction}`;
}

/** Normalize either a regional API host or a /v1 URL for OpenAI-compatible calls. */
export function normalizeMiniMaxBaseUrl(baseUrl?: string): string {
  const normalized = (baseUrl?.trim() || DEFAULT_MINIMAX_BASE_URL).replace(/\/+$/, "");
  return /\/v1$/i.test(normalized) ? normalized : `${normalized}/v1`;
}

/** Add MiniMax's native endpoint to a normalized API base URL. */
export function buildMiniMaxApiUrl(baseUrl: string | undefined, endpoint: string): string {
  const cleanEndpoint = endpoint.replace(/^\/+/, "");
  return `${normalizeMiniMaxBaseUrl(baseUrl)}/${cleanEndpoint}`;
}

/**
 * MiniMax-M3 thinks by default. Structured and streamed application output must not
 * contain those tokens, so disable thinking for M3 unless a caller deliberately
 * selected a mode. For M2.x, thinking cannot be disabled; only reasoning_split is
 * added so the visible content remains parseable.
 */
export function addMiniMaxThinkingDefaults(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;

  const request = body as Record<string, unknown>;
  const model = typeof request.model === "string" ? request.model : "";
  const canDisableThinking = /^MiniMax-M3(?:$|-)/i.test(model);
  return {
    ...request,
    ...(canDisableThinking && {
      thinking: request.thinking ?? { type: "disabled" },
    }),
    reasoning_split: request.reasoning_split ?? true,
  };
}

/** Inject MiniMax-specific fields into an OpenAI-compatible JSON request body. */
export function addMiniMaxThinkingDefaultsToJson(body: string): string {
  try {
    return JSON.stringify(addMiniMaxThinkingDefaults(JSON.parse(body)));
  } catch {
    return body;
  }
}

/** A custom fetch used by both the OpenAI SDK and AI SDK streaming paths. */
export function createMiniMaxFetch(fetchImpl: typeof fetch = globalThis.fetch): typeof fetch {
  return async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    if (/\/chat\/completions(?:\?|$)/.test(url) && typeof init?.body === "string") {
      return fetchImpl(input, {
        ...init,
        body: addMiniMaxThinkingDefaultsToJson(init.body),
      });
    }

    return fetchImpl(input, init);
  };
}

/** Remove legacy inline thinking blocks if a gateway ignores the request controls. */
export function stripMiniMaxThinking(text: string): string {
  return text.replace(THINK_BLOCK_PATTERN, "").trim();
}

/** Pick the first usable image from either supported MiniMax response format. */
export function selectMiniMaxImageResult(response: MiniMaxImageApiResponse): MiniMaxImageResult {
  if (
    response.base_resp?.status_code !== undefined &&
    response.base_resp.status_code !== 0
  ) {
    throw new Error(
      `MiniMax image error [${response.base_resp.status_code}]: ${response.base_resp.status_msg || "unknown"}`,
    );
  }

  const base64 = response.data?.image_base64?.find(Boolean);
  if (base64) return { type: "base64", value: base64 };

  const url = response.data?.image_urls?.find(Boolean);
  if (url) return { type: "url", value: url };

  throw new Error(
    `MiniMax image generation returned no image${response.id ? ` (request ${response.id})` : ""}`,
  );
}

export function parseImageSize(size?: string): { width: number; height: number } | undefined {
  const match = size?.trim().match(/^(\d+)\s*[x*]\s*(\d+)$/i);
  if (!match) return undefined;

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (
    width < 512 ||
    width > 2048 ||
    height < 512 ||
    height > 2048 ||
    width % 8 !== 0 ||
    height % 8 !== 0
  ) {
    return undefined;
  }
  return { width, height };
}
