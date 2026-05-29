import { REST, Routes } from "discord.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
if (!token || !clientId) {
	throw new Error("DISCORD_TOKEN and CLIENT_ID must be set");
}

const commands = [
	{
		name: "avo",
		description: "activate avo bot!",
	},
];

const rest = new REST({ version: "10" }).setToken(token);

try {
	console.log("Started refreshing application (/) commands.");

	await rest.put(Routes.applicationCommands(clientId), {
		body: commands,
	});

	console.log("Successfully reloaded application (/) commands.");
} catch (error) {
	console.error(error);
}
