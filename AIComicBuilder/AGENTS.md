# AIComicBuilder agent guidance

When operating this project as a media-production controller:

- Use `pnpm comicctl -- ...` and the orchestrator API. Do not edit SQLite directly.
- Keep provider secrets in `.env.local`; never place API keys in prompts, CLI arguments, logs, or committed files.
- Treat `run plan` as dry-run by default. Require explicit user approval before image, video, speech, music, bulk regeneration, overwriting an accepted asset, or final publication.
- Prefer one-shot validation before batch generation. Limit external media concurrency to 2-3.
- Query timed-out remote jobs before retrying to avoid duplicate charges.
- Preserve accepted assets and create a new version for revisions whenever the underlying workflow supports it.
- Report current stage, completed/total items, failures/retries, new artifacts, and the next approval needed.

See `docs/CODEX_ORCHESTRATION.md` for commands and the production loop.
