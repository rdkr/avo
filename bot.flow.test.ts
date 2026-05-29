import { describe, expect, test } from "bun:test";
import { setupHandlers } from "./bot.ts";

class MockClient {
	private handlers = new Map<string, (...args: any[]) => any>();

	on(event: string, handler: (...args: any[]) => any) {
		this.handlers.set(event, handler);
		return this;
	}

	async emit(event: string, ...args: any[]) {
		await this.handlers.get(event)?.(...args);
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

	async send({ content }: { content: string }) {
		this.sent.push(content);
	}
}

const CS_CHANNEL_ID = "PLACEHOLDER_CS_CHANNEL_ID";
const CS_GROUP_ID = "1340781340257423430";
const TIME_VALUE = new Date("2024-01-01T14:00:00Z").toISOString();

function makeSlashInteraction(channelId: string, onReply: (content: string) => void) {
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
		await client.emit("interactionCreate", makeSlashInteraction(CS_CHANNEL_ID, (c) => { repliedContent = c; }));

		expect(repliedContent).toContain(`<@&${CS_GROUP_ID}>`);
	});

	test("/avo in unknown channel has no role tag", async () => {
		const client = new MockClient();
		setupHandlers(client);

		let repliedContent = "";
		await client.emit("interactionCreate", makeSlashInteraction("UNKNOWN_CHANNEL", (c) => { repliedContent = c; }));

		expect(repliedContent).toBe("?");
	});

	test("5 users selecting times triggers alert and updates message", async () => {
		const client = new MockClient();
		setupHandlers(client);

		const channel = new MockChannel();
		let initialContent = "";
		await client.emit("interactionCreate", makeSlashInteraction(CS_CHANNEL_ID, (c) => { initialContent = c; }));

		const message = new MockMessage(initialContent);
		const users = ["1001", "1002", "1003", "1004", "1005"];

		for (let i = 0; i < users.length; i++) {
			await client.emit("interactionCreate", makeSelectInteraction(message, channel, users[i], CS_CHANNEL_ID));

			expect(message.content).toContain(`<@${users[i]}> selected:`);
			if (i < 4) expect(channel.sent).toHaveLength(0);
		}

		expect(channel.sent).toHaveLength(1);
		expect(channel.sent[0]).toContain(":avocado:");
		for (const userId of users) {
			expect(channel.sent[0]).toContain(`<@${userId}>`);
		}
	});

	test("fewer than 5 users does not trigger alert", async () => {
		const client = new MockClient();
		setupHandlers(client);

		const channel = new MockChannel();
		let initialContent = "";
		await client.emit("interactionCreate", makeSlashInteraction(CS_CHANNEL_ID, (c) => { initialContent = c; }));

		const message = new MockMessage(initialContent);

		for (const userId of ["1001", "1002", "1003", "1004"]) {
			await client.emit("interactionCreate", makeSelectInteraction(message, channel, userId, CS_CHANNEL_ID));
		}

		expect(channel.sent).toHaveLength(0);
	});
});
