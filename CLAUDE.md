# avo

Discord bot that collects availability from a role group and posts a meetup time once a channel's responder threshold is reached.

## Runtime

Bun (not Node). Use `bun` for all installs and script execution.

## Structure

- `lib.ts` — pure helper functions (no Discord imports): `formatTime`, `getLatestTime`, `getNextQuarterHours`, `getPairsFromContent`, `getContentFromPairs`, `shouldAlert`, and the `channelConfigs` channel→{group, threshold} map.
- `bot.ts` — Discord client setup and event handlers; imports from `lib.ts`.
- `lib.test.ts` — Bun tests for the pure functions in `lib.ts`.
- `bot.flow.test.ts` — Bun tests for the interaction flow via an injected mock client (no Discord connection needed).
- `register.ts` — one-shot script to register slash commands with Discord.

## Testing

```
make test
```

Builds the `dev` Docker stage (node_modules baked in) and mounts the source and test files (`lib.ts`, `bot.ts`, `lib.test.ts`, `bot.flow.test.ts`) at runtime. Rebuilding the image is only needed when `package.json` changes.

Inside the dev container there is no Docker, so run the tests directly:

```
bun test
```

## Dev container

`.devcontainer/Dockerfile` is separate from the root `Dockerfile` (which CI builds and publishes). It is `oven/bun` plus git, make, ssh and the GitHub CLI, runs as the `bun` user, and runs `bun install --frozen-lockfile` on creation. Claude Code's config lives in the `avo-claude` named volume so it survives rebuilds.

## Docker stages

| Stage | Purpose |
|---|---|
| `install` | installs dev and prod deps in separate temp dirs |
| `dev` | dev deps only; source mounted at runtime for `bun test` |
| `prerelease` | dev deps + full source copy |
| `release` | prod deps + `bot.ts` & `lib.ts`; runs `bun run bot.ts` |

## Channel config

`channelConfigs` in `lib.ts` maps a channel ID to its role group and alert threshold. `/avo` works in any channel, but only configured channels get a role tag and fire the meetup alert; unconfigured channels collect responses but never alert.

| Name | Channel ID | Group (role) ID | Threshold |
|---|---|---|---|
| cs (production) | `862714922423943219` | `1340781340257423430` | 5 |
| test | `1401168219712000141` | `1401187418182516959` | 5 |

## Known behaviors (intentional, not bugs)

- The meetup alert fires only in configured channels (see Channel config), using that channel's threshold; unconfigured channels never alert. Within a configured channel it re-sends on **every** selection past the threshold, not only on the first crossing — a live nudge as more people pile in or change times.
- Times are always formatted in `Europe/London` (`formatTime` in `lib.ts`), regardless of the process timezone.
- The posted meetup time is the latest `HH:MM` among selections. Selections are stored as bare `HH:MM`, so `getLatestTime` uses the poll message's creation time to order them: any time earlier on the clock than the poll start is treated as the next day.
- Known limitation: on the night the clocks go back, 01:00–01:45 occurs twice, so the menu shows duplicate labels and the ordering within that hour is ambiguous. Not handled.
- CI (`.github/workflows/ci.yaml`) builds and pushes `ghcr.io/rdkr/avo:latest` on every push to any branch, with no test/lint gate.

## Linting

```
bunx biome check .
```
