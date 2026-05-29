import {
	ActionRowBuilder,
	type ChatInputCommandInteraction,
	Client,
	Events,
	GatewayIntentBits,
	StringSelectMenuBuilder,
} from "discord.js";

import type { Interaction } from "discord.js";

import {
	getContentFromPairs,
	getNextQuarterHours,
	getPairsFromContent,
} from "./lib.ts";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// const group = "1401187418182516959"; // test

async function sendTimeSelectMenu(interaction: ChatInputCommandInteraction) {
	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId("time_select")
		.setPlaceholder("pick a time")
		.addOptions(getNextQuarterHours());

	const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
		selectMenu,
	);
	await interaction.reply({
		content: getContentFromPairs(new Map()),
		components: [row],
		allowedMentions: { parse: ["roles"] },
	});
}

function getContent(interaction: Interaction) {
	const originalMessage = interaction.message;
	const existingContent = originalMessage.content;
	const pairs = getPairsFromContent(existingContent);

	const userId = interaction.user.id;
	const selectedTime = new Date(interaction.values[0]);
	const time = selectedTime.toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});

	pairs.set(userId, time);

	if (pairs.size >= 5 && interaction.channel) {
		const userTags = Array.from(pairs.keys())
			.map((id) => `<@${id}>`)
			.join(",");
		const latestTime = Array.from(pairs.values()).sort().slice(-1)[0];
		interaction.channel.send({
			content: `${userTags} @ ${latestTime} :avocado:`,
			allowedMentions: { parse: ["users"] },
		});
	}

	return { originalMessage, newContent: getContentFromPairs(pairs) };
}

client.on(Events.ClientReady, (readyClient) => {
	console.log(`Logged in as ${readyClient.user.tag}!`);
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
	if (interaction.isChatInputCommand()) {
		if (interaction.commandName === "avo") {
			await sendTimeSelectMenu(interaction);
		}
	} else if (
		interaction.isStringSelectMenu() &&
		interaction.customId === "time_select"
	) {
		const { originalMessage, newContent } = getContent(interaction);
		await originalMessage.edit({ content: newContent });
		await interaction.deferUpdate(); // Silently acknowledge
	}
});

client.login(process.env.DISCORD_TOKEN);
