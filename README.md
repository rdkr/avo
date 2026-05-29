# avo

Discord bot that collects availability from a role group and posts a meetup time once a channel's responder threshold is reached (configured per channel, default 5).

## Install

```bash
bun install
```

## Run

Requires `DISCORD_TOKEN` in the environment (e.g. via `.env`):

```bash
bun run bot.ts
```

## Register slash commands

One-shot; requires `DISCORD_TOKEN` and `CLIENT_ID`:

```bash
bun run register.ts
```

## Test

```bash
make test
```

## Lint / format

```bash
bunx biome check .          # check
bunx biome check --write .  # apply fixes
```

Runtime is [Bun](https://bun.sh).
