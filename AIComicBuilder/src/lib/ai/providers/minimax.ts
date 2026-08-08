import OpenAI from "openai";
import fs from "node:fs";
import path from "node:path";
import { id as genId } from "@/lib/id";
import type { AIProvider, ImageOptions, TextOptions } from "../types";
import {
  buildMiniMaxApiUrl,
  compactMiniMaxImagePrompt,
  compactMiniMaxImagePromptWithReferences,
  createMiniMaxFetch,
  normalizeMiniMaxBaseUrl,
  parseImageSize,
  selectMiniMaxImageResult,
  stripMiniMaxThinking,
  type MiniMaxImageApiResponse,
} from "./minimax-utils";
import {
  prepareFirstMiniMaxReference,
  shouldRetryMiniMaxImageWithoutReference,
} from "./minimax-reference";

const SUPPORTED_ASPECT_RATIOS = new Set([
  "1:1",
  "16:9",
  "4:3",
  "3:2",
  "2:3",
  "3:4",
  "9:16",
  "21:9",
]);

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

const VIDEO_MIME_BY_EXTENSION: Record<string, string> = {
  ".mp4": "video/mp4",
  ".avi": "video/x-msvideo",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
};

interface MiniMaxSubjectReference {
  type: "character";
  image_file: string;
}

interface PreparedReference extends MiniMaxSubjectReference {
  label?: string;
}

interface MiniMaxVideoContentPart {
  type: "video_url";
  video_url: {
    url: string;
    detail: "default";
    fps: number;
  };
}

function resolveLocalMediaPath(mediaPath: string): string | undefined {
  const candidates = [path.resolve(mediaPath)];
  if (path.isAbsolute(mediaPath)) {
    candidates.push(path.resolve(process.cwd(), mediaPath.replace(/^[/\\]+/, "")));
  }
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function prepareReferenceImage(imagePath: string, label?: string): PreparedReference | undefined {
  if (/^https?:\/\//i.test(imagePath) || /^data:image\//i.test(imagePath)) {
    return { type: "character", image_file: imagePath, label };
  }

  const resolved = resolveLocalMediaPath(imagePath);
  if (!resolved) return undefined;

  const mimeType = IMAGE_MIME_BY_EXTENSION[path.extname(resolved).toLowerCase()];
  if (!mimeType) return undefined;

  const data = fs.readFileSync(resolved);
  if (data.byteLength > 10 * 1024 * 1024) {
    throw new Error(`MiniMax reference image exceeds the 10 MB limit: ${imagePath}`);
  }

  return {
    type: "character",
    image_file: `data:${mimeType};base64,${data.toString("base64")}`,
    label,
  };
}

function prepareVideoInput(videoPath: string): string | undefined {
  if (
    /^https?:\/\//i.test(videoPath) ||
    /^data:video\//i.test(videoPath) ||
    /^mm_file:\/\//i.test(videoPath)
  ) {
    return videoPath;
  }

  const resolved = resolveLocalMediaPath(videoPath);
  if (!resolved) return undefined;

  const mimeType = VIDEO_MIME_BY_EXTENSION[path.extname(resolved).toLowerCase()];
  if (!mimeType) return undefined;

  const data = fs.readFileSync(resolved);
  if (data.byteLength > 50 * 1024 * 1024) {
    throw new Error(
      `MiniMax video input exceeds the 50 MB inline limit; upload it with the Files API first: ${videoPath}`,
    );
  }
  return `data:${mimeType};base64,${data.toString("base64")}`;
}

function prepareImagePrompt(prompt: string, references: PreparedReference[]): string {
  const labels = references
    .map((reference) => reference.label)
    .filter((value): value is string => Boolean(value));

  if (labels.length === 0) return compactMiniMaxImagePrompt(prompt);
  return compactMiniMaxImagePromptWithReferences(prompt, labels);
}

function decodeBase64Image(value: string): { buffer: Buffer; mimeType?: string } {
  const dataUri = value.match(/^data:(image\/[^;,]+);base64,([\s\S]+)$/i);
  const mimeType = dataUri?.[1];
  const encoded = dataUri?.[2] ?? value;
  const buffer = Buffer.from(encoded.replace(/\s/g, ""), "base64");
  if (buffer.byteLength === 0) {
    throw new Error("MiniMax image generation returned empty base64 data");
  }
  return { buffer, mimeType };
}

function imageExtension(buffer: Buffer, mimeType?: string): string {
  const normalizedMime = mimeType?.split(";")[0].trim().toLowerCase();
  if (normalizedMime === "image/png") return "png";
  if (normalizedMime === "image/gif") return "gif";
  if (normalizedMime === "image/webp") return "webp";
  if (normalizedMime === "image/jpeg" || normalizedMime === "image/jpg") return "jpg";

  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "jpg";
  if (buffer.subarray(0, 4).toString("ascii") === "GIF8") return "gif";
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return "jpg";
}

export class MiniMaxProvider implements AIProvider {
  private readonly client: OpenAI;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly uploadDir: string;
  private readonly fetchImpl: typeof fetch;

  constructor(params?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    uploadDir?: string;
    fetch?: typeof fetch;
  }) {
    this.apiKey = params?.apiKey || process.env.MINIMAX_API_KEY || "";
    this.baseUrl = normalizeMiniMaxBaseUrl(params?.baseUrl || process.env.MINIMAX_BASE_URL);
    this.defaultModel =
      params?.model || process.env.MINIMAX_TEXT_MODEL || process.env.MINIMAX_IMAGE_MODEL || "MiniMax-M3";
    this.uploadDir = params?.uploadDir || process.env.UPLOAD_DIR || "./uploads";
    this.fetchImpl = params?.fetch || globalThis.fetch;
    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
      fetch: createMiniMaxFetch(this.fetchImpl),
    });
  }

  async generateText(prompt: string, options?: TextOptions): Promise<string> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (options?.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }

    const content: Array<OpenAI.Chat.ChatCompletionContentPart | MiniMaxVideoContentPart> = [
      { type: "text", text: prompt },
    ];
    for (const imagePath of options?.images ?? []) {
      const reference = prepareReferenceImage(imagePath);
      if (!reference) continue;
      content.push({
        type: "image_url",
        image_url: { url: reference.image_file },
      });
    }
    for (const videoPath of options?.videos ?? []) {
      const videoUrl = prepareVideoInput(videoPath);
      if (!videoUrl) continue;
      content.push({
        type: "video_url",
        video_url: { url: videoUrl, detail: "default", fps: 1 },
      });
    }
    messages.push({
      role: "user",
      content: content as OpenAI.Chat.ChatCompletionContentPart[],
    });

    const response = await this.client.chat.completions.create({
      model: options?.model || this.defaultModel,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_completion_tokens: options?.maxTokens,
    });

    return stripMiniMaxThinking(response.choices[0]?.message?.content || "");
  }

  async generateImage(prompt: string, options?: ImageOptions): Promise<string> {
    const selectedReference = prepareFirstMiniMaxReference(
      options?.referenceImages ?? [],
      options?.referenceLabels,
      prepareReferenceImage,
    );
    const references = selectedReference ? [selectedReference] : [];

    const body: Record<string, unknown> = {
      model: options?.model || this.defaultModel || "image-01",
      prompt: prepareImagePrompt(prompt, references),
      response_format: "base64",
      n: 1,
    };

    if (options?.aspectRatio && SUPPORTED_ASPECT_RATIOS.has(options.aspectRatio)) {
      body.aspect_ratio = options.aspectRatio;
    } else {
      const dimensions = parseImageSize(options?.size);
      if (dimensions) {
        body.width = dimensions.width;
        body.height = dimensions.height;
      } else {
        body.aspect_ratio = "16:9";
      }
    }

    if (references.length > 0) {
      body.subject_reference = references.map(({ type, image_file }) => ({
        type,
        image_file,
      }));
    }

    const requestImage = async (
      requestBody: Record<string, unknown>,
    ): Promise<MiniMaxImageApiResponse> => {
      const response = await this.fetchImpl(
        buildMiniMaxApiUrl(this.baseUrl, "image_generation"),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const details = await response.text().catch(() => "");
        throw new Error(
          `MiniMax image request failed: ${response.status} ${details.slice(0, 300)}`,
        );
      }
      return (await response.json()) as MiniMaxImageApiResponse;
    };

    let imageResponse = await requestImage(body);
    if (shouldRetryMiniMaxImageWithoutReference(imageResponse, references.length > 0)) {
      const fallbackBody: Record<string, unknown> = {
        ...body,
        prompt: compactMiniMaxImagePrompt(prompt),
      };
      delete fallbackBody.subject_reference;
      imageResponse = await requestImage(fallbackBody);
    }

    const result = selectMiniMaxImageResult(imageResponse);
    let buffer: Buffer;
    let mimeType: string | undefined;

    if (result.type === "base64" || result.value.startsWith("data:image/")) {
      ({ buffer, mimeType } = decodeBase64Image(result.value));
    } else {
      const imageResponse = await this.fetchImpl(result.value);
      if (!imageResponse.ok) {
        throw new Error(`MiniMax image download failed: ${imageResponse.status}`);
      }
      buffer = Buffer.from(await imageResponse.arrayBuffer());
      mimeType = imageResponse.headers.get("content-type") || undefined;
    }

    const directory = path.join(this.uploadDir, "frames");
    fs.mkdirSync(directory, { recursive: true });
    const filePath = path.join(directory, `${genId()}.${imageExtension(buffer, mimeType)}`);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }
}
