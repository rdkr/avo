import { describe, expect, test } from "bun:test";
import { setupHandlers } from "./bot.ts";
import { channelConfigs, getNextDays } from "./lib.ts";

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
	createdAt: Date;

	constructor(content: string, createdAt = new Date("2024-01-01T12:00:00Z")) {
		this.content = content;
		this.createdAt = createdAt;
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

// toJSON on the real builders runs discord.js's own validation
type SerializableRow = {
	toJSON(): {
		components: {
			custom_id: string;
			options: unknown[];
			min_values?: number;
			max_values?: number;
		}[];
	};
};

function makeSlashInteraction(
	channelId: string,
	onReply: (content: string, components: SerializableRow[]) => void,
	mode: string | null = null,
) {
	return {
		isChatInputCommand: () => true,
		isStringSelectMenu: () => false,
		commandName: "avo",
		channelId,
		options: { getString: () => mode },
		reply: async ({
			content,
			components,
		}: { content: string; components: SerializableRow[] }) =>
			onReply(content, components),
	};
}

const DAY_OPTIONS = getNextDays(25, new Date("2024-01-30T12:00:00Z"));

function makeDaySelectInteraction(
	message: MockMessage,
	channel: MockChannel,
	userId: string,
	channelId: string,
	days: string[],
) {
	return {
		isChatInputCommand: () => false,
		isStringSelectMenu: () => true,
		customId: "day_select",
		message,
		user: { id: userId },
		values: days,
		component: { options: DAY_OPTIONS },
		channelId,
		channel,
		deferUpdate: async () => {},
	};
}

function makeSelectInteraction(
	message: MockMessage,
	channel: MockChannel,
	userId: string,
	channelId: string,
	timeValue = TIME_VALUE,
) {
	return {
		isChatInputCommand: () => false,
		isStringSelectMenu: () => true,
		customId: "time_select",
		message,
		user: { id: userId },
		values: [timeValue],
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

	test("each mode sends its own valid select menu", async () => {
		const client = new MockClient();
		setupHandlers(client);

		const getMenu = async (mode: string | null) => {
			let rows: SerializableRow[] = [];
			await client.emit(
				INTERACTION_CREATE,
				makeSlashInteraction(
					CS_CHANNEL_ID,
					(_, components) => {
						rows = components;
					},
					mode,
				),
			);
			expect(rows).toHaveLength(1);
			return rows[0]?.toJSON().components[0];
		};

		// no mode is also what an old command registration sends
		for (const mode of [null, "time"]) {
			const menu = await getMenu(mode);
			expect(menu?.custom_id).toBe("time_select");
			expect(menu?.options).toHaveLength(24);
		}

		const dayMenu = await getMenu("day");
		expect(dayMenu?.custom_id).toBe("day_select");
		expect(dayMenu?.options).toHaveLength(25);
		expect(dayMenu?.min_values).toBe(0);
		expect(dayMenu?.max_values).toBe(25);
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

	test("alert uses the latest time when the poll crosses midnight", async () => {
		const client = new MockClient();
		setupHandlers(client);

		const channel = new MockChannel();
		const message = new MockMessage(
			`<@&${CS_GROUP_ID}> ?`,
			new Date("2024-01-01T22:00:00Z"),
		);

		for (const [i, userId] of TEST_USERS.entries()) {
			// one person picks 00:15 the next day, everyone else 23:45
			const timeValue =
				i === 1 ? "2024-01-02T00:15:00.000Z" : "2024-01-01T23:45:00.000Z";
			await client.emit(
				INTERACTION_CREATE,
				makeSelectInteraction(
					message,
					channel,
					userId,
					CS_CHANNEL_ID,
					timeValue,
				),
			);
		}

		expect(channel.sent).toHaveLength(1);
		expect(channel.sent[0]).toEndWith("@ 00:15 🥑");
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

describe("day mode flow", () => {
	async function startDayPoll(client: MockClient) {
		let initialContent = "";
		await client.emit(
			INTERACTION_CREATE,
			makeSlashInteraction(
				CS_CHANNEL_ID,
				(c) => {
					initialContent = c;
				},
				"day",
			),
		);
		return new MockMessage(initialContent);
	}

	test("/avo mode:day in cs channel tags cs group", async () => {
		const client = new MockClient();
		setupHandlers(client);

		const message = await startDayPoll(client);

		expect(message.content).toBe(`<@&${CS_GROUP_ID}> ?`);
	});

	test("selections are aggregated by day in chronological order", async () => {
		const client = new MockClient();
		setupHandlers(client);

		const channel = new MockChannel();
		const message = await startDayPoll(client);

		// picked out of order, and crossing from January into February
		await client.emit(
			INTERACTION_CREATE,
			makeDaySelectInteraction(message, channel, "1001", CS_CHANNEL_ID, [
				"Thu 1st",
				"Wed 31st",
			]),
		);
		await client.emit(
			INTERACTION_CREATE,
			makeDaySelectInteraction(message, channel, "1002", CS_CHANNEL_ID, [
				"Thu 1st",
				"Tue 30th",
			]),
		);

		expect(message.content).toBe(
			[
				`<@&${CS_GROUP_ID}> ?`,
				"Tue 30th: <@1002>",
				"Wed 31st: <@1001>",
				"Thu 1st: <@1001> <@1002>",
			].join("\n"),
		);
	});

	test("a new selection replaces the user's previous days", async () => {
		const client = new MockClient();
		setupHandlers(client);

		const channel = new MockChannel();
		const message = await startDayPoll(client);

		for (const days of [["Tue 30th", "Wed 31st"], ["Thu 1st"]]) {
			await client.emit(
				INTERACTION_CREATE,
				makeDaySelectInteraction(message, channel, "1001", CS_CHANNEL_ID, days),
			);
		}

		expect(message.content).toBe(`<@&${CS_GROUP_ID}> ?\nThu 1st: <@1001>`);
	});

	test("clearing the selection removes the user", async () => {
		const client = new MockClient();
		setupHandlers(client);

		const channel = new MockChannel();
		const message = await startDayPoll(client);

		for (const days of [["Tue 30th"], []]) {
			await client.emit(
				INTERACTION_CREATE,
				makeDaySelectInteraction(message, channel, "1001", CS_CHANNEL_ID, days),
			);
		}

		expect(message.content).toBe(`<@&${CS_GROUP_ID}> ?`);
	});

	test("day mode never alerts", async () => {
		const client = new MockClient();
		setupHandlers(client);

		const channel = new MockChannel();
		const message = await startDayPoll(client);

		for (const userId of TEST_USERS) {
			await client.emit(
				INTERACTION_CREATE,
				makeDaySelectInteraction(message, channel, userId, CS_CHANNEL_ID, [
					"Tue 30th",
				]),
			);
		}

		expect(channel.sent).toHaveLength(0);
		expect(message.content).toContain(
			`Tue 30th: ${TEST_USERS.map((id) => `<@${id}>`).join(" ")}`,
		);
	});
});
