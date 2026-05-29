.PHONY: build-dev test

build-dev:
	docker build --target dev -t avo-dev .

test: build-dev
	docker run --rm \
		-v $(PWD)/lib.ts:/usr/src/app/lib.ts:ro \
		-v $(PWD)/lib.test.ts:/usr/src/app/lib.test.ts:ro \
		-v $(PWD)/bot.ts:/usr/src/app/bot.ts:ro \
		-v $(PWD)/bot.flow.test.ts:/usr/src/app/bot.flow.test.ts:ro \
		avo-dev
