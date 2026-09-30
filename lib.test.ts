import { describe, expect, test } from "bun:test";
import {
	channelConfigs,
	formatTime,
	getContentFromPairs,
	getLatestTime,
	getNextQuarterHours,
	getPairsFromContent,
	shouldAlert,
} from "./lib.ts";

const csEntry = Object.entries(channelConfigs)[0];
if (!csEntry) throw new Error("channelConfigs must have at least one entry");
const [csChannelId, csConfig] = csEntry;
const csGroupId = csConfig.groupId;

describe("getNextQuarterHours", () => {
	test("returns 24 slots by default", () => {
		const slots = getNextQuarterHours();
		expect(slots).toHaveLength(24);
	});

	test("returns requested count", () => {
		expect(getNextQuarterHours(4)).toHaveLength(4);
	});

	test("slots are 15 minutes apart", () => {
		const times = getNextQuarterHours(4).map((slot) =>
			new Date(slot.value).getTime(),
		);
		times.reduce((prev, cur) => {
			expect(cur - prev).toBe(15 * 60 * 1000);
			return cur;
		});
	});

	test("first slot is snapped to the next quarter hour", () => {
		// 12:07 → next quarter is 12:15
		const now = new Date("2024-01-01T12:07:00Z");
		const [first] = getNextQuarterHours(1, now);
		if (!first) throw new Error("expected a slot");
		const date = new Date(first.value);
		expect(date.getMinutes() % 15).toBe(0);
		expect(date.getSeconds()).toBe(0);
	});

	test("first slot is the same quarter when already on the boundary", () => {
		const now = new Date("2024-01-01T12:00:00Z");
		const [first] = getNextQuarterHours(1, now);
		if (!first) throw new Error("expected a slot");
		expect(new Date(first.value).getMinutes()).toBe(0);
	});

	test("each slot has a label and ISO value", () => {
		const slots = getNextQuarterHours(2);
		for (const slot of slots) {
			expect(slot.label).toMatch(/^\d{2}:\d{2}$/);
			expect(Number.isNaN(new Date(slot.value).getTime())).toBe(false);
		}
	});
});

describe("formatTime", () => {
	test("formats in London time during GMT", () => {
		expect(formatTime(new Date("2024-01-01T12:00:00Z"))).toBe("12:00");
	});

	test("formats in London time during BST", () => {
		expect(formatTime(new Date("2024-07-01T12:00:00Z"))).toBe("13:00");
	});

	test("midnight is 00:00, not 24:00", () => {
		expect(formatTime(new Date("2024-01-01T00:00:00Z"))).toBe("00:00");
	});
});

describe("getLatestTime", () => {
	const pollStart = new Date("2024-01-01T22:00:00Z");

	test("returns the latest time within a single day", () => {
		const start = new Date("2024-01-01T12:00:00Z");
		expect(getLatestTime(["14:00", "16:30", "13:15"], start)).toBe("16:30");
	});

	test("times before the poll start count as the next day", () => {
		expect(getLatestTime(["23:45", "00:15", "22:30"], pollStart)).toBe("00:15");
	});

	test("picks the latest of several times after midnight", () => {
		expect(getLatestTime(["00:15", "01:30", "23:45"], pollStart)).toBe("01:30");
	});

	test("a time equal to the poll start is the same day", () => {
		expect(getLatestTime(["22:00", "00:15"], pollStart)).toBe("00:15");
		expect(getLatestTime(["22:00", "23:00"], pollStart)).toBe("23:00");
	});

	test("returns undefined when there are no times", () => {
		expect(getLatestTime([], pollStart)).toBeUndefined();
	});
});

describe("getPairsFromContent", () => {
	test("parses a single user selection", () => {
		const content = `<@&${csGroupId}> ?\n<@123456> selected: 14:00`;
		const pairs = getPairsFromContent(content);
		expect(pairs.get("123456")).toBe("14:00");
		expect(pairs.size).toBe(1);
	});

	test("parses multiple selections", () => {
		const content = `<@&${csGroupId}> ?\n<@111> selected: 09:30\n<@222> selected: 10:15`;
		const pairs = getPairsFromContent(content);
		expect(pairs.get("111")).toBe("09:30");
		expect(pairs.get("222")).toBe("10:15");
		expect(pairs.size).toBe(2);
	});

	test("ignores lines that do not match the format", () => {
		const content = "some random text\n<@&group> ?\n<@123> selected: 14:00";
		const pairs = getPairsFromContent(content);
		expect(pairs.size).toBe(1);
	});

	test("returns empty map for empty content", () => {
		expect(getPairsFromContent("").size).toBe(0);
	});

	test("later entry for same user overwrites earlier", () => {
		const content = "<@123> selected: 09:00\n<@123> selected: 10:00";
		const pairs = getPairsFromContent(content);
		expect(pairs.get("123")).toBe("10:00");
		expect(pairs.size).toBe(1);
	});
});

describe("getContentFromPairs", () => {
	test("empty map produces just the header", () => {
		const content = getContentFromPairs(new Map(), csChannelId);
		expect(content).toBe(`<@&${csGroupId}> ?`);
	});

	test("single entry appears after the header", () => {
		const pairs = new Map([["789", "15:30"]]);
		const content = getContentFromPairs(pairs, csChannelId);
		expect(content).toBe(`<@&${csGroupId}> ?\n<@789> selected: 15:30`);
	});

	test("output can be round-tripped through getPairsFromContent", () => {
		const original = new Map([
			["111", "09:00"],
			["222", "10:15"],
		]);
		const content = getContentFromPairs(original, csChannelId);
		const parsed = getPairsFromContent(content);
		expect(parsed).toEqual(original);
	});
});

describe("shouldAlert", () => {
	test("true once a configured channel reaches its threshold", () => {
		expect(shouldAlert(csChannelId, csConfig.threshold)).toBe(true);
		expect(shouldAlert(csChannelId, csConfig.threshold + 1)).toBe(true);
	});

	test("false below a configured channel's threshold", () => {
		expect(shouldAlert(csChannelId, csConfig.threshold - 1)).toBe(false);
	});

	test("false for unconfigured channels regardless of count", () => {
		expect(shouldAlert("UNKNOWN_CHANNEL", 100)).toBe(false);
	});

	test("false when there is no channel id", () => {
		expect(shouldAlert(undefined, 100)).toBe(false);
		expect(shouldAlert(null, 100)).toBe(false);
	});
});
