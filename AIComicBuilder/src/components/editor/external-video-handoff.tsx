"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Upload,
  Waypoints,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";
import { uploadUrl } from "@/lib/utils/upload-url";

interface ExternalVideoHandoffProps {
  projectId: string;
  shotId: string;
  generationMode: "keyframe" | "reference";
  videoRatio: string;
  duration: number;
  videoPrompt: string | null;
  firstFrameUrl: string | null;
  lastFrameUrl: string | null;
  referenceFrameUrl?: string | null;
  onImported: () => void | Promise<void>;
}

const SUPPORTED_RATIOS = ["9:16", "16:9", "1:1", "4:3", "3:4", "3:2", "2:3", "21:9"] as const;

function nearestSupportedRatio(width: number, height: number): string | null {
  if (width <= 0 || height <= 0) return null;
  const aspect = width / height;
  return SUPPORTED_RATIOS.reduce((nearest, candidate) => {
    const [candidateWidth, candidateHeight] = candidate.split(":").map(Number);
    const candidateAspect = candidateWidth / candidateHeight;
    const [nearestWidth, nearestHeight] = nearest.split(":").map(Number);
    const nearestAspect = nearestWidth / nearestHeight;
    return Math.abs(Math.log(aspect / candidateAspect)) < Math.abs(Math.log(aspect / nearestAspect))
      ? candidate
      : nearest;
  });
}

export function ExternalVideoHandoff({
  projectId,
  shotId,
  generationMode,
  videoRatio,
  duration,
  videoPrompt,
  firstFrameUrl,
  lastFrameUrl,
  referenceFrameUrl,
  onImported,
}: ExternalVideoHandoffProps) {
  const t = useTranslations();
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [importing, setImporting] = useState(false);
  const prompt = videoPrompt?.trim() ?? "";
  const ratioFrameUrl = generationMode === "reference"
    ? referenceFrameUrl
    : firstFrameUrl || lastFrameUrl;
  const [detectedRatio, setDetectedRatio] = useState<{ source: string; ratio: string } | null>(null);

  useEffect(() => {
    if (!ratioFrameUrl) return;
    let active = true;
    const image = new window.Image();
    image.onload = () => {
      if (!active) return;
      setDetectedRatio({
        source: ratioFrameUrl,
        ratio: nearestSupportedRatio(image.naturalWidth, image.naturalHeight) ?? videoRatio,
      });
    };
    image.onerror = () => {
      if (active) setDetectedRatio({ source: ratioFrameUrl, ratio: videoRatio });
    };
    image.src = uploadUrl(ratioFrameUrl);
    return () => {
      active = false;
    };
  }, [ratioFrameUrl, videoRatio]);

  const resolvedRatio = ratioFrameUrl
    ? detectedRatio?.source === ratioFrameUrl ? detectedRatio.ratio : null
    : videoRatio;

  async function copyPrompt() {
    if (!prompt) {
      toast.error(t("shot.externalPromptMissing"));
      return;
    }

    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success(t("shot.externalPromptCopied"));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("shot.externalPromptCopyFailed"));
    }
  }

  async function importVideo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("video/") && !/\.(mp4|webm|mov)$/i.test(file.name)) {
      toast.error(t("shot.externalVideoFileInvalid"));
      return;
    }

    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("generationMode", generationMode);
      await apiFetch(`/api/projects/${projectId}/shots/${shotId}/import-video`, {
        method: "POST",
        body: form,
      });
      await onImported();
      toast.success(t("shot.externalImportSuccess"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.uploadFailed"));
    } finally {
      setImporting(false);
    }
  }

  const frames = generationMode === "reference"
    ? [{ label: t("shot.sceneRefFrame"), src: referenceFrameUrl ?? null }]
    : [
        { label: t("shot.firstFrame"), src: firstFrameUrl },
        { label: t("shot.lastFrame"), src: lastFrameUrl },
      ];

  return (
    <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/50 p-3">
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
          <Waypoints className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-xs font-semibold text-violet-950">{t("shot.externalHandoff")}</p>
            <span
              className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700"
              title={ratioFrameUrl && resolvedRatio ? t("shot.externalRatioDetected") : undefined}
            >
              {resolvedRatio ?? t("shot.externalRatioDetecting")} · {t("shot.externalDuration", { duration })}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-violet-800/75">
            {t("shot.externalHandoffHelp")}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2 rounded-lg border border-violet-100 bg-white/80 p-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-semibold text-violet-700">1</span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-[--text-primary]">{t("shot.externalCopyStep")}</p>
            {!prompt && (
              <p className="mt-0.5 text-[10px] text-amber-700">{t("shot.externalPromptMissing")}</p>
            )}
          </div>
          <Button size="xs" variant="outline" onClick={copyPrompt} disabled={!prompt}>
            {copied ? <Check className="text-emerald-600" /> : <Copy />}
            {copied ? t("shot.externalCopied") : t("shot.copyPrompt")}
          </Button>
        </div>

        <div className="rounded-lg border border-violet-100 bg-white/80 p-2">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-semibold text-violet-700">2</span>
            <p className="text-[11px] font-medium text-[--text-primary]">
              {generationMode === "reference" ? t("shot.externalReferenceFrameStep") : t("shot.externalFramesStep")}
            </p>
          </div>
          <div className={`mt-2 grid gap-2 ${frames.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {frames.map((frame) => (
              <div key={frame.label} className="rounded-md bg-[--surface] px-2 py-1.5">
                <p className="text-[10px] font-medium text-[--text-secondary]">{frame.label}</p>
                {frame.src ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    <a
                      href={uploadUrl(frame.src)}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(buttonVariants({ variant: "ghost", size: "xs" }), "h-6 px-1.5 text-[10px]")}
                    >
                      <ExternalLink />
                      {t("shot.externalOpenOriginal")}
                    </a>
                    <a
                      href={uploadUrl(frame.src)}
                      download
                      className={cn(buttonVariants({ variant: "ghost", size: "xs" }), "h-6 px-1.5 text-[10px]")}
                    >
                      <Download />
                      {t("shot.externalDownloadOriginal")}
                    </a>
                  </div>
                ) : (
                  <p className="mt-1 text-[10px] text-amber-700">{t("shot.externalFrameMissing")}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-violet-100 bg-white/80 p-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-semibold text-violet-700">3</span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-[--text-primary]">{t("shot.externalImportStep")}</p>
            <p className="mt-0.5 text-[10px] text-[--text-muted]">{t("shot.externalImportFormatHint")}</p>
          </div>
          <Button size="xs" onClick={() => inputRef.current?.click()} disabled={importing}>
            {importing ? <Loader2 className="animate-spin" /> : <Upload />}
            {importing ? t("shot.externalImporting") : t("shot.externalImportVideo")}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,.mov"
            className="hidden"
            aria-label={t("shot.externalImportVideo")}
            onChange={importVideo}
          />
        </div>
      </div>
    </div>
  );
}
