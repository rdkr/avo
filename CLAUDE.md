# avo

Discord bot that collects availability from a role group and posts a meetup time once a channel's responder threshold is reached.

## Runtime

Bun (not Node). Use `bun` for all installs and script execution.

## Structure

- `lib.ts` — pure helper functions (no Discord imports): `getNextQuarterHours`, `getPairsFromContent`, `getContentFromPairs`, `shouldAlert`, and the `channelConfigs` channel→{group, threshold} map.
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

## Channel config

`channelConfigs` in `lib.ts` maps a channel ID to its role group and alert threshold. `/avo` works in any channel, but only configured channels get a role tag and fire the meetup alert; unconfigured channels collect responses but never alert.

| Name | Channel ID | Group (role) ID | Threshold |
|---|---|---|---|
| cs (production) | `862714922423943219` | `1340781340257423430` | 5 |
| test | `1401168219712000141` | `1401187418182516959` | 5 |

## Known behaviors (intentional, not bugs)

- The meetup alert fires only in configured channels (see Channel config), using that channel's threshold; unconfigured channels never alert. Within a configured channel it re-sends on **every** selection past the threshold, not only on the first crossing — a live nudge as more people pile in or change times.
- The posted meetup time is the lexicographically-latest `HH:MM` among selections; windows that cross midnight are not specially handled.
- CI (`.github/workflows/ci.yaml`) builds and pushes `ghcr.io/rdkr/avo:latest` on every push to any branch, with no test/lint gate.

## Linting

```
bunx biome check .
```
