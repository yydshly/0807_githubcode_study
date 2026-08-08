import type { ModelConfigPayload } from "./provider-factory";

const DEFAULT_MINIMAX_BASE_URL = "https://api.minimax.io/v1";
const PROFILE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

type ServerProfiles = Record<string, ModelConfigPayload>;

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeProfile(profile: ModelConfigPayload): ModelConfigPayload {
  const normalizeProvider = (provider: ModelConfigPayload["text"]) => {
    if (!provider) return null;
    const protocol = clean(provider.protocol);
    const baseUrl = clean(provider.baseUrl);
    const apiKey = clean(provider.apiKey);
    const modelId = clean(provider.modelId);
    if (!protocol || !baseUrl || !apiKey || !modelId) {
      throw new Error("Provider profiles require protocol, baseUrl, apiKey, and modelId");
    }
    return {
      protocol,
      baseUrl: baseUrl.replace(/\/+$/, ""),
      apiKey,
      ...(clean(provider.secretKey) && { secretKey: clean(provider.secretKey) }),
      modelId,
    };
  };

  return {
    text: normalizeProvider(profile.text),
    image: normalizeProvider(profile.image),
    video: normalizeProvider(profile.video),
  };
}

function parseJsonProfiles(): ServerProfiles {
  const raw = clean(process.env.AI_PROVIDER_PROFILES_JSON);
  if (!raw) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("AI_PROVIDER_PROFILES_JSON must be valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("AI_PROVIDER_PROFILES_JSON must be an object keyed by profile ID");
  }

  const profiles: ServerProfiles = {};
  for (const [profileId, value] of Object.entries(parsed)) {
    if (!PROFILE_ID_PATTERN.test(profileId)) {
      throw new Error(`Invalid provider profile ID: ${profileId}`);
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Provider profile ${profileId} must be an object`);
    }
    profiles[profileId] = normalizeProfile(value as ModelConfigPayload);
  }
  return profiles;
}

function buildConvenienceProfile(): ModelConfigPayload | null {
  const minimaxApiKey = clean(process.env.MINIMAX_API_KEY);
  const videoApiKey = clean(process.env.COMIC_VIDEO_API_KEY);
  if (!minimaxApiKey && !videoApiKey) return null;

  const minimaxBaseUrl = clean(process.env.MINIMAX_BASE_URL) || DEFAULT_MINIMAX_BASE_URL;
  const profile: ModelConfigPayload = {};

  if (minimaxApiKey) {
    profile.text = {
      protocol: "minimax",
      baseUrl: minimaxBaseUrl,
      apiKey: minimaxApiKey,
      modelId: clean(process.env.MINIMAX_TEXT_MODEL) || "MiniMax-M3",
    };
    profile.image = {
      protocol: "minimax",
      baseUrl: minimaxBaseUrl,
      apiKey: minimaxApiKey,
      modelId: clean(process.env.MINIMAX_IMAGE_MODEL) || "image-01",
    };
  }

  if (videoApiKey) {
    const protocol = clean(process.env.COMIC_VIDEO_PROTOCOL);
    const baseUrl = clean(process.env.COMIC_VIDEO_BASE_URL);
    const modelId = clean(process.env.COMIC_VIDEO_MODEL);
    if (!protocol || !baseUrl || !modelId) {
      throw new Error(
        "COMIC_VIDEO_PROTOCOL, COMIC_VIDEO_BASE_URL, and COMIC_VIDEO_MODEL are required when COMIC_VIDEO_API_KEY is set",
      );
    }
    profile.video = {
      protocol,
      baseUrl,
      apiKey: videoApiKey,
      ...(clean(process.env.COMIC_VIDEO_SECRET_KEY) && {
        secretKey: clean(process.env.COMIC_VIDEO_SECRET_KEY),
      }),
      modelId,
    };
  }

  return normalizeProfile(profile);
}

export function getServerProfiles(): ServerProfiles {
  const profiles: ServerProfiles = {};
  const convenienceProfile = buildConvenienceProfile();
  if (convenienceProfile) {
    const profileId = clean(process.env.COMIC_PROVIDER_PROFILE_ID) || "default";
    if (!PROFILE_ID_PATTERN.test(profileId)) {
      throw new Error(`Invalid COMIC_PROVIDER_PROFILE_ID: ${profileId}`);
    }
    profiles[profileId] = convenienceProfile;
  }
  return { ...profiles, ...parseJsonProfiles() };
}

export function listServerProfiles(): Array<{
  id: string;
  capabilities: Array<"text" | "image" | "video">;
}> {
  return Object.entries(getServerProfiles()).map(([id, profile]) => ({
    id,
    capabilities: (["text", "image", "video"] as const).filter(
      (capability) => Boolean(profile[capability]),
    ),
  }));
}

export function getServerProfile(profileId = "default"): ModelConfigPayload {
  if (!PROFILE_ID_PATTERN.test(profileId)) {
    throw new Error("Invalid provider profile ID");
  }
  const profile = getServerProfiles()[profileId];
  if (!profile) {
    throw new Error(`Server provider profile not found: ${profileId}`);
  }
  return profile;
}

/**
 * Keep the existing browser configuration path working while allowing Codex
 * and other server-side callers to reference a secret-free profile ID.
 */
export function resolveRequestModelConfig(
  clientConfig?: ModelConfigPayload,
  providerProfileId?: string,
): ModelConfigPayload | undefined {
  if (providerProfileId) return getServerProfile(providerProfileId);
  if (clientConfig && (clientConfig.text || clientConfig.image || clientConfig.video)) {
    return clientConfig;
  }

  const defaultProfileId = clean(process.env.COMIC_PROVIDER_PROFILE_ID) || "default";
  const profiles = getServerProfiles();
  return profiles[defaultProfileId];
}
