import path from "node:path";

export const DEFAULT_MAX_IMPORTED_VIDEO_BYTES = 250 * 1024 * 1024;

export const SUPPORTED_IMPORTED_VIDEO_FORMATS = ["mp4", "webm", "mov"] as const;

export type ImportedVideoFormat =
  (typeof SUPPORTED_IMPORTED_VIDEO_FORMATS)[number];

type VideoFormatRule = {
  extension: `.${ImportedVideoFormat}`;
  mimeTypes: readonly string[];
};

const FORMAT_RULES: Record<ImportedVideoFormat, VideoFormatRule> = {
  mp4: {
    extension: ".mp4",
    mimeTypes: ["video/mp4", "application/mp4"],
  },
  webm: {
    extension: ".webm",
    mimeTypes: ["video/webm"],
  },
  mov: {
    extension: ".mov",
    mimeTypes: ["video/quicktime", "video/x-quicktime", "video/mov"],
  },
};

const GENERIC_UPLOAD_MIME_TYPES = new Set(["", "application/octet-stream"]);

export type VideoUploadValidationResult =
  | {
      ok: true;
      format: ImportedVideoFormat;
      extension: `.${ImportedVideoFormat}`;
      mimeType: string;
    }
  | {
      ok: false;
      code:
        | "EMPTY_FILE"
        | "FILE_TOO_LARGE"
        | "UNSUPPORTED_EXTENSION"
        | "UNSUPPORTED_MIME_TYPE"
        | "INVALID_FILE_SIGNATURE";
      error: string;
    };

export function getMaxImportedVideoBytes(
  configuredValue = process.env.MAX_IMPORTED_VIDEO_BYTES,
): number {
  if (!configuredValue) return DEFAULT_MAX_IMPORTED_VIDEO_BYTES;

  const parsed = Number(configuredValue);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return DEFAULT_MAX_IMPORTED_VIDEO_BYTES;
  }
  return parsed;
}

export function formatBytes(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)} MB`;
}

function normalizeMimeType(mimeType: string): string {
  return mimeType.split(";", 1)[0].trim().toLowerCase();
}

function hasIsoBaseMediaSignature(header: Uint8Array): boolean {
  return (
    header.length >= 12 &&
    header[4] === 0x66 &&
    header[5] === 0x74 &&
    header[6] === 0x79 &&
    header[7] === 0x70
  );
}

function hasWebmSignature(header: Uint8Array): boolean {
  return (
    header.length >= 4 &&
    header[0] === 0x1a &&
    header[1] === 0x45 &&
    header[2] === 0xdf &&
    header[3] === 0xa3
  );
}

function hasExpectedSignature(
  format: ImportedVideoFormat,
  header: Uint8Array,
): boolean {
  return format === "webm"
    ? hasWebmSignature(header)
    : hasIsoBaseMediaSignature(header);
}

export function validateImportedVideo(input: {
  filename: string;
  mimeType: string;
  size: number;
  header: Uint8Array;
  maxBytes?: number;
}): VideoUploadValidationResult {
  const maxBytes = input.maxBytes ?? getMaxImportedVideoBytes();

  if (!Number.isFinite(input.size) || input.size <= 0) {
    return { ok: false, code: "EMPTY_FILE", error: "视频文件为空" };
  }
  if (input.size > maxBytes) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      error: `视频文件不能超过 ${formatBytes(maxBytes)}`,
    };
  }

  const extension = path.extname(input.filename).toLowerCase();
  const format = SUPPORTED_IMPORTED_VIDEO_FORMATS.find(
    (candidate) => FORMAT_RULES[candidate].extension === extension,
  );
  if (!format) {
    return {
      ok: false,
      code: "UNSUPPORTED_EXTENSION",
      error: "仅支持 MP4、WebM 或 MOV 视频文件",
    };
  }

  const mimeType = normalizeMimeType(input.mimeType);
  const declaredMimeIsGeneric = GENERIC_UPLOAD_MIME_TYPES.has(mimeType);
  if (
    !declaredMimeIsGeneric &&
    !FORMAT_RULES[format].mimeTypes.includes(mimeType)
  ) {
    return {
      ok: false,
      code: "UNSUPPORTED_MIME_TYPE",
      error: `文件类型与 .${format} 扩展名不匹配`,
    };
  }

  if (!hasExpectedSignature(format, input.header)) {
    return {
      ok: false,
      code: "INVALID_FILE_SIGNATURE",
      error: "文件内容不是有效的受支持视频格式",
    };
  }

  return {
    ok: true,
    format,
    extension: FORMAT_RULES[format].extension,
    mimeType: declaredMimeIsGeneric
      ? FORMAT_RULES[format].mimeTypes[0]
      : mimeType,
  };
}

function assertSafeStorageSegment(value: string, label: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new Error(`${label} contains unsafe path characters`);
  }
  return value;
}

function assertPathInsideRoot(root: string, candidate: string): void {
  const relative = path.relative(root, candidate);
  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error("Imported video path escapes upload directory");
  }
}

export function resolveImportedVideoStorage(input: {
  uploadDir: string;
  projectId: string;
  versionLabel?: string | null;
  shotId: string;
  filename: string;
}): { absolutePath: string; fileUrl: string; directory: string } {
  const projectId = assertSafeStorageSegment(input.projectId, "projectId");
  const shotId = assertSafeStorageSegment(input.shotId, "shotId");
  const versionLabel = assertSafeStorageSegment(
    input.versionLabel || "unversioned",
    "versionLabel",
  );
  if (!/^[A-Za-z0-9_-]{1,128}\.(mp4|webm|mov)$/.test(input.filename)) {
    throw new Error("filename contains unsafe path characters");
  }
  const filename = input.filename;

  const relativeSegments = [
    "projects",
    projectId,
    versionLabel,
    "videos",
    "imported",
    shotId,
  ];
  const uploadRoot = path.resolve(input.uploadDir);
  const directory = path.resolve(uploadRoot, ...relativeSegments);
  const absolutePath = path.resolve(directory, filename);
  assertPathInsideRoot(uploadRoot, directory);
  assertPathInsideRoot(uploadRoot, absolutePath);

  return {
    absolutePath,
    directory,
    fileUrl: path.join(input.uploadDir, ...relativeSegments, filename),
  };
}

export function importedVideoConstraints(maxBytes = getMaxImportedVideoBytes()) {
  return {
    formats: [...SUPPORTED_IMPORTED_VIDEO_FORMATS],
    maxBytes,
    maxSizeLabel: formatBytes(maxBytes),
  };
}
