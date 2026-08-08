import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  DEFAULT_MAX_IMPORTED_VIDEO_BYTES,
  getMaxImportedVideoBytes,
  importedVideoConstraints,
  resolveImportedVideoStorage,
  validateImportedVideo,
} from "./video-import.ts";

function isoBaseMediaHeader() {
  return Uint8Array.from([
    0x00, 0x00, 0x00, 0x18,
    0x66, 0x74, 0x79, 0x70,
    0x69, 0x73, 0x6f, 0x6d,
    0x00, 0x00, 0x00, 0x00,
  ]);
}

function webmHeader() {
  return Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]);
}

test("accepts MP4, WebM and MOV when extension, MIME and signature agree", () => {
  const cases = [
    {
      filename: "clip.mp4",
      mimeType: "video/mp4",
      header: isoBaseMediaHeader(),
      format: "mp4",
    },
    {
      filename: "clip.WEBM",
      mimeType: "video/webm; codecs=vp9",
      header: webmHeader(),
      format: "webm",
    },
    {
      filename: "clip.mov",
      mimeType: "video/quicktime",
      header: isoBaseMediaHeader(),
      format: "mov",
    },
  ];

  for (const candidate of cases) {
    const result = validateImportedVideo({
      ...candidate,
      size: 1024,
      maxBytes: 2048,
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.format, candidate.format);
  }
});

test("accepts generic browser MIME values only after signature validation", () => {
  const emptyMime = validateImportedVideo({
    filename: "clip.mp4",
    mimeType: "",
    size: 1024,
    header: isoBaseMediaHeader(),
    maxBytes: 2048,
  });
  assert.equal(emptyMime.ok, true);
  if (emptyMime.ok) assert.equal(emptyMime.mimeType, "video/mp4");

  const octetStream = validateImportedVideo({
    filename: "clip.mov",
    mimeType: "application/octet-stream",
    size: 1024,
    header: isoBaseMediaHeader(),
    maxBytes: 2048,
  });
  assert.equal(octetStream.ok, true);
  if (octetStream.ok) assert.equal(octetStream.mimeType, "video/quicktime");

  const spoofed = validateImportedVideo({
    filename: "image.mp4",
    mimeType: "application/octet-stream",
    size: 1024,
    header: Uint8Array.from([0x89, 0x50, 0x4e, 0x47]),
    maxBytes: 2048,
  });
  assert.equal(spoofed.ok, false);
  if (!spoofed.ok) assert.equal(spoofed.code, "INVALID_FILE_SIGNATURE");
});

test("rejects unsupported extensions and extension/MIME mismatches", () => {
  const unsupported = validateImportedVideo({
    filename: "clip.avi",
    mimeType: "video/x-msvideo",
    size: 1024,
    header: isoBaseMediaHeader(),
    maxBytes: 2048,
  });
  assert.deepEqual(
    { ok: unsupported.ok, code: unsupported.ok ? undefined : unsupported.code },
    { ok: false, code: "UNSUPPORTED_EXTENSION" },
  );

  const mismatch = validateImportedVideo({
    filename: "clip.mp4",
    mimeType: "video/webm",
    size: 1024,
    header: isoBaseMediaHeader(),
    maxBytes: 2048,
  });
  assert.deepEqual(
    { ok: mismatch.ok, code: mismatch.ok ? undefined : mismatch.code },
    { ok: false, code: "UNSUPPORTED_MIME_TYPE" },
  );
});

test("rejects spoofed, empty and oversized files", () => {
  const spoofed = validateImportedVideo({
    filename: "not-a-video.mp4",
    mimeType: "video/mp4",
    size: 1024,
    header: Uint8Array.from([0x89, 0x50, 0x4e, 0x47]),
    maxBytes: 2048,
  });
  assert.equal(spoofed.ok, false);
  if (!spoofed.ok) assert.equal(spoofed.code, "INVALID_FILE_SIGNATURE");

  const empty = validateImportedVideo({
    filename: "empty.mp4",
    mimeType: "video/mp4",
    size: 0,
    header: new Uint8Array(),
    maxBytes: 2048,
  });
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.equal(empty.code, "EMPTY_FILE");

  const oversized = validateImportedVideo({
    filename: "large.mp4",
    mimeType: "video/mp4",
    size: 2049,
    header: isoBaseMediaHeader(),
    maxBytes: 2048,
  });
  assert.equal(oversized.ok, false);
  if (!oversized.ok) assert.equal(oversized.code, "FILE_TOO_LARGE");
});

test("builds an isolated, versioned shot path under the upload root", () => {
  const uploadDir = path.join(".", "uploads-test");
  const result = resolveImportedVideoStorage({
    uploadDir,
    projectId: "project_123",
    versionLabel: "20260808-V2",
    shotId: "shot-456",
    filename: "generated_789.mp4",
  });
  const root = path.resolve(uploadDir);
  assert.equal(path.relative(root, result.absolutePath).startsWith(".."), false);
  assert.equal(
    result.fileUrl,
    path.join(
      uploadDir,
      "projects",
      "project_123",
      "20260808-V2",
      "videos",
      "imported",
      "shot-456",
      "generated_789.mp4",
    ),
  );
});

test("rejects traversal and unsafe storage segments", () => {
  assert.throws(() =>
    resolveImportedVideoStorage({
      uploadDir: "./uploads-test",
      projectId: "../outside",
      shotId: "shot-1",
      filename: "video.mp4",
    }),
  );
  assert.throws(() =>
    resolveImportedVideoStorage({
      uploadDir: "./uploads-test",
      projectId: "project-1",
      shotId: "shot-1",
      filename: "../video.mp4",
    }),
  );
});

test("uses a safe default for invalid configured limits and exposes constraints", () => {
  assert.equal(getMaxImportedVideoBytes("invalid"), DEFAULT_MAX_IMPORTED_VIDEO_BYTES);
  assert.equal(getMaxImportedVideoBytes("0"), DEFAULT_MAX_IMPORTED_VIDEO_BYTES);
  assert.equal(getMaxImportedVideoBytes("1048576"), 1048576);
  assert.deepEqual(importedVideoConstraints(1048576), {
    formats: ["mp4", "webm", "mov"],
    maxBytes: 1048576,
    maxSizeLabel: "1 MB",
  });
});
