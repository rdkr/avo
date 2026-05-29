import { describe, expect, test } from "bun:test";
import { setupHandlers } from "./bot.ts";
import { channelConfigs } from "./lib.ts";

// biome-ignore lint/suspicious/noExplicitAny: loose handler type for the Discord client test double
type EventHandler = (...args: any[]) => any;

class MockClient {
	private handlers = new Map<string, EventHandler[]>();

	on(event: string, handler: EventHandler) {
		const existing = this.handlers.get(event) ?? [];
		this.handlers.set(event, [...existing, handler]);
		return this;
	}

	async emit(event: string, ...args: unknown[]) {
		for (const handler of this.handlers.get(event) ?? []) {
			await handler(...args);
		}
	}
}

class MockMessage {
	content: string;

	constructor(content: string) {
		this.content = content;
	}

	async edit({ content }: { content: string }) {
		this.content = content;
	}
}

class MockChannel {
	sent: string[] = [];

	isSendable() {
		return true;
	}

	async send({ content }: { content: string }) {
		this.sent.push(content);
	}
}

const csEntry = Object.entries(channelConfigs)[0];
if (!csEntry) throw new Error("channelConfigs must have at least one entry");
const [CS_CHANNEL_ID, csConfig] = csEntry;
const CS_GROUP_ID = csConfig.groupId;
const UNKNOWN_CHANNEL_ID = "UNKNOWN_CHANNEL";
const TIME_VALUE = new Date("2024-01-01T14:00:00Z").toISOString();
const INTERACTION_CREATE = "interactionCreate";
const TEST_USERS = ["1001", "1002", "1003", "1004", "1005"];

function makeSlashInteraction(
	channelId: string,
	onReply: (content: string) => void,
) {
	return {
		isChatInputCommand: () => true,
		isStringSelectMenu: () => false,
		commandName: "avo",
		channelId,
		reply: async ({ content }: { content: string }) => onReply(content),
	};
}

function makeSelectInteraction(
	message: MockMessage,
	channel: MockChannel,
	userId: string,
	channelId: string,
) {
	return {
		isChatInputCommand: () => false,
		isStringSelectMenu: () => true,
		customId: "time_select",
		message,
		user: { id: userId },
		values: [TIME_VALUE],
		channelId,
		channel,
		deferUpdate: async () => {},
	};
}

describe("bot flow", () => {
	test("/avo in cs channel tags cs group", async () => {
		const client = new MockClient();
		setupHandlers(client);

		let repliedContent = "";
		await client.emit(
			INTERACTION_CREATE,
			makeSlashInteraction(CS_CHANNEL_ID, (c) => {
				repliedContent = c;
			}),
		);

		expect(repliedContent).toContain(`<@&${CS_GROUP_ID}>`);
	});

	test("/avo in unknown channel has no role tag", async () => {
		const client = new MockClient();
		setupHandlers(client);

		let repliedContent = "";
		await client.emit(
			INTERACTION_CREATE,
			makeSlashInteraction(UNKNOWN_CHANNEL_ID, (c) => {
				repliedContent = c;
			}),
		);

		expect(repliedContent).toBe("?");
	});

	test("5 users selecting times triggers alert and updates message", async () => {
		const client = new MockClient();
		setupHandlers(client);

		const channel = new MockChannel();
		let initialContent = "";
		await client.emit(
			INTERACTION_CREATE,
			makeSlashInteraction(CS_CHANNEL_ID, (c) => {
				initialContent = c;
			}),
		);

		const message = new MockMessage(initialContent);

		for (const [i, userId] of TEST_USERS.entries()) {
			await client.emit(
				INTERACTION_CREATE,
				makeSelectInteraction(message, channel, userId, CS_CHANNEL_ID),
			);

			expect(message.content).toContain(`<@${userId}> selected:`);
			if (i < 4) expect(channel.sent).toHaveLength(0);
		}

		expect(channel.sent).toHaveLength(1);
		expect(channel.sent[0]).toContain("🥑");
		for (const userId of TEST_USERS) {
			expect(channel.sent[0]).toContain(`<@${userId}>`);
		}
	});

	test("fewer than 5 users does not trigger alert", async () => {
		const client = new MockClient();
		setupHandlers(client);

		const channel = new MockChannel();
		let initialContent = "";
		await client.emit(
			INTERACTION_CREATE,
			makeSlashInteraction(CS_CHANNEL_ID, (c) => {
				initialContent = c;
			}),
		);

		const message = new MockMessage(initialContent);

		for (const userId of TEST_USERS.slice(0, 4)) {
			await client.emit(
				INTERACTION_CREATE,
				makeSelectInteraction(message, channel, userId, CS_CHANNEL_ID),
			);
		}

		expect(channel.sent).toHaveLength(0);
	});

	test("5 users in an unconfigured channel never alerts", async () => {
		const client = new MockClient();
		setupHandlers(client);

		const channel = new MockChannel();
		let initialContent = "";
		await client.emit(
			INTERACTION_CREATE,
			makeSlashInteraction(UNKNOWN_CHANNEL_ID, (c) => {
				initialContent = c;
			}),
		);

		const message = new MockMessage(initialContent);

		for (const userId of TEST_USERS) {
			await client.emit(
				INTERACTION_CREATE,
				makeSelectInteraction(message, channel, userId, UNKNOWN_CHANNEL_ID),
			);
		}

		expect(channel.sent).toHaveLength(0);
		for (const userId of TEST_USERS) {
			expect(message.content).toContain(`<@${userId}> selected:`);
		}
	});
});
