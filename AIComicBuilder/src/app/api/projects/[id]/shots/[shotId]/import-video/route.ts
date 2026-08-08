import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  episodes,
  shots,
  storyboardVersions,
} from "@/lib/db/schema";
import { id as genId } from "@/lib/id";
import { assertProjectOwnership } from "@/lib/assert-project-ownership";
import {
  getActiveAsset,
  insertAssetVersion,
  type ShotAssetRow,
  type ShotAssetType,
} from "@/lib/shot-asset-utils";
import {
  getMaxImportedVideoBytes,
  importedVideoConstraints,
  resolveImportedVideoStorage,
  validateImportedVideo,
} from "@/lib/video-import";

export const runtime = "nodejs";

type GenerationMode = "keyframe" | "reference";

const globalForVideoImports = globalThis as unknown as {
  activeVideoImports?: Set<string>;
};
const activeVideoImports =
  globalForVideoImports.activeVideoImports ?? new Set<string>();
globalForVideoImports.activeVideoImports = activeVideoImports;

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return (
    value !== null &&
    typeof value !== "string" &&
    typeof value.arrayBuffer === "function" &&
    typeof value.slice === "function"
  );
}

function modeLabel(mode: GenerationMode): string {
  return mode === "reference" ? "参考图" : "关键帧";
}

function errorResponse(
  error: string,
  status: number,
  code: string,
  maxBytes: number,
) {
  return NextResponse.json(
    {
      error,
      code,
      constraints: importedVideoConstraints(maxBytes),
    },
    { status },
  );
}

function safeOriginalFilename(filename: string): string {
  return filename
    .replace(/^.*[\\/]/, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 255);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; shotId: string }> },
) {
  const { id: projectId, shotId } = await params;
  const maxBytes = getMaxImportedVideoBytes();
  const project = await assertProjectOwnership(request, projectId);
  if (!project) {
    return errorResponse("项目或镜头不存在", 404, "NOT_FOUND", maxBytes);
  }

  const [shot] = await db
    .select({
      id: shots.id,
      episodeId: shots.episodeId,
      versionId: shots.versionId,
      videoPrompt: shots.videoPrompt,
    })
    .from(shots)
    .where(and(eq(shots.id, shotId), eq(shots.projectId, projectId)));
  if (!shot) {
    return errorResponse("项目或镜头不存在", 404, "NOT_FOUND", maxBytes);
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!/^multipart\/form-data(?:;|$)/.test(contentType)) {
    return errorResponse(
      "请使用 multipart/form-data 上传视频",
      415,
      "INVALID_CONTENT_TYPE",
      maxBytes,
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  const multipartOverheadAllowance = 1024 * 1024;
  if (
    Number.isFinite(contentLength) &&
    contentLength > maxBytes + multipartOverheadAllowance
  ) {
    return errorResponse(
      `视频文件不能超过 ${importedVideoConstraints(maxBytes).maxSizeLabel}`,
      413,
      "FILE_TOO_LARGE",
      maxBytes,
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(
      "无法读取上传内容，请重新选择视频",
      400,
      "INVALID_MULTIPART_BODY",
      maxBytes,
    );
  }

  const file = formData.get("file");
  if (!isUploadedFile(file)) {
    return errorResponse("请选择要导入的视频文件", 400, "MISSING_FILE", maxBytes);
  }

  let generationMode: GenerationMode = project.generationMode;
  if (shot.episodeId) {
    const [episode] = await db
      .select({ generationMode: episodes.generationMode })
      .from(episodes)
      .where(
        and(
          eq(episodes.id, shot.episodeId),
          eq(episodes.projectId, projectId),
        ),
      );
    if (!episode) {
      return errorResponse(
        "镜头所属分集不存在",
        404,
        "EPISODE_NOT_FOUND",
        maxBytes,
      );
    }
    generationMode = episode.generationMode;
  }

  const requestedModeEntry = formData.get("generationMode");
  if (
    requestedModeEntry !== null &&
    requestedModeEntry !== "keyframe" &&
    requestedModeEntry !== "reference"
  ) {
    return errorResponse(
      "generationMode 只能是 keyframe 或 reference",
      400,
      "INVALID_GENERATION_MODE",
      maxBytes,
    );
  }
  if (requestedModeEntry && requestedModeEntry !== generationMode) {
    return errorResponse(
      `当前镜头处于${modeLabel(generationMode)}模式，请刷新页面后重试`,
      409,
      "GENERATION_MODE_MISMATCH",
      maxBytes,
    );
  }

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const validation = validateImportedVideo({
    filename: file.name,
    mimeType: file.type,
    size: file.size,
    header,
    maxBytes,
  });
  if (!validation.ok) {
    const status = validation.code === "FILE_TOO_LARGE" ? 413 : 400;
    return errorResponse(validation.error, status, validation.code, maxBytes);
  }

  let versionLabel: string | null = null;
  if (shot.versionId) {
    const [version] = await db
      .select({
        label: storyboardVersions.label,
        projectId: storyboardVersions.projectId,
      })
      .from(storyboardVersions)
      .where(eq(storyboardVersions.id, shot.versionId));
    if (!version || version.projectId !== projectId) {
      return errorResponse(
        "镜头所属分镜版本不存在",
        404,
        "VERSION_NOT_FOUND",
        maxBytes,
      );
    }
    versionLabel = version.label;
  }

  const filename = `${genId()}${validation.extension}`;
  let storage: ReturnType<typeof resolveImportedVideoStorage>;
  try {
    storage = resolveImportedVideoStorage({
      uploadDir: process.env.UPLOAD_DIR || "./uploads",
      projectId,
      versionLabel,
      shotId,
      filename,
    });
  } catch (error) {
    console.error("[ImportVideo] Unsafe storage path rejected", error);
    return errorResponse(
      "无法为视频创建安全的保存路径",
      500,
      "INVALID_STORAGE_PATH",
      maxBytes,
    );
  }

  const assetType: ShotAssetType =
    generationMode === "reference" ? "reference_video" : "keyframe_video";
  const importLockKey = `${projectId}:${shotId}:${assetType}`;
  if (activeVideoImports.has(importLockKey)) {
    return errorResponse(
      "这个镜头正在导入视频，请勿重复提交",
      409,
      "IMPORT_IN_PROGRESS",
      maxBytes,
    );
  }
  activeVideoImports.add(importLockKey);
  let insertedAsset: ShotAssetRow | null = null;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength !== file.size) {
      return errorResponse(
        "上传的视频大小发生变化，请重新选择文件",
        400,
        "FILE_SIZE_MISMATCH",
        maxBytes,
      );
    }
    await fs.mkdir(storage.directory, { recursive: true });
    await fs.writeFile(storage.absolutePath, buffer, { flag: "wx" });

    const activeAsset = await getActiveAsset(shotId, assetType, 0);
    insertedAsset = await insertAssetVersion({
      shotId,
      type: assetType,
      sequenceInType: 0,
      prompt: shot.videoPrompt?.trim() || activeAsset?.prompt || "",
      fileUrl: storage.fileUrl,
      status: "completed",
      modelProvider: "external-web",
      modelId: null,
      meta: {
        ...(activeAsset?.meta ?? {}),
        source: "external_web_import",
        originalName: safeOriginalFilename(file.name),
        mimeType: validation.mimeType,
        sizeBytes: file.size,
        importedAt: new Date().toISOString(),
        generationMode,
      },
    });

    try {
      await db
        .update(shots)
        .set({ status: "completed" })
        .where(and(eq(shots.id, shotId), eq(shots.projectId, projectId)));
    } catch (error) {
      // The active completed asset is the source of truth for previews and
      // assembly. Do not report a failed upload (and invite a duplicate retry)
      // after the version has already been stored successfully.
      console.error(
        `[ImportVideo] Asset stored but shot status update failed for ${shotId}`,
        error,
      );
    }
  } catch (error) {
    if (!insertedAsset) {
      await fs.unlink(storage.absolutePath).catch(() => undefined);
    }
    console.error(`[ImportVideo] Failed for shot ${shotId}`, error);
    return errorResponse(
      "视频保存失败，请稍后重试",
      500,
      "IMPORT_FAILED",
      maxBytes,
    );
  } finally {
    activeVideoImports.delete(importLockKey);
  }

  return NextResponse.json(
    {
      ok: true,
      generationMode,
      assetType,
      fileUrl: insertedAsset.fileUrl,
      asset: insertedAsset,
      upload: {
        originalFileName: safeOriginalFilename(file.name),
        mimeType: validation.mimeType,
        sizeBytes: file.size,
      },
      constraints: importedVideoConstraints(maxBytes),
    },
    { status: 201 },
  );
}
