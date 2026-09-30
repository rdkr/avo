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
	return [getHeader(channelId), ...updatedLines].join("\n");
}

function getHeader(channelId?: string | null) {
	const groupId = channelId ? channelConfigs[channelId]?.groupId : undefined;
	return groupId ? `<@&${groupId}> ?` : "?";
}

function getOrdinalSuffix(day: number): string {
	if (day >= 11 && day <= 13) return "th";
	return ["th", "st", "nd", "rd"][day % 10] ?? "th";
}

// e.g. "Sat 3rd" — the month is implicit, as day mode offers under a month.
export function formatDay(date: Date): string {
	const parts = new Intl.DateTimeFormat("en-GB", {
		weekday: "short",
		day: "numeric",
		timeZone: TIME_ZONE,
	}).formatToParts(date);
	const weekday = parts.find((part) => part.type === "weekday")?.value;
	const day = Number(parts.find((part) => part.type === "day")?.value);
	return `${weekday} ${day}${getOrdinalSuffix(day)}`;
}

// Discord allows at most 25 options in a select menu.
export function getNextDays(
	count = 25,
	now = new Date(),
): { label: string; value: string }[] {
	const parts = new Intl.DateTimeFormat("en-GB", {
		year: "numeric",
		month: "numeric",
		day: "numeric",
		timeZone: TIME_ZONE,
	}).formatToParts(now);
	const get = (type: string) =>
		Number(parts.find((part) => part.type === type)?.value);

	const options = [];

	for (let i = 0; i < count; i++) {
		// noon UTC is the same calendar day in London all year round
		const date = new Date(
			Date.UTC(get("year"), get("month") - 1, get("day") + i, 12),
		);
		const label = formatDay(date);
		options.push({ label, value: label });
	}

	return options;
}

export function getDaysFromContent(content: string): Map<string, string[]> {
	const days = new Map<string, string[]>();
	const lines = content.split("\n");
	for (const line of lines) {
		const match = line.match(/^([A-Z][a-z]{2} \d{1,2}(?:st|nd|rd|th)): (.+)$/);
		if (!match) continue;
		const [, day, users] = match;
		if (!day || !users) continue;
		const userIds = Array.from(users.matchAll(/<@(\d+)>/g), (m) => m[1] ?? "");
		days.set(day, userIds);
	}
	return days;
}

// Replaces the user's previous days with their new selection.
export function setUserDays(
	days: Map<string, string[]>,
	userId: string,
	selectedDays: string[],
): Map<string, string[]> {
	const updated = new Map<string, string[]>();
	for (const [day, userIds] of days) {
		updated.set(
			day,
			userIds.filter((id) => id !== userId),
		);
	}
	for (const day of selectedDays) {
		updated.set(day, [...(updated.get(day) ?? []), userId]);
	}
	return updated;
}

// One line per day that anyone has selected, in the order given by dayOrder
// (the menu's options, which are chronological).
export function getContentFromDays(
	days: Map<string, string[]>,
	dayOrder: string[],
	channelId?: string | null,
) {
	const lines = Array.from(days.entries())
		.filter(([, userIds]) => userIds.length > 0)
		.sort(([a], [b]) => dayOrder.indexOf(a) - dayOrder.indexOf(b))
		.map(
			([day, userIds]) =>
				`${day}: ${userIds.map((id) => `<@${id}>`).join(" ")}`,
		);
	return [getHeader(channelId), ...lines].join("\n");
}
