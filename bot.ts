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
		content: "<@&1340781340257423430> ?",
		components: [row],
		fetchReply: true,
	});
}

function getNewContent(interaction: Interaction) {
	const selectedTime = new Date(interaction.values[0]);
	const formatted = selectedTime.toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});

	const username = interaction.user.username;
	const originalMessage = interaction.message;
	const existingContent = originalMessage.content;

	const lines = existingContent.split("\n");

	// First line is the prompt, remaining lines are user selections
	const title = lines[0];
	const entries = lines.slice(1);

	// Parse into map of username -> time
	const selections = new Map<string, string>();
	for (const line of entries) {
		const match = line.match(/^\*\*(.+?)\*\* selected: (\d{2}:\d{2})$/);
		if (match) {
			selections.set(match[1], match[2]);
		}
	}

	// Update or add this user's selection
	selections.set(username, formatted);

	// Rebuild the message content
	const updatedLines = Array.from(selections.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([user, time]) => `**${user}** selected: ${time}`);

	const newContent = [title, ...updatedLines].join("\n");

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
		const { originalMessage, newContent } = getNewContent(interaction);
		await originalMessage.edit({ content: newContent });
		await interaction.deferUpdate(); // Silently acknowledge
	}
});

client.login(process.env.DISCORD_TOKEN);
