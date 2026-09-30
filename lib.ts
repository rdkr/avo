export type ChannelConfig = {
	groupId: string;
	threshold: number;
};

// Channels the bot is configured for: the role group to tag and how many
// responders trigger the meetup alert. /avo still works in other channels,
// but they get no role tag and never alert.
export const channelConfigs: Record<string, ChannelConfig> = {
	"862714922423943219": { groupId: "1340781340257423430", threshold: 5 }, // cs
	"1401168219712000141": { groupId: "1401187418182516959", threshold: 5 }, // test
};

export function shouldAlert(
	channelId: string | null | undefined,
	responderCount: number,
): boolean {
	if (!channelId) return false;
	const config = channelConfigs[channelId];
	return config !== undefined && responderCount >= config.threshold;
}

// Times are always shown in London time, whatever timezone the process runs in.
const TIME_ZONE = "Europe/London";

export function formatTime(date: Date): string {
	return date.toLocaleTimeString("en-GB", {
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
		timeZone: TIME_ZONE,
	});
}

// Selections are stored as bare HH:MM, so the poll's start time is what tells
// us which ones fall after midnight: the menu only offers times from the poll
// start onwards, so anything earlier on the clock must be the next day.
export function getLatestTime(
	times: Iterable<string>,
	pollStart: Date,
): string | undefined {
	const start = formatTime(pollStart);
	const sortKey = (time: string) => `${time < start ? 1 : 0}${time}`;
	let latest: string | undefined;
	for (const time of times) {
		if (latest === undefined || sortKey(time) > sortKey(latest)) latest = time;
	}
	return latest;
}

export function getNextQuarterHours(
	count = 24,
	now = new Date(),
): { label: string; value: string }[] {
	const quarterMs = 15 * 60 * 1000;
	const base = new Date(Math.ceil(now.getTime() / quarterMs) * quarterMs);

	const options = [];

	for (let i = 0; i < count; i++) {
		const slot = new Date(base.getTime() + i * quarterMs);
		options.push({
			label: formatTime(slot),
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
		const [, userId, time] = match;
		if (!userId || !time) continue;
		pairs.set(userId, time);
	}
	return pairs;
}

export function getContentFromPairs(
	pairs: Map<string, string>,
	channelId?: string | null,
) {
	const updatedLines = Array.from(pairs.entries()).map(
		([userId, time]) => `<@${userId}> selected: ${time}`,
	);
	const groupId = channelId ? channelConfigs[channelId]?.groupId : undefined;
	const header = groupId ? `<@&${groupId}> ?` : "?";
	return [header, ...updatedLines].join("\n");
}
