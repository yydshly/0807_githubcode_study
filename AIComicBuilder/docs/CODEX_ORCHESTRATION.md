# Codex orchestration

This project can use Codex as a local control plane while AIComicBuilder remains
the source of truth for projects, shots, tasks, and generated assets.

## Safety model

- Codex calls `comicctl`; it does not edit SQLite directly.
- API keys stay in `.env.local` or `AI_PROVIDER_PROFILES_JSON` on the server.
- `comicctl run plan` is a dry-run unless `--live` is explicitly supplied.
- Media stages require approval by default.
- Start with one shot. Keep provider concurrency at 2-3 and retain one slot for
  inspection or retry work.
- A timeout is not permission to resubmit a paid video task. Query the original
  provider task first.

The MVP is local-only. `x-user-id` is trusted by the current application and is
not authentication suitable for a public deployment.

## Configure

Copy the relevant values from `.env.example` into `.env.local`. For MiniMax:

```dotenv
COMIC_PROVIDER_PROFILE_ID=default
MINIMAX_API_KEY=your-token-plan-key
MINIMAX_BASE_URL=https://api.minimax.io/v1
MINIMAX_TEXT_MODEL=MiniMax-M3
MINIMAX_IMAGE_MODEL=image-01
```

Use `https://api.minimaxi.com/v1` for a mainland-China account. Do not paste the
key into a Codex prompt or a shell command.

Set `COMICCTL_USER_ID` to the same local user ID used by the browser. In the
browser developer console on the local site, the current value can be read with:

```js
localStorage.getItem("ai_comic_uid")
```

`comicctl` automatically reads its three `COMICCTL_*` settings from `.env.local`.
Restart the development server after changing provider settings.

## Commands

```powershell
pnpm comicctl -- project list
pnpm comicctl -- project create --title "Moonlit Post Office"
pnpm comicctl -- episode create --project PROJECT_ID --title "Episode 1"
pnpm comicctl -- episode list --project PROJECT_ID
pnpm comicctl -- profiles
pnpm comicctl -- status --project PROJECT_ID
```

Create a safe dry-run plan:

```powershell
pnpm comicctl -- run plan --project PROJECT_ID --action script_outline --payload-file .\plan.json
```

Create a live-capable plan. It still cannot execute before approval:

```powershell
pnpm comicctl -- run plan --project PROJECT_ID --action single_video_generate --payload-file .\shot-1.json --live
pnpm comicctl -- run approve RUN_ID
pnpm comicctl -- run execute RUN_ID
pnpm comicctl -- run get RUN_ID
```

Failure handling:

```powershell
pnpm comicctl -- run retry RUN_ID
pnpm comicctl -- run cancel RUN_ID
```

All commands print JSON so Codex can inspect results without scraping the UI.

## Recommended production loop

1. Generate outline, script, characters, and storyboard.
2. Stop for approval of story and character identity.
3. Generate one character reference and one shot's keyframes.
4. Stop for visual approval.
5. Generate one video, with at most two attempts.
6. Only then generate remaining shots, preferably one at a time or with a
   controller limit of two.
7. Confirm completed shots equal total shots before assembling a preview.

Use a fixed natural-language instruction shape:

`project + scope + action + constraints + resource limit + stopping point`

Example:

> Create episode 1 of "Moonlit Post Office" as a 30-second 9:16 story with two
> characters and six shots. Use M3 for outline, character cards, and storyboard.
> Do not generate paid media. Stop after reporting continuity issues and wait
> for approval.
