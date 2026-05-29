import {
	ActionRowBuilder,
	type ChatInputCommandInteraction,
	Client,
	Events,
	GatewayIntentBits,
	StringSelectMenuBuilder,
} from "discord.js";

import type { Interaction, StringSelectMenuInteraction } from "discord.js";

import {
	getContentFromPairs,
	getNextQuarterHours,
	getPairsFromContent,
	shouldAlert,
} from "./lib.ts";

async function sendTimeSelectMenu(interaction: ChatInputCommandInteraction) {
	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId("time_select")
		.setPlaceholder("pick a time")
		.addOptions(getNextQuarterHours());

	const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
		selectMenu,
	);
	await interaction.reply({
		content: getContentFromPairs(new Map(), interaction.channelId),
		components: [row],
		allowedMentions: { parse: ["roles"] },
	});
}

async function getContent(interaction: StringSelectMenuInteraction) {
	const originalMessage = interaction.message;
	const existingContent = originalMessage.content;
	const pairs = getPairsFromContent(existingContent);

	const userId = interaction.user.id;
	const selectedValue = interaction.values[0];
	if (!selectedValue) {
		return { originalMessage, newContent: existingContent };
	}
	const time = new Date(selectedValue).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});

	pairs.set(userId, time);

	if (
		shouldAlert(interaction.channelId, pairs.size) &&
		interaction.channel?.isSendable()
	) {
		const userTags = Array.from(pairs.keys())
			.map((id) => `<@${id}>`)
			.join(",");
		const latestTime = Array.from(pairs.values()).sort().slice(-1)[0];
		await interaction.channel.send({
			content: `${userTags} @ ${latestTime} 🥑`,
			allowedMentions: { parse: ["users"] },
		});
	}

	return {
		originalMessage,
		newContent: getContentFromPairs(pairs, interaction.channelId),
	};
}

// biome-ignore lint/suspicious/noExplicitAny: loose handler type so a test double can be injected
type EventHandler = (...args: any[]) => unknown;

type ClientLike = {
	on(event: string, listener: EventHandler): unknown;
};

export function setupHandlers(client: ClientLike) {
	client.on(Events.ClientReady, (readyClient: { user: { tag: string } }) => {
		console.log(`Logged in as ${readyClient.user.tag}!`);
	});

	client.on(Events.InteractionCreate, async (interaction: Interaction) => {
		try {
			if (interaction.isChatInputCommand()) {
				if (interaction.commandName === "avo") {
					await sendTimeSelectMenu(interaction);
				}
			} else if (
				interaction.isStringSelectMenu() &&
				interaction.customId === "time_select"
			) {
				await interaction.deferUpdate();
				const { originalMessage, newContent } = await getContent(interaction);
				await originalMessage.edit({ content: newContent });
			}
		} catch (error) {
			console.error("Failed to handle interaction:", error);
		}
	});
}

if (import.meta.main) {
	const token = process.env.DISCORD_TOKEN;
	if (!token) {
		throw new Error("DISCORD_TOKEN is not set");
	}
	const client = new Client({ intents: [GatewayIntentBits.Guilds] });
	setupHandlers(client);
	client.login(token);
}
