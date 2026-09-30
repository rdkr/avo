# avo

Discord bot that collects availability from a role group and posts a meetup time once a channel's responder threshold is reached (configured per channel, default 5).

`/avo` asks for a time today; `/avo mode:day` asks which of the next 25 days people can do and lists who picked each day (no alert).

## Install

```bash
bun install
```

## Run

Requires `DISCORD_TOKEN` in the environment (e.g. via `.env`):

```bash
bun run bot.ts
```

The bot registers its slash commands with Discord each time it starts, so there is no separate registration step.

## Test

```bash
make test   # on the host, via Docker
bun test    # inside the dev container
```

## Lint / format

```bash
bunx biome check .          # check
bunx biome check --write .  # apply fixes
```

Runtime is [Bun](https://bun.sh).
