export const ORCHESTRATOR_ACTION_SPECS = {
  script_outline: { resourceClass: "text", mutatesProject: true },
  script_generate: { resourceClass: "text", mutatesProject: true },
  script_parse: { resourceClass: "text", mutatesProject: true },
  character_extract: { resourceClass: "text", mutatesProject: true },
  single_character_image: { resourceClass: "image", mutatesProject: true },
  batch_character_image: { resourceClass: "image", mutatesProject: true },
  shot_split: { resourceClass: "text", mutatesProject: true },
  generate_keyframe_prompts: { resourceClass: "text", mutatesProject: true },
  single_shot_rewrite: { resourceClass: "text", mutatesProject: true },
  batch_frame_generate: { resourceClass: "image", mutatesProject: true },
  single_frame_generate: { resourceClass: "image", mutatesProject: true },
  single_video_generate: { resourceClass: "video", mutatesProject: true },
  batch_video_generate: { resourceClass: "video", mutatesProject: true },
  single_scene_frame: { resourceClass: "image", mutatesProject: true },
  batch_scene_frame: { resourceClass: "image", mutatesProject: true },
  single_reference_video: { resourceClass: "video", mutatesProject: true },
  batch_reference_video: { resourceClass: "video", mutatesProject: true },
  single_video_prompt: { resourceClass: "text", mutatesProject: true },
  batch_video_prompt: { resourceClass: "text", mutatesProject: true },
  ai_optimize_text: { resourceClass: "text", mutatesProject: false },
  video_assemble: { resourceClass: "local", mutatesProject: true },
  batch_ref_image_generate: { resourceClass: "image", mutatesProject: true },
  single_ref_image_generate: { resourceClass: "image", mutatesProject: true },
  generate_ref_prompts: { resourceClass: "text", mutatesProject: true },
  single_ref_image_generate_all: {
    resourceClass: "image",
    mutatesProject: true,
  },
} as const;

export type OrchestratorAction = keyof typeof ORCHESTRATOR_ACTION_SPECS;
export type ResumeAction = "approve" | "execute" | "retry" | "cancel";

export interface CreateRunInput {
  projectId: string;
  episodeId?: string;
  action: OrchestratorAction;
  payload: Record<string, unknown>;
  providerProfileId?: string;
  idempotencyKey?: string;
  requiresApproval: boolean;
  dryRun: boolean;
  maxRetries: number;
}

export interface ListRunsInput {
  projectId?: string;
  limit: number;
}

export function isOrchestratorAction(
  value: string,
): value is OrchestratorAction {
  return Object.prototype.hasOwnProperty.call(
    ORCHESTRATOR_ACTION_SPECS,
    value,
  );
}

