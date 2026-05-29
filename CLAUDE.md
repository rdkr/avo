# avo

Discord bot that collects availability from a role group and sends a meetup time once 5 people have responded.

## Runtime

Bun (not Node). Use `bun` for all installs and script execution.

## Structure

- `lib.ts` — pure helper functions (no Discord imports): `getNextQuarterHours`, `getPairsFromContent`, `getContentFromPairs`, and the `group` role ID constant.
- `bot.ts` — Discord client setup and event handlers; imports from `lib.ts`.
- `lib.test.ts` — Bun tests for the pure functions in `lib.ts`.
- `register.ts` — one-shot script to register slash commands with Discord.

## Testing

```
make test
```

Builds the `dev` Docker stage (node_modules baked in) and mounts `lib.ts` + `lib.test.ts` at runtime. Rebuilding the image is only needed when `package.json` changes.

## Docker stages

| Stage | Purpose |
|---|---|
| `install` | installs dev and prod deps in separate temp dirs |
| `dev` | dev deps only; source mounted at runtime for `bun test` |
| `prerelease` | dev deps + full source copy |
| `release` | prod deps + `bot.ts` only; runs `bun run bot.ts` |

## Group IDs

- `1340781340257423430` — cs (production)
- `1401187418182516959` — test

## Linting

```
bunx biome check .
```
