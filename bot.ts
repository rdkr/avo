import {
	ActionRowBuilder,
	type ChatInputCommandInteraction,
	Client,
	Events,
	GatewayIntentBits,
	StringSelectMenuBuilder,
} from "discord.js";

import type { Interaction } from "discord.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const group = "1401187418182516959"; // test
// const group = "1401187418182516959"; // cs

client.on(Events.ClientReady, (readyClient) => {
	console.log(`Logged in as ${readyClient.user.tag}!`);
});

// Get next 12 quarter-hour slots in 24h format
function getNextQuarterHours(count = 24): { label: string; value: string }[] {
	const now = new Date();
	const minutes = now.getMinutes();
	const nextQuarter = Math.ceil(minutes / 15) * 15;
	now.setMinutes(nextQuarter);
	now.setSeconds(0);
	now.setMilliseconds(0);

	const options = [];

	for (let i = 0; i < count; i++) {
		const slot = new Date(now.getTime() + i * 15 * 60 * 1000);
		const timeStr = slot.toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		});
		options.push({
			label: timeStr,
			value: slot.toISOString(),
		});
	}

	return options;
}

// Send the select menu
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
		allowedMentions: { roles: [group] },
	});
}

function getPairsFromContent(content: string): Map<string, string> {
	const match = content.match(/\[\?\]\(https:\/\/avo\.internal\/(.*)\)/);
	const hyperlinkPairs = match && match[1] ? match[1].split("/") : [];

	const selections = new Map<string, string>();
	for (const pair of hyperlinkPairs) {
		const [userId, time] = pair.split(";");
		selections.set(userId, time);
	}
	return selections;
}

function getContentFromPairs(selections: Map<string, string>) {
	const encodedPairs = Array.from(selections.entries())
		.map(([userId, time]) => `${userId};${time}`)
		.join("/");
	const updatedLink = `[?](https://avo.internal/${encodedPairs})`;

	const updatedLines = Array.from(selections.entries())
		.map(([userId, time]) => `<@${userId}> selected: ${time}`);

	const newContent = [`<@&${group}> ${updatedLink}`, ...updatedLines].join("\n");
	return newContent;
}

function getContent(interaction: Interaction) {

	const originalMessage = interaction.message;
	const existingContent = originalMessage.content;

	const selections = getPairsFromContent(existingContent);

	const userId = interaction.user.id;
	const selectedTime = new Date(interaction.values[0]);
	const time = selectedTime.toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
	
	// Update or add this user's selection
	selections.set(userId, time);

	const newContent = getContentFromPairs(selections);

	return { originalMessage, newContent };
}

// Handle interactions
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
