export const channelGroups: Record<string, string> = {
	"862714922423943219": "1340781340257423430", // cs
	"1401168219712000141": "1401187418182516959", // test
};

export function getNextQuarterHours(
	count = 24,
	now = new Date(),
): { label: string; value: string }[] {
	const base = new Date(now);
	const minutes = base.getMinutes();
	const nextQuarter = Math.ceil(minutes / 15) * 15;
	base.setMinutes(nextQuarter);
	base.setSeconds(0);
	base.setMilliseconds(0);

	const options = [];

	for (let i = 0; i < count; i++) {
		const slot = new Date(base.getTime() + i * 15 * 60 * 1000);
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

export function getPairsFromContent(content: string): Map<string, string> {
	const pairs = new Map<string, string>();
	const lines = content.split("\n");
	for (const line of lines) {
		const match = line.match(/^<@(\d+)> selected: (\d{2}:\d{2})$/);
		if (!match) continue;
		pairs.set(match[1]!, match[2]!);
	}
	return pairs;
}

export function getContentFromPairs(pairs: Map<string, string>, channelId?: string) {
	const updatedLines = Array.from(pairs.entries()).map(
		([userId, time]) => `<@${userId}> selected: ${time}`,
	);
	const groupId = channelId ? channelGroups[channelId] : undefined;
	const header = groupId ? `<@&${groupId}> ?` : "?";
	return [header, ...updatedLines].join("\n");
}
