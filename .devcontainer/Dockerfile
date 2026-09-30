# dev container image: bun plus the tooling the release image leaves out
FROM oven/bun:1

RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		ca-certificates \
		git \
		less \
		make \
		openssh-client \
	&& rm -rf /var/lib/apt/lists/*

# created as bun so the named volume mounted here (see devcontainer.json) is writable
USER bun
RUN mkdir -p /home/bun/.claude
