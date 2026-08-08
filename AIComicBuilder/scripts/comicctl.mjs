#!/usr/bin/env node

import fs from "node:fs";

const DEFAULT_BASE_URL = "http://127.0.0.1:3100";
const CLI_ENV_KEYS = new Set([
  "COMICCTL_BASE_URL",
  "COMICCTL_USER_ID",
  "COMICCTL_PROVIDER_PROFILE",
]);

function loadLocalCliEnv() {
  const filePath = process.env.COMICCTL_ENV_FILE || ".env.local";
  let source;
  try {
    source = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return;
    fail(`Cannot read CLI environment file: ${error instanceof Error ? error.message : error}`, 2);
  }

  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || !CLI_ENV_KEYS.has(match[1]) || process.env[match[1]]?.trim()) continue;

    let value = match[2];
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }
    if (value) process.env[match[1]] = value;
  }
}

function usage() {
  return `comicctl - local Codex control surface for AIComicBuilder

Usage:
  comicctl project list
  comicctl project create --title <name> [--script-file <path>]
  comicctl episode list --project <project-id>
  comicctl episode create --project <project-id> --title <name>
  comicctl profiles
  comicctl status --project <project-id>
  comicctl run plan --project <project-id> --action <action> [options]
  comicctl run get <run-id>
  comicctl run approve <run-id>
  comicctl run execute <run-id>
  comicctl run retry <run-id>
  comicctl run cancel <run-id>

Run plan options:
  --episode <episode-id>
  --payload-file <json-file>
  --profile <server-profile-id>
  --idempotency-key <key>
  --no-approval
  --live                 Allow execution after approval (default is dry-run)

Environment:
  COMICCTL_BASE_URL      Default: ${DEFAULT_BASE_URL}
  COMICCTL_USER_ID       Required local AIComicBuilder user ID
  COMICCTL_PROVIDER_PROFILE  Default provider profile for run plans

API keys are intentionally not accepted as command-line arguments.`;
}

function fail(message, exitCode = 1) {
  process.stderr.write(`${JSON.stringify({ error: message }, null, 2)}\n`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      positional.push(value);
      continue;
    }
    const key = value.slice(2);
    if (/(?:api-?key|token|secret)/i.test(key)) {
      fail("Secrets are not accepted as CLI arguments. Configure them in .env.local.", 2);
    }
    if (["live", "no-approval", "help"].includes(key)) {
      flags[key] = true;
      continue;
    }
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) fail(`Missing value for --${key}`, 2);
    flags[key] = next;
    index += 1;
  }
  return { positional, flags };
}

function required(flags, key) {
  const value = flags[key];
  if (typeof value !== "string" || !value.trim()) fail(`--${key} is required`, 2);
  return value.trim();
}

function apiContext() {
  const baseUrl = (process.env.COMICCTL_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const userId = process.env.COMICCTL_USER_ID?.trim();
  if (!userId) {
    fail("COMICCTL_USER_ID is required. Do not pass it or any API key on the command line.", 2);
  }
  return { baseUrl, userId };
}

async function api(pathname, options = {}) {
  const { baseUrl, userId } = apiContext();
  const headers = new Headers(options.headers);
  headers.set("accept", "application/json");
  headers.set("x-user-id", userId);
  if (options.body !== undefined) headers.set("content-type", "application/json");

  let response;
  try {
    response = await fetch(`${baseUrl}${pathname}`, {
      ...options,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    fail(`Cannot reach AIComicBuilder at ${baseUrl}: ${error instanceof Error ? error.message : error}`);
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { output: text };
    }
  }
  if (!response.ok) {
    const message = data?.error || data?.message || `HTTP ${response.status}`;
    fail(message);
  }
  return data;
}

function readPayloadFile(filePath) {
  if (!filePath) return {};
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    fail(`Cannot read payload file: ${error instanceof Error ? error.message : error}`, 2);
  }
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      fail("Payload file must contain a JSON object", 2);
    }
    return value;
  } catch (error) {
    fail(`Payload file is not valid JSON: ${error instanceof Error ? error.message : error}`, 2);
  }
}

function summarizeProject(project) {
  const shots = Array.isArray(project.shots) ? project.shots : [];
  const activeAssets = shots.flatMap((shot) =>
    (Array.isArray(shot.assets) ? shot.assets : []).filter((asset) => asset.isActive),
  );
  const assetsByType = {};
  const assetsByStatus = {};
  for (const asset of activeAssets) {
    assetsByType[asset.type] = (assetsByType[asset.type] || 0) + 1;
    assetsByStatus[asset.status] = (assetsByStatus[asset.status] || 0) + 1;
  }
  return {
    projectId: project.id,
    title: project.title,
    status: project.status,
    generationMode: project.generationMode,
    episodeCount: Array.isArray(project.episodes) ? project.episodes.length : 0,
    characterCount: Array.isArray(project.characters) ? project.characters.length : 0,
    shotCount: shots.length,
    activeAssets: activeAssets.length,
    assetsByType,
    assetsByStatus,
    versions: Array.isArray(project.versions) ? project.versions : [],
  };
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  if (flags.help || positional.length === 0 || positional[0] === "help") {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const [scope, command, id] = positional;
  let result;

  if (scope === "project" && command === "list") {
    result = await api("/api/projects");
  } else if (scope === "project" && command === "create") {
    const title = required(flags, "title");
    const script = flags["script-file"]
      ? fs.readFileSync(String(flags["script-file"]), "utf8")
      : undefined;
    result = await api("/api/projects", {
      method: "POST",
      body: { title, ...(script !== undefined && { script }) },
    });
  } else if (scope === "episode" && command === "list") {
    const projectId = required(flags, "project");
    result = await api(`/api/projects/${encodeURIComponent(projectId)}/episodes`);
  } else if (scope === "episode" && command === "create") {
    const projectId = required(flags, "project");
    const title = required(flags, "title");
    result = await api(`/api/projects/${encodeURIComponent(projectId)}/episodes`, {
      method: "POST",
      body: {
        title,
        ...(typeof flags.description === "string" && { description: flags.description }),
        ...(typeof flags.keywords === "string" && { keywords: flags.keywords }),
      },
    });
  } else if (scope === "profiles") {
    result = await api("/api/models/server-profiles");
  } else if (scope === "status") {
    const projectId = required(flags, "project");
    result = summarizeProject(await api(`/api/projects/${encodeURIComponent(projectId)}`));
  } else if (scope === "run" && command === "plan") {
    const projectId = required(flags, "project");
    const action = required(flags, "action");
    const providerProfileId =
      (typeof flags.profile === "string" && flags.profile.trim()) ||
      process.env.COMICCTL_PROVIDER_PROFILE?.trim() ||
      undefined;
    result = await api("/api/orchestrator/runs", {
      method: "POST",
      body: {
        projectId,
        action,
        payload: readPayloadFile(flags["payload-file"]),
        ...(typeof flags.episode === "string" && { episodeId: flags.episode }),
        ...(providerProfileId && { providerProfileId }),
        ...(typeof flags["idempotency-key"] === "string" && {
          idempotencyKey: flags["idempotency-key"],
        }),
        requiresApproval: !flags["no-approval"],
        dryRun: !flags.live,
      },
    });
  } else if (scope === "run" && command === "get" && id) {
    result = await api(`/api/orchestrator/runs/${encodeURIComponent(id)}`);
  } else if (
    scope === "run" &&
    ["approve", "execute", "retry", "cancel"].includes(command) &&
    id
  ) {
    result = await api(`/api/orchestrator/runs/${encodeURIComponent(id)}/resume`, {
      method: "POST",
      body: { action: command },
    });
  } else {
    fail(`Unknown command.\n\n${usage()}`, 2);
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

loadLocalCliEnv();
main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
