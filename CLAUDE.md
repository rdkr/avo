# avo

Discord bot that collects availability from a role group and sends a meetup time once 5 people have responded.

## Runtime

Bun (not Node). Use `bun` for all installs and script execution.

## Structure

- `lib.ts` — pure helper functions (no Discord imports): `getNextQuarterHours`, `getPairsFromContent`, `getContentFromPairs`, and the `channelGroups` channel→role map.
- `bot.ts` — Discord client setup and event handlers; imports from `lib.ts`.
- `lib.test.ts` — Bun tests for the pure functions in `lib.ts`.
- `bot.flow.test.ts` — Bun tests for the interaction flow via an injected mock client (no Discord connection needed).
- `register.ts` — one-shot script to register slash commands with Discord.

## Testing

```
make test
```

Builds the `dev` Docker stage (node_modules baked in) and mounts the source and test files (`lib.ts`, `bot.ts`, `lib.test.ts`, `bot.flow.test.ts`) at runtime. Rebuilding the image is only needed when `package.json` changes.

## Docker stages

| Stage | Purpose |
|---|---|
| `install` | installs dev and prod deps in separate temp dirs |
| `dev` | dev deps only; source mounted at runtime for `bun test` |
| `prerelease` | dev deps + full source copy |
| `release` | prod deps + `bot.ts` & `lib.ts`; sets `TZ=Europe/London`; runs `bun run bot.ts` |

## Group IDs

- `1340781340257423430` — cs (production)
- `1401187418182516959` — test

## Known behaviors (intentional, not bugs)

- The meetup alert is re-sent on **every** selection once ≥5 people have responded, not only on the first crossing — it acts as a live nudge as more people pile in or change times.
- The posted meetup time is the lexicographically-latest `HH:MM` among selections; windows that cross midnight are not specially handled.
- CI (`.github/workflows/ci.yaml`) builds and pushes `ghcr.io/rdkr/avo:latest` on every push to any branch, with no test/lint gate.

## Linting

```
bunx biome check .
```
