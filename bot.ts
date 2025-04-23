import {
	ActionRowBuilder,
	type ChatInputCommandInteraction,
	Client,
	Events,
	GatewayIntentBits,
	StringSelectMenuBuilder,
} from "discord.js";
import { avoResponses } from "./avo-responses";

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
		content: "<@&1340781340257423430> <:cs_avo:1357493508478599209> :pistol:?",
		components: [row],
		fetchReply: true,
	});
}

const emojiMap: Record<string, string[]> = {
	"big.jon.": ["<:jonface:770936094632050708>", "<:gobblein:1017088712959606896>"],
	"emu76": ["<:peterface:775408823233019955>", "<:henry:1055164031922622574>"],
	"fuzzyhunter": ["<:jovahkiin:1364365971514593323>", "<:mlady:1067548480022777896>"],
	"htidcam": ["<:camcrime:951976875733954570>", "<:oldercam:932742587385794571>"],
	"l.i.aam": ["<:liamface:768503469988118568>", "<:liam_flame_shirt:1364373236275482624>"],
	"radhakr": ["<:neel:951976485290389534>", "<:neelbutwhy:1016269602285695027>"],
	"raidhas": ["<:raidpanik:1017087860161118339>", "<:raiddraft:986038165368352769>"],
	"sam.hockley": ["<:samface:680161037990887441>", "<:samface2:1063634161065283634>"],
	"smokinggekko": ["<:govsmile:782352151585357864>", "<:govface:554808692466515968>"]
}

function getEmojiForUser(user: string) {
	const fallbackEmoji = ":pistol:"
	const emojis = emojiMap[user];

	if (!emojis || emojis.length === 0) {
		return fallbackEmoji
	}
	const randomIndex = Math.floor(Math.random() * emojis.length);
	return emojis[randomIndex];
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
	const sortedSelections = Array.from(selections.entries())
		.sort(([a, timeA], [b, timeB]) => {
			const [hoursA, minutesA] = timeA.split(":").map(Number);
			const [hoursB, minutesB] = timeB.split(":").map(Number);
			const dateA = new Date();
			const dateB = new Date();

			dateA.setHours(hoursA, minutesA);
			dateB.setHours(hoursB, minutesB);

			return dateA.getTime() - dateB.getTime(); // Compare times
		})

	const updatedLines = sortedSelections
		.map(([user, time]) => `${getEmojiForUser(user)} **${user}** selected: ${time}`);
	const newContent = [title, ...updatedLines].join("\n");


	// Messages to send when we have 5 players
	if (selections.size === 5) {
		interaction.channel?.send({
			content: `Earliest time for players: ${sortedSelections.pop()?.[1]} `
		});

		const randomResponse = avoResponses[Math.floor(Math.random() * avoResponses.length)];
		interaction.channel?.send({
			content: randomResponse,
		});
	}
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
		await interaction.deferUpdate(); // Silently acknowledge (tip fedora)
	}
});

client.login(process.env.DISCORD_TOKEN);
