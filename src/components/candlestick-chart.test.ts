import { describe, expect, it } from "vitest";

import type { Candle } from "#/lib/candles";

import {
	getPriceScale,
	getTimeframeLabel,
	getTimeTickIndexes,
} from "./candlestick-chart";

function candlesAt(...dates: string[]): Candle[] {
	return dates.map((date, index) => ({
		time: Date.parse(`${date}T09:00:00+08:00`),
		open: 100 + index,
		high: 102 + index,
		low: 99 + index,
		close: 101 + index,
	}));
}

describe("candlestick chart time axis", () => {
	it("adds five percent above and below the data range with quarter ticks", () => {
		const candles = candlesAt("2026-07-10", "2026-07-11");
		candles[0].low = 90;
		candles[1].high = 110;

		expect(getPriceScale(candles, "D")).toEqual({
			minimumPrice: 85.5,
			maximumPrice: 115.5,
			priceRange: 30,
			priceTicks: [115.5, 108, 100.5, 93, 85.5],
		});
	});

	it.each([
		"1",
		"5",
		"10",
		"15",
		"30",
		"60",
	] as const)("uses the exact high and low for the %s minute price axis", (timeframe) => {
		const candles = candlesAt("2026-07-10", "2026-07-11");
		candles[0].low = 90;
		candles[1].high = 110;

		expect(getPriceScale(candles, timeframe)).toEqual({
			minimumPrice: 90,
			maximumPrice: 110,
			priceRange: 20,
			priceTicks: [110, 105, 100, 95, 90],
		});
	});

	it("labels the one-minute view as a standalone five-day line chart", () => {
		expect(getTimeframeLabel("1")).toBe("5日");
		expect(
			getTimeTickIndexes(
				candlesAt("2026-07-10", "2026-07-10", "2026-07-11"),
				"1",
			),
		).toEqual([0, 2]);
	});

	it("uses one time-axis tick per Taipei hour for intraday charts", () => {
		const candles = [
			"2026-07-10T09:00:00+08:00",
			"2026-07-10T09:30:00+08:00",
			"2026-07-10T10:00:00+08:00",
			"2026-07-10T10:30:00+08:00",
			"2026-07-10T11:00:00+08:00",
		].map((time, index) => ({
			time: Date.parse(time),
			open: 100 + index,
			high: 102 + index,
			low: 99 + index,
			close: 101 + index,
		}));

		expect(getTimeTickIndexes(candles, "1", true)).toEqual([0, 2, 4]);
	});

	it("uses one label per day for 30 and 60 minute candles", () => {
		const candles = candlesAt(
			"2026-07-10",
			"2026-07-10",
			"2026-07-11",
			"2026-07-11",
			"2026-07-12",
		);

		expect(getTimeTickIndexes(candles, "30")).toEqual([0, 2, 4]);
		expect(getTimeTickIndexes(candles, "60")).toEqual([0, 2, 4]);
	});

	it("uses one label per month for daily candles", () => {
		expect(
			getTimeTickIndexes(
				candlesAt(
					"2026-01-02",
					"2026-01-20",
					"2026-02-02",
					"2026-02-20",
					"2026-03-02",
				),
				"D",
			),
		).toEqual([0, 2, 4]);
	});

	it("uses one label per calendar quarter for weekly and monthly candles", () => {
		const candles = candlesAt(
			"2026-01-02",
			"2026-02-02",
			"2026-04-01",
			"2026-06-01",
			"2026-07-01",
			"2026-10-01",
		);

		expect(getTimeTickIndexes(candles, "W")).toEqual([0, 2, 4, 5]);
		expect(getTimeTickIndexes(candles, "M")).toEqual([0, 2, 4, 5]);
	});
});
